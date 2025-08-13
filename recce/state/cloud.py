import logging
import os
from base64 import b64encode
from hashlib import md5, sha256
from typing import Dict, Optional, Union

import botocore.exceptions

from recce.exceptions import RecceException
from recce.pull_request import fetch_pr_metadata
from recce.util.io import SupportedFileTypes, file_io_factory
from recce.util.recce_cloud import PresignedUrlMethod, RecceCloud, RecceCloudException

from ..event import get_recce_api_token
from .const import (
    RECCE_API_TOKEN_MISSING,
    RECCE_CLOUD_PASSWORD_MISSING,
    RECCE_CLOUD_TOKEN_MISSING,
    RECCE_STATE_COMPRESSED_FILE,
)
from .state import RecceState

logger = logging.getLogger("uvicorn")


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
