import json
import logging
import time
from datetime import datetime
from typing import List, Optional

import pydantic.version
from pydantic import BaseModel
from pydantic import Field

from recce import get_version
from recce.git import current_branch
from recce.models import CheckDAO, RunDAO
from recce.models.check import load_checks
from recce.models.run import load_runs
from recce.models.types import Run, Check, Lineage

logger = logging.getLogger('uvicorn')


def pydantic_model_json_dump(model: BaseModel):
    pydantic_version = pydantic.version.VERSION
    pydantic_major = pydantic_version.split(".")[0]

    if pydantic_major == "1":
        return model.json(exclude_none=True)
    else:
        return model.model_dump_json(exclude_none=True)


class GitMetadata(BaseModel):
    branch: Optional[str] = None

    @staticmethod
    def from_current_repositroy():
        return GitMetadata(branch=current_branch())


class PullRequestMetadata(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    url: Optional[str] = None
    branch: Optional[str] = None
    base_branch: Optional[str] = None


class RecceStateMetadata(BaseModel):
    schema_version: str = 'v0'
    recce_version: str = Field(default_factory=lambda: get_version())
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
    pull_request: Optional[PullRequestMetadata] = None
    git: Optional[GitMetadata] = None


class RecceState(BaseModel):
    metadata: Optional[RecceStateMetadata] = None
    runs: Optional[List[Run]] = None
    checks: Optional[List[Check]] = None
    lineage: Optional[Lineage] = None

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
            dict_data = json.loads(f.read())
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


_loaded_state = None


def load_state(file_path):
    """
    Load the state from a recce state file.
    """
    state = RecceState.from_file(file_path)

    global _loaded_state
    _loaded_state = state
    load_runs(state.runs)
    load_checks(state.checks)


def loaded_state() -> RecceState:
    """
    The loaded state from the startup. In the review mode, this is used to get the lineage data in the state file.
    """
    return _loaded_state


def create_curr_state(no_runs_and_checks=False):
    from recce.dbt import default_dbt_context

    state = RecceState()
    state.metadata = RecceStateMetadata()
    state.metadata.git = GitMetadata.from_current_repositroy()

    # runs & checks
    if not no_runs_and_checks:
        state.runs = RunDAO().list()
        state.checks = CheckDAO().list()

    # lineage
    dbt_context = default_dbt_context()
    base = dbt_context.get_lineage(base=True)
    current = dbt_context.get_lineage(base=False)
    state.lineage = Lineage(
        base=base,
        current=current,
    )

    return state


def store_state(file_path):
    """
    Store the state to a file. Store happens when terminating the server or run instance.
    """
    state = create_curr_state()

    start_time = time.time()
    logger.info(f"Store recce state to '{file_path}'")
    json_data = pydantic_model_json_dump(state)
    with open(file_path, 'w') as f:
        f.write(json_data)
    end_time = time.time()
    elapsed_time = end_time - start_time
    logger.info(f'Store state completed in {elapsed_time:.2f} seconds')


def export_state():
    """
    Export the state to a JSON string
    """
    state = create_curr_state()
    return pydantic_model_json_dump(state)


def import_state(json_content):
    """
    Import the state from a JSON string.

    Unlike the load_state, this function will merge the checks and runs from the imported state. It would not affect the lineage data.
    """
    import_state = RecceState.model_validate_json(json_content)
    checks = CheckDAO().list()
    runs = RunDAO().list()
    current_check_ids = [str(c.check_id) for c in checks]
    current_run_ids = [str(r.run_id) for r in runs]

    # merge checks
    import_checks = 0
    for check in import_state.checks:
        if str(check.check_id) not in current_check_ids:
            checks.append(check)
            import_checks += 1

    # merge runs
    import_runs = 0
    for run in import_state.runs:
        if str(run.run_id) not in current_run_ids:
            runs.append(run)
            import_runs += 1

    runs.sort(key=lambda x: x.run_at)

    # Update to in-memory db
    load_runs(runs)
    load_checks(checks)

    return runs, checks
