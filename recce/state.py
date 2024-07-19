"""Define the type to serialize/de-serialize the state of the recce instance."""
import json
import logging
import os
import threading
import time
from base64 import b64encode
from datetime import datetime
from hashlib import md5, sha256
from typing import List, Optional, Dict, Union
from urllib.parse import urlencode

import botocore.exceptions
from pydantic import BaseModel
from pydantic import Field

from recce import get_version
from recce.git import current_branch
from recce.models import CheckDAO
from recce.models.types import Run, Check
from recce.pull_request import fetch_pr_metadata, PullRequestInfo
from recce.util.io import SupportedFileTypes, file_io_factory
from recce.util.pydantic_model import pydantic_model_json_dump, pydantic_model_dump
from recce.util.recce_cloud import RecceCloud, PresignedUrlMethod, RecceCloudException

logger = logging.getLogger('uvicorn')

RECCE_STATE_FILE = 'recce-state.json'
RECCE_STATE_COMPRESSED_FILE = f'{RECCE_STATE_FILE}.gz'


def s3_sse_c_headers(password: str) -> Dict[str, str]:
    hashed_password = sha256()
    md5_hash = md5()
    hashed_password.update(password.encode())
    md5_hash.update(hashed_password.digest())
    encoded_passwd = b64encode(hashed_password.digest()).decode('utf-8')
    encoded_md5 = b64encode(md5_hash.digest()).decode('utf-8')
    return {
        'x-amz-server-side-encryption-customer-algorithm': 'AES256',
        'x-amz-server-side-encryption-customer-key': encoded_passwd,
        'x-amz-server-side-encryption-customer-key-MD5': encoded_md5,
    }


def check_s3_bucket(bucket_name: str):
    import boto3
    s3_client = boto3.client('s3')
    try:
        s3_client.head_bucket(Bucket=bucket_name)
    except botocore.exceptions.ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == '404':
            return False, f"Bucket '{bucket_name}' does not exist."
        elif error_code == '403':
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
    schema_version: str = 'v0'
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
    runs: Optional[List[Run]] = None
    checks: Optional[List[Check]] = None
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
            if metadata.schema_version == 'v0':
                pass
            else:
                raise Exception(f"Unsupported state file version: {metadata.schema_version}")
        return state

    @staticmethod
    def from_file(file_path: str, file_type: SupportedFileTypes = SupportedFileTypes.FILE):
        """
        Load the state from a recce state file.
        """
        from pathlib import Path

        logger.debug(f"Load state file from: '{file_path}'")
        if not Path(file_path).is_file():
            raise FileNotFoundError(f"State file not found: {file_path}")

        io = file_io_factory(file_type)
        json_content = io.read(file_path)
        return RecceState.from_json(json_content)

    def to_json(self):
        return pydantic_model_json_dump(self)


class RecceStateLoader:
    def __init__(self,
                 review_mode: bool = False,
                 cloud_mode: bool = False,
                 state_file: Optional[str] = None,
                 cloud_options: Optional[Dict[str, str]] = None
                 ):
        self.review_mode = review_mode
        self.cloud_mode = cloud_mode
        self.state_file = state_file
        self.cloud_options = cloud_options or {}
        self.error_message = None
        self.hint_message = None
        self.state: RecceState | None = None
        self.state_lock = threading.Lock()
        self.pr_info = None

        if self.cloud_mode:
            if not self.cloud_options.get('token'):
                raise Exception('No GitHub token is provided to access the pull request information.')
            self.pr_info = fetch_pr_metadata(github_token=self.cloud_options.get('token'))
            if self.pr_info.id is None:
                raise Exception('Cannot get the pull request information from GitHub.')

        # Load the state
        self.load()

    def verify(self) -> bool:
        if self.cloud_mode:
            if self.cloud_options.get('token') is None:
                self.error_message = 'No token is provided to access Recce Cloud.'
                self.hint_message = 'Please provide a token in the command argument.'
                return False
            if not self.cloud_options.get('host'):
                if self.cloud_options.get('password') is None:
                    self.error_message = 'No password is provided to access the state file in Recce Cloud.'
                    self.hint_message = 'Please provide a password with the option "--password <compress-password>".'
                    return False
        else:
            if self.review_mode is True and self.state_file is None:
                self.error_message = 'Recce can not launch without a state file.'
                self.hint_message = 'Please provide a state file in the command argument.'
                return False
            pass
        return True

    @property
    def error_and_hint(self) -> (Union[str, None], Union[str, None]):
        return self.error_message, self.hint_message

    def __bool__(self):
        return self.state is not None

    def update(self, state: RecceState):
        self.state = state

    def load(self, refresh=False) -> RecceState:
        if self.state is not None and refresh is False:
            return self.state
        self.state_lock.acquire()
        try:
            if self.cloud_mode:
                self.state = self._load_state_from_cloud()
            else:
                self.state = self._load_state_from_file()
        finally:
            self.state_lock.release()
        return self.state

    def export(self, state: RecceState = None) -> Union[str, None]:
        if state is not None:
            self.update(state)
        # TODO: Export the current Recce state to file or cloud storage
        start_time = time.time()
        self.state_lock.acquire()
        try:
            if self.cloud_mode:
                message = self._export_state_to_cloud()
            else:
                if self.state_file is None:
                    return 'No state file is provided. Skip storing the state.'
                logger.info(f"Store recce state to '{self.state_file}'")
                message = self._export_state_to_file()
            end_time = time.time()
            elapsed_time = end_time - start_time
        finally:
            self.state_lock.release()
        logger.info(f'Store state completed in {elapsed_time:.2f} seconds')
        return message

    def refresh(self):
        new_state = self.load(refresh=True)
        return new_state

    def info(self):
        if self.state is None:
            self.error_message = 'No state is loaded.'
            return None

        state_info = {
            'mode': 'cloud' if self.cloud_mode else 'local',
            'source': None,
        }
        if self.cloud_mode:
            if self.cloud_options.get('host', '').startswith('s3://'):
                state_info['source'] = self.cloud_options.get('host')
            else:
                state_info['source'] = 'Recce Cloud'
            state_info['pull_request'] = self.pr_info
        else:
            state_info['source'] = self.state_file
        return state_info

    def purge(self) -> bool:
        if self.cloud_mode is True:
            host = self.cloud_options.get('host')
            token = self.cloud_options.get('token')
            rc, err_msg = RecceStateLoader.purge_cloud_state(token, self.pr_info, host)
            if err_msg:
                self.error_message = err_msg
            return rc
        else:
            if self.state_file is not None:
                try:
                    os.remove(self.state_file)
                except Exception as e:
                    self.error_message = f'Failed to remove the state file: {e}'
                    return False
            else:
                self.error_message = 'No state file is provided. Skip removing the state file.'
                return False

    @staticmethod
    def purge_cloud_state(token: str, pr_info: PullRequestInfo, host: str) -> (bool, str):
        if host.startswith('s3://'):
            return RecceStateLoader._purge_state_from_s3_bucket(token, pr_info, host)
        else:
            try:
                RecceCloud(token=token).purge_artifacts(pr_info)
            except RecceCloudException as e:
                return False, e.reason
            return True, None

    def _load_state_from_file(self, file_path: Optional[str] = None) -> RecceState:
        file_path = file_path or self.state_file
        return RecceState.from_file(file_path) if file_path else None

    def _load_state_from_cloud(self) -> RecceState:
        if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
            raise Exception('Cannot get the pull request information from GitHub.')

        if self.cloud_options.get('host', '').startswith('s3://'):
            logger.debug('Fetching state from AWS S3 bucket...')
            return self._load_state_from_s3_bucket()
        else:
            logger.debug('Fetching state from Recce Cloud...')
            return self._load_state_from_recce_cloud()

    def _load_state_from_recce_cloud(self) -> Union[RecceState, None]:
        import tempfile
        import requests

        presigned_url = RecceCloud(token=self.cloud_options.get('token')).get_presigned_url(
            method=PresignedUrlMethod.DOWNLOAD, pr_info=self.pr_info, artifact_name=RECCE_STATE_COMPRESSED_FILE)

        password = self.cloud_options.get('password')
        if password is None:
            raise Exception('No password is provided to access the state file in Recce Cloud.')

        with tempfile.NamedTemporaryFile() as tmp:
            headers = s3_sse_c_headers(password)
            response = requests.get(presigned_url,
                                    headers=headers)
            if response.status_code == 404:
                self.error_message = 'The state file is not found in Recce Cloud.'
                return None
            elif response.status_code != 200:
                self.error_message = response.text
                raise Exception(
                    f'{response.status_code} Failed to download the state file from Recce Cloud. The password could be wrong.')
            with open(tmp.name, 'wb') as f:
                f.write(response.content)
            return RecceState.from_file(tmp.name, file_type=SupportedFileTypes.GZIP)

    def _load_state_from_s3_bucket(self) -> Union[RecceState, None]:
        import boto3
        import tempfile
        s3_client = boto3.client('s3')
        s3_bucket_name = self.cloud_options.get('host').replace('s3://', '')
        s3_bucket_key = f'github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}'

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise Exception(error_message)

        with tempfile.NamedTemporaryFile() as tmp:
            try:
                s3_client.download_file(s3_bucket_name, s3_bucket_key, tmp.name)
            except botocore.exceptions.ClientError as e:
                error_code = e.response.get('Error', {}).get('Code')
                if error_code == '404':
                    self.error_message = 'The state file is not found in the S3 bucket.'
                    return None
                else:
                    raise e
            return RecceState.from_file(tmp.name, file_type=SupportedFileTypes.GZIP)

    def _export_state_to_cloud(self) -> Union[str, None]:
        if (self.pr_info is None) or (self.pr_info.id is None) or (self.pr_info.repository is None):
            raise Exception('Cannot get the pull request information from GitHub.')

        check_status = CheckDAO().status()
        metadata = {
            'total_checks': check_status.get('total', 0),
            'approved_checks': check_status.get('approved', 0),
        }

        if self.cloud_options.get('host', '').startswith('s3://'):
            logger.info("Store recce state to AWS S3 bucket")
            return self._export_state_to_s3_bucket(metadata=metadata)
        else:
            logger.info("Store recce state to Recce Cloud")
            return self._export_state_to_recce_cloud(metadata=metadata)

    def _export_state_to_recce_cloud(self, metadata: dict = None) -> Union[str, None]:
        import tempfile
        import requests

        presigned_url = RecceCloud(token=self.cloud_options.get('token')).get_presigned_url(
            method=PresignedUrlMethod.UPLOAD, pr_info=self.pr_info, artifact_name=RECCE_STATE_COMPRESSED_FILE,
            metadata=metadata)

        compress_passwd = self.cloud_options.get('password')
        headers = s3_sse_c_headers(compress_passwd)
        headers['x-amz-tagging'] = urlencode(metadata)
        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name, file_type=SupportedFileTypes.GZIP)
            response = requests.put(presigned_url, data=open(tmp.name, 'rb').read(), headers=headers)
            if response.status_code != 200:
                self.error_message = response.text
                return 'Failed to upload the state file to Recce Cloud. Reason: ' + response.text
        return 'The state file is uploaded to Recce Cloud.'

    def _export_state_to_s3_bucket(self, metadata: dict = None) -> Union[str, None]:
        import boto3
        import tempfile
        s3_client = boto3.client('s3')
        s3_bucket_name = self.cloud_options.get('host').replace('s3://', '')
        s3_bucket_key = f'github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}'

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise Exception(error_message)

        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name, file_type=SupportedFileTypes.GZIP)

            s3_client.upload_file(tmp.name, s3_bucket_name, s3_bucket_key,
                                  # Casting all the values under metadata to string
                                  ExtraArgs={'Metadata': {k: str(v) for k, v in metadata.items()}})
        RecceCloud(token=self.cloud_options.get('token')).update_github_pull_request_check(self.pr_info, metadata)
        return f'The state file is uploaded to \' s3://{s3_bucket_name}/{s3_bucket_key}\''

    def _get_artifact_metadata_from_s3_bucket(self, artifact_name: str) -> Union[dict, None]:
        import boto3
        s3_client = boto3.client('s3')
        s3_bucket_name = self.cloud_options.get('host').replace('s3://', '')
        s3_bucket_key = f'github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{artifact_name}'
        try:
            response = s3_client.head_object(Bucket=s3_bucket_name, Key=s3_bucket_key)
            metadata = response['Metadata']
            return metadata
        except botocore.exceptions.ClientError as e:
            self.error_message = e.response.get('Error', {}).get('Message')
            raise Exception('Failed to get artifact metadata from Recce Cloud.')

    def _export_state_to_file(self, file_path: Optional[str] = None,
                              file_type: SupportedFileTypes = SupportedFileTypes.FILE) -> str:
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """

        file_path = file_path or self.state_file
        json_data = self.state.to_json()
        io = file_io_factory(file_type)

        io.write(file_path, json_data)
        return f'The state file is stored at \'{file_path}\''

    @staticmethod
    def _purge_state_from_s3_bucket(token: str, pr_info: PullRequestInfo, s3_bucket: str) -> (bool, str):
        import boto3
        from rich.console import Console
        console = Console()
        delete_objects = []
        logger.debug('Purging the state from AWS S3 bucket...')
        s3_client = boto3.client('s3')
        s3_bucket_name = s3_bucket.replace('s3://', '')
        s3_key_prefix = f'github/{pr_info.repository}/pulls/{pr_info.id}/'
        list_response = s3_client.list_objects_v2(Bucket=s3_bucket_name, Prefix=s3_key_prefix)
        if 'Contents' in list_response:
            for obj in list_response['Contents']:
                key = obj['Key']
                delete_objects.append({'Key': key})
                console.print(f'[green]Deleted[/green]: {key}')
        else:
            return False, 'No state file found in the S3 bucket.'

        delete_response = s3_client.delete_objects(Bucket=s3_bucket_name, Delete={'Objects': delete_objects})
        if 'Deleted' not in delete_response:
            return False, 'Failed to delete the state file from the S3 bucket.'
        RecceCloud(token=token).update_github_pull_request_check(pr_info)
        return True, None
