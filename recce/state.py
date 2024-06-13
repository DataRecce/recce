"""Define the type to serialize/de-serialize the state of the recce instance."""

import json
import logging
import os
import time
from datetime import datetime
from typing import List, Optional, Dict, Union

import botocore.exceptions
import pydantic.version
from pydantic import BaseModel
from pydantic import Field

from recce import get_version
from recce.git import current_branch
from recce.models.types import Run, Check

logger = logging.getLogger('uvicorn')

RECCE_CLOUD_API_HOST = os.environ.get('RECCE_CLOUD_API_HOST', 'https://staging.cloud.datarecce.io')


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


def pydantic_model_json_dump(model: BaseModel):
    pydantic_version = pydantic.version.VERSION
    pydantic_major = pydantic_version.split(".")[0]

    if pydantic_major == "1":
        return model.json(exclude_none=True)
    else:
        return model.model_dump_json(exclude_none=True)


def pydantic_model_dump(model: BaseModel):
    pydantic_version = pydantic.version.VERSION
    pydantic_major = pydantic_version.split(".")[0]

    if pydantic_major == "1":
        return model.dict()
    else:
        return model.model_dump()


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


class PullRequestInfo(BaseModel):
    id: Optional[Union[int, str]] = None
    title: Optional[str] = None
    url: Optional[str] = None
    branch: Optional[str] = None
    base_branch: Optional[str] = None
    repository: Optional[str] = None

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
    def from_file(file_path: str):
        """
        Load the state from a recce state file.
        """
        from pathlib import Path

        logger.debug(f"Load state file from: '{file_path}'")
        if not Path(file_path).is_file():
            raise FileNotFoundError(f"State file not found: {file_path}")

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

        # Load the state
        self.load()

    def verify(self) -> bool:
        if self.cloud_mode:
            pass
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

    def load(self) -> RecceState:
        if self.state is not None:
            return self.state

        if self.cloud_mode:
            self.state = self._load_state_from_cloud()
        else:
            self.state = self._load_state_from_file()
        return self.state

    def export(self, state: RecceState = None) -> Union[str, None]:
        if state is not None:
            self.update(state)
        # TODO: Export the current Recce state to file or cloud storage
        start_time = time.time()
        if self.cloud_mode:
            message = self._export_state_to_cloud()
        else:
            if self.state_file is None:
                return 'No state file is provided. Skip storing the state.'
            logger.info(f"Store recce state to '{self.state_file}'")
            message = self._export_state_to_file()
        end_time = time.time()
        elapsed_time = end_time - start_time
        logger.info(f'Store state completed in {elapsed_time:.2f} seconds')
        return message

    def _get_presigned_url(self, pr_info: PullRequestInfo, artifact_name: str, method: str = 'upload') -> str:
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
        response = requests.post(api_url, headers=headers)
        if response.status_code != 200:
            self.error_message = response.text
            raise Exception('Failed to get presigned URL from Recce Cloud.')
        presigned_url = response.json().get('presigned_url')
        return presigned_url

    def _load_state_from_file(self, file_path: Optional[str] = None) -> RecceState:
        file_path = file_path or self.state_file
        return RecceState.from_file(file_path) if file_path else None

    def _load_state_from_cloud(self) -> RecceState:
        from recce.pull_request import fetch_pr_metadata
        pr_info = fetch_pr_metadata(github_token=self.cloud_options.get('token'))
        if (pr_info.id is None) or (pr_info.repository is None):
            raise Exception('Cannot get the pull request information from GitHub.')

        if self.cloud_options.get('host', '').startswith('s3://'):
            logger.debug('Fetching state from AWS S3 bucket...')
            return self._load_state_from_s3_bucket(pr_info)
        else:
            logger.debug('Fetching state from Recce Cloud...')
            return self._load_state_from_recce_cloud(pr_info)

    def _load_state_from_recce_cloud(self, pr_info) -> Union[RecceState, None]:
        import tempfile
        import requests
        presigned_url = self._get_presigned_url(pr_info, 'recce-state.json', method='download')

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
            return RecceState.from_file(tmp.name)

    def _load_state_from_s3_bucket(self, pr_info) -> Union[RecceState, None]:
        import boto3
        import tempfile
        s3_client = boto3.client('s3')
        s3_bucket_name = self.cloud_options.get('host').replace('s3://', '')
        s3_bucket_key = f'github/{pr_info.repository}/pulls/{pr_info.id}/recce-state.json'

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
            return RecceState.from_file(tmp.name)

    def _export_state_to_cloud(self) -> Union[str, None]:
        from recce.pull_request import fetch_pr_metadata
        pr_info = fetch_pr_metadata(github_token=self.cloud_options.get('token'))
        if (pr_info.id is None) or (pr_info.repository is None):
            raise Exception('Cannot get the pull request information from GitHub.')

        if self.cloud_options.get('host', '').startswith('s3://'):
            logger.info("Store recce state to AWS S3 bucket")
            return self._export_state_to_s3_bucket(pr_info)
        else:
            logger.info("Store recce state to Recce Cloud")
            return self._export_state_to_recce_cloud(pr_info)

    def _export_state_to_recce_cloud(self, pr_info) -> Union[str, None]:
        import tempfile
        import requests

        presigned_url = self._get_presigned_url(pr_info, 'recce-state.json', method='upload')
        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name)
            response = requests.put(presigned_url, data=open(tmp.name, 'rb').read())
            if response.status_code != 200:
                self.error_message = response.text
                return 'Failed to upload the state file to Recce Cloud.'
        return 'The state file is uploaded to Recce Cloud.'

    def _export_state_to_s3_bucket(self, pr_info) -> Union[str, None]:
        import boto3
        import tempfile
        s3_client = boto3.client('s3')
        s3_bucket_name = self.cloud_options.get('host').replace('s3://', '')
        s3_bucket_key = f'github/{pr_info.repository}/pulls/{pr_info.id}/recce-state.json'

        rc, error_message = check_s3_bucket(s3_bucket_name)
        if rc is False:
            raise Exception(error_message)

        with tempfile.NamedTemporaryFile() as tmp:
            self._export_state_to_file(tmp.name)
            s3_client.upload_file(tmp.name, s3_bucket_name, s3_bucket_key)
        return f'The state file is uploaded to \' s3://{s3_bucket_name}/{s3_bucket_key}\''

    def _export_state_to_file(self, file_path: Optional[str] = None):
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """

        file_path = file_path or self.state_file
        json_data = self.state.to_json()
        with open(file_path, 'w') as f:
            f.write(json_data)
        return f'The state file is stored at \'{file_path}\''
