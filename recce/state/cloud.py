import logging
import os
from base64 import b64encode
from hashlib import md5, sha256
from typing import Dict, Optional, Tuple, Union
from urllib.parse import urlencode

from recce.exceptions import RecceException
from recce.pull_request import fetch_pr_metadata
from recce.util.io import SupportedFileTypes, file_io_factory
from recce.util.recce_cloud import PresignedUrlMethod, RecceCloud, RecceCloudException

from ..event import get_recce_api_token
from ..models import CheckDAO
from .const import (
    RECCE_API_TOKEN_MISSING,
    RECCE_CLOUD_PASSWORD_MISSING,
    RECCE_CLOUD_TOKEN_MISSING,
    RECCE_STATE_COMPRESSED_FILE,
)
from .state import RecceState
from .state_loader import RecceStateLoader

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


class CloudStateLoader(RecceStateLoader):
    def __init__(
        self,
        review_mode: bool = False,
        cloud_options: Optional[Dict[str, str]] = None,
        initial_state: Optional[RecceState] = None,
    ):
        super().__init__(
            cloud_mode=True,
            review_mode=review_mode,
            cloud_options=cloud_options,
            initial_state=initial_state,
        )

    def verify(self) -> bool:
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
        return True

    def _load_state(self) -> Tuple[RecceState, str]:
        return self._load_state_from_cloud()

    def _export_state(self, state: RecceState = None) -> Union[str, None]:
        return self._export_state_to_cloud()

    def purge(self) -> bool:
        rc, err_msg = RecceCloudStateManager(self.cloud_options).purge_cloud_state()
        if err_msg:
            self.error_message = err_msg
        return rc

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
            from .cloud import s3_sse_c_headers

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

    def check_cloud_state_exists(self) -> bool:
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

    def upload_state_to_cloud(self, state: RecceState) -> Union[str, None]:
        if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
            raise RecceException("Cannot get the pull request information from GitHub.")

        checks = state.checks

        metadata = {
            "total_checks": len(checks),
            "approved_checks": len([c for c in checks if c.is_checked]),
        }

        return self._upload_state_to_recce_cloud(state, metadata)

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

        logger.debug("Download state file from Recce Cloud...")
        return self._download_state_from_recce_cloud(filepath)

    def _purge_state_from_recce_cloud(self) -> (bool, str):
        try:
            RecceCloud(token=self.github_token).purge_artifacts(self.pr_info)
        except RecceCloudException as e:
            return False, e.reason
        return True, None

    def purge_cloud_state(self) -> (bool, str):
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
