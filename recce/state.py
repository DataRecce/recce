"""Define the type to serialize/de-serialize the state of the recce instance."""

import json
import logging
import time
from datetime import datetime
from typing import List, Optional, Dict, Union

import pydantic.version
from pydantic import BaseModel
from pydantic import Field

from recce import get_version
from recce.git import current_branch
from recce.models.types import Run, Check

logger = logging.getLogger('uvicorn')


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

        logger.info(f"State file: '{file_path}'")
        if not Path(file_path).is_file():
            raise FileNotFoundError(f"State file not found: {file_path}")

        with open(file_path, 'r') as f:
            json_content = f.read()
            state = RecceState.from_json(json_content)

        return state

    def to_json(self):
        return pydantic_model_json_dump(self)

    # TODO: Deprecated
    def to_state_file(self, file_path: str):
        """
        Store the state to a file. Store happens when terminating the server or run instance.
        """
        start_time = time.time()
        logger.info(f"Store recce state to '{file_path}'")
        json_data = self.to_json()
        with open(file_path, 'w') as f:
            f.write(json_data)
        end_time = time.time()
        elapsed_time = end_time - start_time
        logger.info(f'Store state completed in {elapsed_time:.2f} seconds')


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
        self.cloud_options = cloud_options
        self.error_message = None
        self.hint_message = None
        self.state: RecceState | None = None

        # Load the state
        self.load()

        pass

    def verify(self) -> bool:
        if self.cloud_mode:
            pass
        else:
            if self.review_mode is True and self.state_file is None:
                self.error_message = 'Cannot launch server in review mode without a state file.'
                self.hint_message = 'Please provide a state file in the command argument.'
                return False
            pass
        return True

    @property
    def error_and_hint(self) -> (str | None, str | None):
        return self.error_message, self.hint_message

    def __bool__(self):
        return self.state is not None

    def update(self, state: RecceState):
        self.state = state

    def load(self) -> RecceState:
        try:
            if self.cloud_mode:
                # TODO: Load the state from cloud storage
                pass
            else:
                self.state = RecceState.from_file(self.state_file)
        except Exception:
            pass
        return self.state

    def export(self, state: RecceState = None):
        if state is not None:
            self.update(state)
        # TODO: Export the current Recce state to file or cloud storage
        if self.cloud_mode:
            self._export_state_to_cloud()
        else:
            self._export_state_to_file()

    def _export_state_to_cloud(self):
        # TODO: export the state to remote cloud storage
        print('TODO: export the state to remote cloud storage')
        print(f"        remote host: {self.cloud_options.get('host')}")
        pass

    def _export_state_to_recce_cloud(self):
        pass

    def _export_state_to_s3_bucket(self):
        pass

    def _export_state_to_file(self):
        """
                Store the state to a file. Store happens when terminating the server or run instance.
                """
        start_time = time.time()
        logger.info(f"Store recce state to '{self.state_file}'")
        json_data = self.state.to_json()
        with open(self.state_file, 'w') as f:
            f.write(json_data)
        end_time = time.time()
        elapsed_time = end_time - start_time
        logger.info(f'Store state completed in {elapsed_time:.2f} seconds')
