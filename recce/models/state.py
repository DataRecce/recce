import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field

from .types import Run, Check, Lineage
from .util import pydantic_model_json_dump
from .. import get_version

logger = logging.getLogger('uvicorn')


class RecceStateMetadata(BaseModel):
    schema_version: str = 'v0'
    recce_version: str = Field(default_factory=lambda: get_version())
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
    git_branch: Optional[str] = None
    github_pull_request_url: Optional[str] = None


class RecceState(BaseModel):
    metadata: Optional[RecceStateMetadata] = None
    runs: List[Run] = []
    checks: List[Check] = []
    lineage: Optional[Lineage] = None

    def store(self, file_path, file_type='json', **kwargs):
        self.metadata = RecceStateMetadata()
        start_time = time.time()
        logger.info(f"Store recce state to '{file_path}'")
        json_data = pydantic_model_json_dump(self)
        with open(file_path, 'w') as f:
            f.write(json_data)
        end_time = time.time()
        elapsed_time = end_time - start_time
        logger.info(f'Store state completed in {elapsed_time:.2f} seconds')

    @classmethod
    def load(cls, file_path):
        from pathlib import Path
        if not Path(file_path).is_file():
            raise Exception(f"State file not found: {file_path}")

        logger.info(f"Load state file from '{file_path}'")
        with open(file_path, 'r') as f:
            dict_data = json.loads(f.read())
            state = cls(**dict_data)

        metadata = state.metadata
        if metadata:
            # logger.info(metadata)
            if metadata.schema_version is None:
                pass
            if metadata.schema_version == 'v0':
                pass
            else:
                raise Exception(f"Unsupported state file version: {metadata.schema_version}")

        return state

    def export_state(self):
        self.metadata = RecceStateMetadata()
        return pydantic_model_json_dump(self)

    def import_state(self, content):
        import_state = RecceState.model_validate_json(content)
        current_check_ids = [str(c.check_id) for c in self.checks]
        current_run_ids = [str(r.run_id) for r in self.runs]

        # merge checks
        import_checks = 0
        for check in import_state.checks:
            if str(check.check_id) not in current_check_ids:
                self.checks.append(check)
                import_checks += 1

        # merge runs
        import_runs = 0
        for run in import_state.runs:
            if str(run.run_id) not in current_run_ids:
                self.runs.append(run)
                import_runs += 1

        self.runs.sort(key=lambda x: x.run_at)

        return import_runs, import_checks


recce_state: Optional[RecceState] = None


def load_default_state(file_path=None):
    global recce_state
    if file_path:
        logger.info(f"State file: '{file_path}'")
        if Path(file_path).is_file():
            recce_state = RecceState.load(file_path)
        else:
            recce_state = RecceState()
    else:
        recce_state = RecceState()
    return recce_state


def default_recce_state():
    global recce_state
    if recce_state is None:
        load_default_state()
    return recce_state
