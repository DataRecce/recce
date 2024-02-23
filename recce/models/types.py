import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, UUID4, Field


class RunType(Enum):
    SIMPLE = 'simple'
    QUERY = "query"
    QUERY_DIFF = 'query_diff'
    VALUE_DIFF = 'value_diff'
    VALUE_DIFF_DETAIL = 'value_diff_detail'
    SCHEMA_DIFF = 'schema_diff'
    PROFILE_DIFF = 'profile_diff'
    ROW_COUNT_DIFF = 'row_count_diff'
    LINEAGE_DIFF = 'lineage_diff'
    TOP_K_DIFF = 'top_k_diff'
    HISTOGRAM_DIFF = 'histogram_diff'

    def __str__(self):
        return self.value


class RunProgress(BaseModel):
    message: str
    percentage: float


class Run(BaseModel):
    type: RunType
    params: Optional[dict] = None
    check_id: Optional[UUID4] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    progress: Optional[RunProgress] = None
    run_id: UUID4 = Field(default_factory=uuid.uuid4)
    run_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))


class Check(BaseModel):
    name: str
    description: str
    type: RunType
    params: Optional[dict] = None
    view_options: Optional[dict] = None
    check_id: UUID4 = Field(default_factory=uuid.uuid4)
    is_checked: bool = False
