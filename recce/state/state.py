"""Define the type to serialize/de-serialize the state of the recce instance."""

import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from recce import get_version
from recce.exceptions import RecceException
from recce.git import current_branch
from recce.models.types import Check, Run
from recce.pull_request import PullRequestInfo
from recce.util.io import SupportedFileTypes, file_io_factory
from recce.util.pydantic_model import pydantic_model_dump, pydantic_model_json_dump

logger = logging.getLogger("uvicorn")


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
