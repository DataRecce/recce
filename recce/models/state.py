import json
import logging
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel

from .types import Run, Check

logger = logging.getLogger(__name__)


class RecceState(BaseModel):
    runs: List[Run] = []
    checks: List[Check] = []

    def to_json(self):
        return self.json()

    @classmethod
    def from_json(cls, json_data):
        dict_data = json.loads(json_data)
        return cls(**dict_data)

    def store(self, file_path):
        logger.info(f'Storing recce state to {file_path}')
        json_data = self.json()
        with open(file_path, 'w') as f:
            f.write(json_data)

    @classmethod
    def load(cls, file_path):
        from pathlib import Path

        logger.info(f'Loading recce state from {file_path}')
        if Path(file_path).is_file():
            with open(file_path, 'r') as f:
                json_data = f.read()
                return cls.from_json(json_data)


recce_state: Optional[RecceState] = None


def load_default_state(file_path=None):
    global recce_state
    if file_path and Path(file_path).is_file():
        recce_state = RecceState.load(file_path)
    else:
        recce_state = RecceState()


def default_recce_state():
    global recce_state
    if recce_state is None:
        load_default_state()
    return recce_state
