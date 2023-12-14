import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, Union
from uuid import UUID

from pandas import DataFrame


class RunType(Enum):
    QUERY_DIFF = 'query_diff'


class DataFrameDiff:
    def __init__(self):
        self.primary_keys: [str]
        self.base: DataFrame
        self.current: DataFrame


class RunResult:
    def __init__(self):
        self.data: Union[DataFrame, DataFrameDiff]


class Run:
    def __init__(self, run_type: RunType, params, check_id: Optional[UUID] = None, result: Optional[dict] = None):
        self.id: UUID = uuid.uuid4()
        self.run_at: str = datetime.utcnow().isoformat()
        self.check_id: Optional[UUID] = check_id
        self.type: RunType = run_type
        self.params = params
        self.result = result


class Check:
    def __init__(self, name, description, run_type, params):
        self.id: UUID = uuid.uuid4()
        self.name: str = name
        self.description: str = description
        self.type: RunType = run_type
        self.params = params
