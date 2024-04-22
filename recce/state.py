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
