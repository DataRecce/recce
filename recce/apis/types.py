import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Union
from uuid import UUID

from pandas import DataFrame


class RunType(Enum):
    SIMPLE = 'simple'
    QUERY = "query"
    QUERY_DIFF = 'query_diff'
    VALUE_DIFF = 'value_diff'
    SCHEMA_DIFF = 'schema_diff'
    PROFILE_DIFF = 'profile_diff'
    ROW_COUNT_DIFF = 'row_count_diff'

    def __str__(self):
        return self.value


class DataFrameDiff:
    def __init__(self):
        self.primary_keys: [str]
        self.base: DataFrame
        self.current: DataFrame


class RunResult:
    def __init__(self):
        self.data: Union[DataFrame, DataFrameDiff]


@dataclass
class Run:
    type: RunType
    params: Optional[dict] = None
    check_id: Optional[UUID] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    run_id: UUID = field(default_factory=uuid.uuid4)
    run_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class Check:
    name: str
    description: str
    type: RunType
    params: Optional[dict] = None
    check_id: UUID = field(default_factory=uuid.uuid4)
    is_checked: bool = False
