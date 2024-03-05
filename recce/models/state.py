import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field

from .types import Run, Check
from .. import get_version

logger = logging.getLogger('uvicorn')


class RecceStateMetadata(BaseModel):
    schema_version: str = 'v0'
    recce_version: str = Field(default_factory=lambda: get_version())
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))


class RecceState(BaseModel):
    metadata: Optional[RecceStateMetadata] = None
    runs: List[Run] = []
    checks: List[Check] = []

    def store(self, file_path):
        self.metadata = RecceStateMetadata()
        start_time = time.time()
        logger.info(f"Store recce state to '{file_path}'")
        json_data = self.model_dump_json()
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


def default_recce_state():
    global recce_state
    if recce_state is None:
        load_default_state()
    return recce_state
