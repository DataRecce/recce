"""Define the type to serialize/de-serialize the state of the recce instance."""
import json
import logging
import os
import tempfile
import threading
import time
from datetime import datetime
from typing import List, Optional, Dict, Union

import botocore.exceptions
from pydantic import BaseModel
from pydantic import Field

from recce import get_version
from recce.git import current_branch
from recce.models import CheckDAO
from recce.models.types import Run, Check
from recce.pull_request import fetch_pr_metadata, PullRequestInfo
from recce.util.pydantic_model import pydantic_model_json_dump, pydantic_model_dump

logger = logging.getLogger('uvicorn')

RECCE_CLOUD_API_HOST = os.environ.get('RECCE_CLOUD_API_HOST', 'https://staging.cloud.datarecce.io')
RECCE_STATE_FILE = 'recce-state.json'
RECCE_STATE_COMPRESSED_FILE = f'{RECCE_STATE_FILE}.zip'


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
    def from_file(file_path: str, compressed: bool = False, compress_passwd: str = None):
        """
        Load the state from a recce state file.
        """
        from pathlib import Path

        logger.debug(f"Load state file from: '{file_path}'")
        if not Path(file_path).is_file():
            raise FileNotFoundError(f"State file not found: {file_path}")

        if compressed:
            import pyminizip
            cwd = os.getcwd()
            try:
                with tempfile.TemporaryDirectory() as tmp_dir:
                    tmp_file = f'{tmp_dir}/{RECCE_STATE_FILE}'
                    pyminizip.uncompress(file_path, compress_passwd, tmp_dir, 0)
                    with open(tmp_file, 'r') as f:
                        json_content = f.read()
                    state = RecceState.from_json(json_content)
            except Exception as e:
                error_msg = str(e)
                if '-3' in error_msg:
                    raise Exception("Invalid password to uncompress state file.")
                raise Exception(f"Failed to uncompress state file: {error_msg}")
            finally:
                os.chdir(cwd)
        else:
            with open(file_path, 'r') as f:
                json_content = f.read()
                state = RecceState.from_json(json_content)

        return state

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
            if self.cloud_options.get('token'):
                self.pr_info = fetch_pr_metadata(github_token=self.cloud_options.get('token'))
            else:
                raise Exception('No GitHub token is provided to access the pull request information.')

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
            if self.cloud_options.get('host', '').startswith('s3://'):
                rc, err_msg = RecceStateLoader._purge_state_from_s3_bucket(self.cloud_options.get('host', ''),
                                                                           self.pr_info)
                if err_msg:
                    self.error_message = err_msg
                return rc
            else:
                rc, err_msg = RecceStateLoader.purge_cloud_state(self.cloud_options.get('token'), self.pr_info)
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
    def purge_cloud_state(host: str, pr_info: PullRequestInfo, token: str = None) -> (bool, str):
        if host.startswith('s3://'):
            return RecceStateLoader._purge_state_from_s3_bucket(host, pr_info)
        else:
            return RecceStateLoader._purge_state_from_cloud(token, pr_info)

    def _get_presigned_url(self, pr_info: PullRequestInfo, artifact_name: str, method: str = 'upload',
                           metadata: dict = None) -> str:
        import requests
        # Step 1: Get the token
        token = self.cloud_options.get('token')
        if token is None:
            raise Exception('No token is provided to access Recce Cloud.')

        # Step 2: Call Recce Cloud API to get presigned URL
        api_url = f'{RECCE_CLOUD_API_HOST}/api/v1/{pr_info.repository}/pulls/{pr_info.id}/artifacts/{method}?artifact_name={artifact_name}'
        headers = {
            'Authorization': f'Bearer {token}'
        }
        response = requests.post(api_url, headers=headers, json=metadata)
        if response.status_code != 200:
            self.error_message = response.text
            raise Exception('Failed to get presigned URL from Recce Cloud.')
        presigned_url = response.json().get('presigned_url')
        return presigned_url

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

        presigned_url = self._get_presigned_url(self.pr_info, RECCE_STATE_COMPRESSED_FILE, method='download')

        compress_passwd = self.cloud_options.get('password')
        with tempfile.NamedTemporaryFile() as tmp:
            response = requests.get(presigned_url)
            if response.status_code == 404:
                self.error_message = 'The state file is not found in Recce Cloud.'
                return None
            elif response.status_code != 200:
                self.error_message = response.text
                raise Exception(f'{response.status_code} Failed to download the state file from Recce Cloud.')
            with open(tmp.name, 'wb') as f:
                f.write(response.content)
            return RecceState.from_file(tmp.name, compressed=True, compress_passwd=compress_passwd)

    def _load_state_from_s3_bucket(self) -> Union[RecceState, None]:
        import boto3
        import tempfile
        s3_client = boto3.client('s3')
        s3_bucket_name = self.cloud_options.get('host').replace('s3://', '')
        s3_bucket_key = f'github/{self.pr_info.repository}/pulls/{self.pr_info.id}/{RECCE_STATE_COMPRESSED_FILE}'

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise Exception(error_message)

        compress_passwd = self.cloud_options.get('password')
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
            return RecceState.from_file(tmp.name, compressed=True, compress_passwd=compress_passwd)

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

        presigned_url = self._get_presigned_url(self.pr_info, RECCE_STATE_COMPRESSED_FILE, method='upload',
                                                metadata=metadata)
        compress_passwd = self.cloud_options.get('password')
        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name, compress=True, compress_passwd=compress_passwd)
            response = requests.put(presigned_url, data=open(tmp.name, 'rb').read())
            if response.status_code != 200:
                self.error_message = response.text
                return 'Failed to upload the state file to Recce Cloud.'
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

        compress_passwd = self.cloud_options.get('password')
        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name, compress=True, compress_passwd=compress_passwd)

            s3_client.upload_file(tmp.name, s3_bucket_name, s3_bucket_key,
                                  # Casting all the values under metadata to string
                                  ExtraArgs={'Metadata': {k: str(v) for k, v in metadata.items()}})
        return f'The state file is uploaded to \' s3://{s3_bucket_name}/{s3_bucket_key}\''

    def _get_artifact_metadata_from_recce_cloud(self, artifact_name: str) -> dict:
        import requests
        token = self.cloud_options.get('token')
        if token is None:
            raise Exception('No token is provided to access Recce Cloud.')
        api_url = f'{RECCE_CLOUD_API_HOST}/api/v1/{self.pr_info.repository}/pulls/{self.pr_info.id}/artifacts/{artifact_name}/metadata'
        headers = {
            'Authorization': f'Bearer {token}'
        }
        response = requests.get(api_url, headers=headers)
        if response.status_code != 200:
            self.error_message = response.text
            raise Exception('Failed to get artifact metadata from Recce Cloud.')
        return response.json()

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

    def _export_state_to_file(self, file_path: Optional[str] = None, compress: bool = False,
                              compress_passwd: str = None) -> str:
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """

        file_path = file_path or self.state_file
        json_data = self.state.to_json()
        if compress:
            import pyminizip
            cwd = os.getcwd()
            try:
                with tempfile.TemporaryDirectory() as tmp_dir:
                    tmp_file = f'{tmp_dir}/{RECCE_STATE_FILE}'
                    with open(tmp_file, 'w') as f:
                        f.write(json_data)
                    pyminizip.compress(tmp_file, None, file_path, compress_passwd, 9)
            finally:
                os.chdir(cwd)
            return f'The state file is stored at \'{file_path}\''
        else:
            with open(file_path, 'w') as f:
                f.write(json_data)
        return f'The state file is stored at \'{file_path}\''

    @staticmethod
    def _purge_state_from_cloud(token: str, pr_info: PullRequestInfo) -> (bool, str):
        import requests
        logger.debug('Purging the state from Recce Cloud...')
        token = token
        api_url = f'{RECCE_CLOUD_API_HOST}/api/v1/{pr_info.repository}/pulls/{pr_info.id}/artifacts'
        headers = {
            'Authorization': f'Bearer {token}'
        }
        response = requests.delete(api_url, headers=headers)
        if response.status_code != 204:
            return False, response.text
        return True, None

    @staticmethod
    def _purge_state_from_s3_bucket(host: str, pr_info: PullRequestInfo) -> (bool, str):
        import boto3
        from rich.console import Console
        console = Console()
        delete_objects = []
        logger.debug('Purging the state from AWS S3 bucket...')
        s3_client = boto3.client('s3')
        s3_bucket_name = host.replace('s3://', '')
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
        return True, None
