"""Define the type to serialize/de-serialize the state of the recce instance."""

import json
import logging
import os
import threading
import time
from base64 import b64encode
from dataclasses import dataclass
from datetime import datetime
from hashlib import md5, sha256
from typing import Dict, List, Literal, Optional, Tuple, Union
from urllib.parse import urlencode

import botocore.exceptions
from pydantic import BaseModel, Field

from recce import get_version
from recce.event import get_recce_api_token
from recce.exceptions import RecceException
from recce.git import current_branch
from recce.models import CheckDAO
from recce.models.types import Check, Run
from recce.pull_request import PullRequestInfo, fetch_pr_metadata
from recce.util.io import SupportedFileTypes, file_io_factory
from recce.util.pydantic_model import pydantic_model_dump, pydantic_model_json_dump
from recce.util.recce_cloud import PresignedUrlMethod, RecceCloud, RecceCloudException

logger = logging.getLogger("uvicorn")

RECCE_STATE_FILE = "recce-state.json"
RECCE_STATE_COMPRESSED_FILE = f"{RECCE_STATE_FILE}.gz"


@dataclass
class ErrorMessage:
    error_message: str
    hint_message: str


RECCE_CLOUD_TOKEN_MISSING = ErrorMessage(
    error_message="No GitHub token is provided to access the pull request information",
    hint_message="Please provide a GitHub token in the command argument",
)

RECCE_CLOUD_PASSWORD_MISSING = ErrorMessage(
    error_message="No password provided to access the state file in Recce Cloud",
    hint_message='Please provide a password with the option "--password <compress-password>"',
)

RECCE_API_TOKEN_MISSING = ErrorMessage(
    error_message="No Recc API token is provided",
    hint_message="Please login to Recce Cloud and copy the API token from the settings page",
)


def s3_sse_c_headers(password: str) -> Dict[str, str]:
    hashed_password = sha256()
    md5_hash = md5()
    hashed_password.update(password.encode())
    md5_hash.update(hashed_password.digest())
    encoded_passwd = b64encode(hashed_password.digest()).decode("utf-8")
    encoded_md5 = b64encode(md5_hash.digest()).decode("utf-8")
    return {
        "x-amz-server-side-encryption-customer-algorithm": "AES256",
        "x-amz-server-side-encryption-customer-key": encoded_passwd,
        "x-amz-server-side-encryption-customer-key-MD5": encoded_md5,
    }


def check_s3_bucket(bucket_name: str):
    import boto3

    s3_client = boto3.client("s3")
    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except botocore.exceptions.ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            return False, f"Bucket '{bucket_name}' does not exist."
        elif error_code == "403":
            return False, f"Bucket '{bucket_name}' exists but you do not have permission to access it."
        else:
            return False, f"Failed to access the S3 bucket: '{bucket_name}'"
    return True, None


class GitRepoInfo(BaseModel):
    branch: Optional[str] = None

    @staticmethod
    def from_current_repositroy():
        branch = current_branch()
        if branch is None:
            return None

        return GitRepoInfo(branch=branch)

    def to_dict(self):
        return pydantic_model_dump(self)


class RecceStateMetadata(BaseModel):
    schema_version: str = "v0"
    recce_version: str = Field(default_factory=lambda: get_version())
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))


class ArtifactsRoot(BaseModel):
    """
    Root of the artifacts.

    base: artifacts of the base env. key is file name, value is dict
    current: artifacts of the current env. key is file name, value is dict
    """

    base: Dict[str, Optional[dict]] = {}
    current: Dict[str, Optional[dict]] = {}


class RecceState(BaseModel):
    metadata: Optional[RecceStateMetadata] = None
    runs: Optional[List[Run]] = Field(default_factory=list)
    checks: Optional[List[Check]] = Field(default_factory=list)
    artifacts: ArtifactsRoot = ArtifactsRoot(base={}, current={})
    git: Optional[GitRepoInfo] = None
    pull_request: Optional[PullRequestInfo] = None

    @staticmethod
    def from_json(json_content: str):
        dict_data = json.loads(json_content)
        state = RecceState(**dict_data)
        metadata = state.metadata
        if metadata:
            if metadata.schema_version is None:
                pass
            if metadata.schema_version == "v0":
                pass
            else:
                raise RecceException(f"Unsupported state file version: {metadata.schema_version}")
        return state

    @staticmethod
    def from_file(file_path: str, file_type: SupportedFileTypes = SupportedFileTypes.FILE):
        """
        Load the state from a recce state file.
        """
        from pathlib import Path

        logger.debug(f"Load state file from: '{file_path}'")
        if not Path(file_path).is_file():
            return None

        io = file_io_factory(file_type)
        json_content = io.read(file_path)
        return RecceState.from_json(json_content)

    def to_json(self):
        return pydantic_model_json_dump(self)

    def to_file(self, file_path: str, file_type: SupportedFileTypes = SupportedFileTypes.FILE):

        json_data = self.to_json()
        io = file_io_factory(file_type)

        io.write(file_path, json_data)
        return f"The state file is stored at '{file_path}'"

    def _merge_run(self, run: Run):
        for r in self.runs:
            if r.run_id == run.run_id:
                break
        else:
            self.runs.append(run)

    def _merge_check(self, check: Check):
        for c in self.checks:
            if c.check_id == check.check_id:
                c.merge(check)
                break
        else:
            self.checks.append(check)

    def _merge_artifacts(self, artifacts: ArtifactsRoot):
        self.artifacts.merge(artifacts)


class RecceStateLoader:
    def __init__(
        self,
        review_mode: bool = False,
        cloud_mode: bool = False,
        state_file: Optional[str] = None,
        cloud_options: Optional[Dict[str, str]] = None,
        initial_state: Optional[RecceState] = None,
    ):
        self.review_mode = review_mode
        self.cloud_mode = cloud_mode
        self.state_file = state_file
        self.cloud_options = cloud_options or {}
        self.error_message = None
        self.hint_message = None
        self.state: RecceState | None = initial_state
        self.state_lock = threading.Lock()
        self.state_etag = None
        self.pr_info = None
        self.catalog: Literal["github", "preview"] = "github"
        self.share_id = None

        if self.cloud_mode:
            if self.cloud_options.get("github_token"):
                self.catalog = "github"
                self.pr_info = fetch_pr_metadata(
                    cloud=self.cloud_mode, github_token=self.cloud_options.get("github_token")
                )
                if self.pr_info.id is None:
                    raise RecceException("Cannot get the pull request information from GitHub.")
            elif self.cloud_options.get("api_token"):
                self.catalog = "preview"
                self.share_id = self.cloud_options.get("share_id")
            else:
                raise RecceException(RECCE_CLOUD_TOKEN_MISSING.error_message)

        # Load the state
        self.load()

    def verify(self) -> bool:
        if self.cloud_mode:
            if self.catalog == "github":
                if self.cloud_options.get("github_token") is None:
                    self.error_message = RECCE_CLOUD_TOKEN_MISSING.error_message
                    self.hint_message = RECCE_CLOUD_TOKEN_MISSING.hint_message
                    return False
                if not self.cloud_options.get("host"):
                    if self.cloud_options.get("password") is None:
                        self.error_message = RECCE_CLOUD_PASSWORD_MISSING.error_message
                        self.hint_message = RECCE_CLOUD_PASSWORD_MISSING.hint_message
                        return False
            elif self.catalog == "preview":
                if self.cloud_options.get("api_token") is None:
                    self.error_message = RECCE_API_TOKEN_MISSING.error_message
                    self.hint_message = RECCE_API_TOKEN_MISSING.hint_message
                    return False
                if self.cloud_options.get("share_id") is None:
                    self.error_message = "No share ID is provided for the preview catalog."
                    self.hint_message = (
                        'Please provide a share URL in the command argument with option "--share-url <share-url>"'
                    )
                    return False

        else:
            if self.review_mode is True and self.state_file is None:
                self.error_message = "Recce can not launch without a state file."
                self.hint_message = "Please provide a state file in the command argument."
                return False
            pass
        return True

    @property
    def token(self):
        return self.cloud_options.get("github_token") or self.cloud_options.get("api_token")

    @property
    def error_and_hint(self) -> (Union[str, None], Union[str, None]):
        return self.error_message, self.hint_message

    def update(self, state: RecceState):
        self.state = state

    def load(self, refresh=False) -> RecceState:
        if self.state is not None and refresh is False:
            return self.state
        self.state_lock.acquire()
        try:
            if self.cloud_mode:
                self.state, self.state_etag = self._load_state_from_cloud()
            elif self.state_file:
                self.state = self._load_state_from_file()
        finally:
            self.state_lock.release()
        return self.state

    def save_as(self, state_file: str, state: RecceState = None):
        if self.cloud_mode:
            raise Exception("Cannot save the state to Recce Cloud.")

        self.state_file = state_file
        self.export(state)

    def export(self, state: RecceState = None) -> Union[str, None]:
        if state is not None:
            self.update(state)
        # TODO: Export the current Recce state to file or cloud storage
        start_time = time.time()
        self.state_lock.acquire()
        try:
            if self.cloud_mode:
                message, state_etag = self._export_state_to_cloud()
                self.state_etag = state_etag
            else:
                if self.state_file is None:
                    return "No state file is provided. Skip storing the state."
                logger.info(f"Store recce state to '{self.state_file}'")
                message = self._export_state_to_file()
            end_time = time.time()
            elapsed_time = end_time - start_time
        finally:
            self.state_lock.release()
        logger.info(f"Store state completed in {elapsed_time:.2f} seconds")
        return message

    def refresh(self):
        new_state = self.load(refresh=True)
        return new_state

    def check_conflict(self) -> bool:
        if not self.cloud_mode:
            return False

        if self.cloud_options.get("host", "").startswith("s3://"):
            return False

        metadata = self._get_metadata_from_recce_cloud()
        if not metadata:
            return False

        state_etag = metadata.get("etag")
        return state_etag != self.state_etag

    def info(self):
        if self.state is None:
            self.error_message = "No state is loaded."
            return None

        state_info = {
            "mode": "cloud" if self.cloud_mode else "local",
            "source": None,
        }
        if self.cloud_mode:
            if self.cloud_options.get("host", "").startswith("s3://"):
                state_info["source"] = self.cloud_options.get("host")
            else:
                state_info["source"] = "Recce Cloud"
            state_info["pull_request"] = self.pr_info
        else:
            state_info["source"] = self.state_file
        return state_info

    def purge(self) -> bool:
        if self.cloud_mode is True:
            rc, err_msg = RecceCloudStateManager(self.cloud_options).purge_cloud_state()
            if err_msg:
                self.error_message = err_msg
            return rc
        else:
            if self.state_file is not None:
                try:
                    os.remove(self.state_file)
                except Exception as e:
                    self.error_message = f"Failed to remove the state file: {e}"
                    return False
            else:
                self.error_message = "No state file is provided. Skip removing the state file."
                return False

    def _load_state_from_file(self, file_path: Optional[str] = None) -> RecceState:
        file_path = file_path or self.state_file
        return RecceState.from_file(file_path) if file_path else None

    def _load_state_from_cloud(self) -> Tuple[RecceState, str]:
        """
        Load the state from Recce Cloud.

        Returns:
            RecceState: The state object.
            str: The etag of the state file.
        """
        if self.catalog == "github":
            if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
                raise RecceException("Cannot get the pull request information from GitHub.")
        elif self.catalog == "preview":
            if self.share_id is None:
                raise RecceException("Cannot load the share state from Recce Cloud. No share ID is provided.")

        if self.cloud_options.get("host", "").startswith("s3://"):
            logger.debug("Fetching state from AWS S3 bucket...")
            return self._load_state_from_s3_bucket(), None
        else:
            logger.debug("Fetching state from Recce Cloud...")
            metadata = self._get_metadata_from_recce_cloud()
            if metadata:
                state_etag = metadata.get("etag")
            else:
                state_etag = None
            if self.state_etag and state_etag == self.state_etag:
                return self.state, self.state_etag

            return self._load_state_from_recce_cloud(), state_etag

    def _get_metadata_from_recce_cloud(self) -> Union[dict, None]:
        recce_cloud = RecceCloud(token=self.token)
        return recce_cloud.get_artifact_metadata(pr_info=self.pr_info) if self.pr_info else None

    def _load_state_from_recce_cloud(self) -> Union[RecceState, None]:
        import tempfile

        import requests

        recce_cloud = RecceCloud(token=self.token)
        password = None

        if self.catalog == "github":
            presigned_url = recce_cloud.get_presigned_url_by_github_repo(
                method=PresignedUrlMethod.DOWNLOAD,
                pr_id=self.pr_info.id,
                repository=self.pr_info.repository,
                artifact_name=RECCE_STATE_COMPRESSED_FILE,
            )

            password = self.cloud_options.get("password")
            if password is None:
                raise RecceException(RECCE_CLOUD_PASSWORD_MISSING.error_message)
        elif self.catalog == "preview":
            share_id = self.cloud_options.get("share_id")
            presigned_url = recce_cloud.get_presigned_url_by_share_id(
                method=PresignedUrlMethod.DOWNLOAD, share_id=share_id
            )

        with tempfile.NamedTemporaryFile() as tmp:
            headers = s3_sse_c_headers(password) if password else None
            response = requests.get(presigned_url, headers=headers)
            if response.status_code == 404:
                self.error_message = "The state file is not found in Recce Cloud."
                return None
            elif response.status_code != 200:
                self.error_message = response.text
                raise RecceException(
                    f"{response.status_code} Failed to download the state file from Recce Cloud. The password could be wrong."
                )
            with open(tmp.name, "wb") as f:
                f.write(response.content)

            file_type = SupportedFileTypes.GZIP if self.catalog == "github" else SupportedFileTypes.FILE
            return RecceState.from_file(tmp.name, file_type=file_type)

    def _load_state_from_s3_bucket(self) -> Union[RecceState, None]:
        import tempfile

        import boto3

        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")

        if self.catalog == "github":
            s3_bucket_key = (
                f"{self.catalog}/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}"
            )
        elif self.catalog == "preview":
            s3_bucket_key = f"{self.catalog}/{self.share_id}/{RECCE_STATE_FILE}"
        else:
            raise RecceException(f"Unsupported catalog type. {self.catalog} is not supported.")

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise RecceException(error_message)

        with tempfile.NamedTemporaryFile() as tmp:
            try:
                s3_client.download_file(s3_bucket_name, s3_bucket_key, tmp.name)
            except botocore.exceptions.ClientError as e:
                error_code = e.response.get("Error", {}).get("Code")
                if error_code == "404":
                    self.error_message = "The state file is not found in the S3 bucket."
                    return None
                else:
                    raise e
            return RecceState.from_file(tmp.name, file_type=SupportedFileTypes.GZIP)

    def _export_state_to_cloud(self) -> Tuple[Union[str, None], str]:
        if self.catalog == "github":
            if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
                raise RecceException("Cannot get the pull request information from GitHub.")
        elif self.catalog == "preview":
            pass

        check_status = CheckDAO().status()
        metadata = {
            "total_checks": check_status.get("total", 0),
            "approved_checks": check_status.get("approved", 0),
        }

        if self.cloud_options.get("host", "").startswith("s3://"):
            logger.info("Store recce state to AWS S3 bucket")
            return self._export_state_to_s3_bucket(metadata=metadata), None
        else:
            logger.info("Store recce state to Recce Cloud")
            message = self._export_state_to_recce_cloud(metadata=metadata)
            metadata = self._get_metadata_from_recce_cloud()
            state_etag = metadata.get("etag") if metadata else None
            if message:
                logger.warning(message)
            return message, state_etag

    def _export_state_to_recce_cloud(self, metadata: dict = None) -> Union[str, None]:
        import tempfile

        import requests

        if self.catalog == "github":
            presigned_url = RecceCloud(token=self.token).get_presigned_url_by_github_repo(
                method=PresignedUrlMethod.UPLOAD,
                repository=self.pr_info.repository,
                artifact_name=RECCE_STATE_COMPRESSED_FILE,
                pr_id=self.pr_info.id,
                metadata=metadata,
            )
        elif self.catalog == "preview":
            share_id = self.cloud_options.get("share_id")
            presigned_url = RecceCloud(token=self.token).get_presigned_url_by_share_id(
                method=PresignedUrlMethod.UPLOAD,
                share_id=share_id,
                metadata=metadata,
            )
        compress_passwd = self.cloud_options.get("password")
        if compress_passwd:
            headers = s3_sse_c_headers(compress_passwd)
        else:
            headers = {}

        if metadata:
            headers["x-amz-tagging"] = urlencode(metadata)
        with tempfile.NamedTemporaryFile() as tmp:
            if self.catalog == "github":
                file_type = SupportedFileTypes.GZIP
            elif self.catalog == "preview":
                file_type = SupportedFileTypes.FILE
            self._export_state_to_file(tmp.name, file_type=file_type)

            with open(tmp.name, "rb") as fd:
                response = requests.put(presigned_url, data=fd.read(), headers=headers)
            if response.status_code not in [200, 204]:
                self.error_message = response.text
                return "Failed to upload the state file to Recce Cloud. Reason: " + response.text
        return None

    def _export_state_to_s3_bucket(self, metadata: dict = None) -> Union[str, None]:
        import tempfile

        import boto3

        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")
        if self.catalog == "github":
            s3_bucket_key = (
                f"{self.catalog}/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}"
            )
        elif self.catalog == "preview":
            s3_bucket_key = f"{self.catalog}/{self.share_id}/{RECCE_STATE_FILE}"
        else:
            raise RecceException(f"Unsupported catalog type. {self.catalog} is not supported.")

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise RecceException(error_message)

        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name, file_type=SupportedFileTypes.GZIP)

            s3_client.upload_file(
                tmp.name,
                s3_bucket_name,
                s3_bucket_key,
                # Casting all the values under metadata to string
                ExtraArgs={"Metadata": {k: str(v) for k, v in metadata.items()}},
            )
        RecceCloud(token=self.token).update_github_pull_request_check(self.pr_info, metadata)
        return f"The state file is uploaded to ' s3://{s3_bucket_name}/{s3_bucket_key}'"

    def _get_artifact_metadata_from_s3_bucket(self, artifact_name: str) -> Union[dict, None]:
        import boto3

        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")
        s3_bucket_key = f"github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{artifact_name}"
        try:
            response = s3_client.head_object(Bucket=s3_bucket_name, Key=s3_bucket_key)
            metadata = response["Metadata"]
            return metadata
        except botocore.exceptions.ClientError as e:
            self.error_message = e.response.get("Error", {}).get("Message")
            raise RecceException("Failed to get artifact metadata from Recce Cloud.")

    def _export_state_to_file(
        self, file_path: Optional[str] = None, file_type: SupportedFileTypes = SupportedFileTypes.FILE
    ) -> str:
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """

        file_path = file_path or self.state_file
        json_data = self.state.to_json()
        io = file_io_factory(file_type)

        io.write(file_path, json_data)
        return f"The state file is stored at '{file_path}'"


class RecceCloudStateManager:
    error_message: str
    hint_message: str

    # It is a class to upload, download and purge the state file on Recce Cloud.

    def __init__(self, cloud_options: Optional[Dict[str, str]] = None):
        self.cloud_options = cloud_options or {}
        self.pr_info = None
        self.error_message = None
        self.hint_message = None
        self.github_token = self.cloud_options.get("github_token")

        if not self.github_token:
            raise RecceException(RECCE_CLOUD_TOKEN_MISSING.error_message)
        self.pr_info = fetch_pr_metadata(cloud=True, github_token=self.github_token)
        if self.pr_info.id is None:
            raise RecceException("Cannot get the pull request information from GitHub.")

    def verify(self) -> bool:
        if self.github_token is None:
            self.error_message = RECCE_CLOUD_TOKEN_MISSING.error_message
            self.hint_message = RECCE_CLOUD_TOKEN_MISSING.hint_message
            return False
        if self.cloud_options.get("password") is None:
            self.error_message = RECCE_CLOUD_PASSWORD_MISSING.error_message
            self.hint_message = RECCE_CLOUD_PASSWORD_MISSING.hint_message
            return False
        return True

    @property
    def error_and_hint(self) -> (Union[str, None], Union[str, None]):
        return self.error_message, self.hint_message

    def _check_state_in_recce_cloud(self) -> bool:
        return RecceCloud(token=self.github_token).check_artifacts_exists(self.pr_info)

    def _check_state_in_s3_bucket(self) -> bool:
        import boto3

        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")
        s3_bucket_key = f"github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}"
        try:
            s3_client.head_object(Bucket=s3_bucket_name, Key=s3_bucket_key)
        except botocore.exceptions.ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "404":
                return False
        return True

    def check_cloud_state_exists(self) -> bool:
        if self.cloud_options.get("host", "").startswith("s3://"):
            return self._check_state_in_s3_bucket()
        else:
            return self._check_state_in_recce_cloud()

    def _upload_state_to_recce_cloud(self, state: RecceState, metadata: dict = None) -> Union[str, None]:
        import tempfile

        import requests

        presigned_url = RecceCloud(token=self.github_token).get_presigned_url_by_github_repo(
            method=PresignedUrlMethod.UPLOAD,
            repository=self.pr_info.repository,
            artifact_name=RECCE_STATE_COMPRESSED_FILE,
            pr_id=self.pr_info.id,
            metadata=metadata,
        )

        compress_passwd = self.cloud_options.get("password")
        headers = s3_sse_c_headers(compress_passwd)
        with tempfile.NamedTemporaryFile() as tmp:
            state.to_file(tmp.name, file_type=SupportedFileTypes.GZIP)
            response = requests.put(presigned_url, data=open(tmp.name, "rb").read(), headers=headers)
            if response.status_code != 200:
                return f"Failed to upload the state file to Recce Cloud. Reason: {response.text}"
        return "The state file is uploaded to Recce Cloud."

    def _upload_state_to_s3_bucket(self, state: RecceState, metadata: dict = None) -> Union[str, None]:
        import tempfile

        import boto3

        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")
        s3_bucket_key = f"github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}"

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise RecceException(error_message)

        with tempfile.NamedTemporaryFile() as tmp:
            state.to_file(tmp.name, file_type=SupportedFileTypes.GZIP)

            s3_client.upload_file(
                tmp.name,
                s3_bucket_name,
                s3_bucket_key,
                # Casting all the values under metadata to string
                ExtraArgs={"Metadata": {k: str(v) for k, v in metadata.items()}},
            )
        RecceCloud(token=self.github_token).update_github_pull_request_check(self.pr_info, metadata)
        return f"The state file is uploaded to ' s3://{s3_bucket_name}/{s3_bucket_key}'"

    def upload_state_to_cloud(self, state: RecceState) -> Union[str, None]:
        if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
            raise RecceException("Cannot get the pull request information from GitHub.")

        checks = state.checks

        metadata = {
            "total_checks": len(checks),
            "approved_checks": len([c for c in checks if c.is_checked]),
        }

        if self.cloud_options.get("host", "").startswith("s3://"):
            return self._upload_state_to_s3_bucket(state, metadata)
        else:
            return self._upload_state_to_recce_cloud(state, metadata)

    def _download_state_from_s3_bucket(self, filepath):
        import io

        import boto3

        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")
        s3_bucket_key = f"github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}"

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise RecceException(error_message)

        response = s3_client.get_object(Bucket=s3_bucket_name, Key=s3_bucket_key)
        byte_stream = io.BytesIO(response["Body"].read())
        gzip_io = file_io_factory(SupportedFileTypes.GZIP)
        decompressed_content = gzip_io.read_fileobj(byte_stream)

        dirs = os.path.dirname(filepath)
        if dirs:
            os.makedirs(dirs, exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(decompressed_content)

    def _download_state_from_recce_cloud(self, filepath):
        import io

        import requests

        presigned_url = RecceCloud(token=self.github_token).get_presigned_url_by_github_repo(
            method=PresignedUrlMethod.DOWNLOAD,
            repository=self.pr_info.repository,
            artifact_name=RECCE_STATE_COMPRESSED_FILE,
            pr_id=self.pr_info.id,
        )

        password = self.cloud_options.get("password")
        if password is None:
            raise RecceException(RECCE_CLOUD_PASSWORD_MISSING.error_message)

        headers = s3_sse_c_headers(password)
        response = requests.get(presigned_url, headers=headers)

        if response.status_code != 200:
            raise RecceException(
                f"{response.status_code} Failed to download the state file from Recce Cloud. The password could be wrong."
            )

        byte_stream = io.BytesIO(response.content)
        gzip_io = file_io_factory(SupportedFileTypes.GZIP)
        decompressed_content = gzip_io.read_fileobj(byte_stream)

        dirs = os.path.dirname(filepath)
        if dirs:
            os.makedirs(dirs, exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(decompressed_content)

    def download_state_from_cloud(self, filepath: str) -> Union[str, None]:
        if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
            raise RecceException("Cannot get the pull request information from GitHub.")

        if self.cloud_options.get("host", "").startswith("s3://"):
            logger.debug("Download state file from AWS S3 bucket...")
            return self._download_state_from_s3_bucket(filepath)
        else:
            logger.debug("Download state file from Recce Cloud...")
            return self._download_state_from_recce_cloud(filepath)

    def _purge_state_from_s3_bucket(self) -> (bool, str):
        import boto3
        from rich.console import Console

        console = Console()
        delete_objects = []
        logger.debug("Purging the state from AWS S3 bucket...")
        s3_client = boto3.client("s3")
        s3_bucket_name = self.cloud_options.get("host").replace("s3://", "")
        s3_key_prefix = f"github/{self.pr_info.repository}/pulls/{self.pr_info.id}/"
        list_response = s3_client.list_objects_v2(Bucket=s3_bucket_name, Prefix=s3_key_prefix)
        if "Contents" in list_response:
            for obj in list_response["Contents"]:
                key = obj["Key"]
                delete_objects.append({"Key": key})
                console.print(f"[green]Deleted[/green]: {key}")
        else:
            return False, "No state file found in the S3 bucket."

        delete_response = s3_client.delete_objects(Bucket=s3_bucket_name, Delete={"Objects": delete_objects})
        if "Deleted" not in delete_response:
            return False, "Failed to delete the state file from the S3 bucket."
        RecceCloud(token=self.github_token).update_github_pull_request_check(self.pr_info)
        return True, None

    def _purge_state_from_recce_cloud(self) -> (bool, str):
        try:
            RecceCloud(token=self.github_token).purge_artifacts(self.pr_info)
        except RecceCloudException as e:
            return False, e.reason
        return True, None

    def purge_cloud_state(self) -> (bool, str):
        if self.cloud_options.get("host", "").startswith("s3://"):
            return self._purge_state_from_s3_bucket()
        else:
            return self._purge_state_from_recce_cloud()


class RecceShareStateManager:
    error_message: str
    hint_message: str

    # It is a class to share state file on Recce Cloud.

    def __init__(self, auth_options: Optional[Dict[str, str]] = None):
        self.auth_options = auth_options or {}
        self.error_message = None
        self.hint_message = None

    def verify(self) -> bool:
        if get_recce_api_token() is None:
            self.error_message = RECCE_API_TOKEN_MISSING.error_message
            self.hint_message = RECCE_API_TOKEN_MISSING.hint_message
            return False
        return True

    @property
    def error_and_hint(self) -> (Union[str, None], Union[str, None]):
        return self.error_message, self.hint_message

    def share_state(self, file_name: str, state: RecceState) -> Dict:
        import tempfile

        with tempfile.NamedTemporaryFile() as tmp:
            state.to_file(tmp.name, file_type=SupportedFileTypes.FILE)
            response = RecceCloud(token=get_recce_api_token()).share_state(file_name, open(tmp.name, "rb"))
            return response
