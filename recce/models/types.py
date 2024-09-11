import uuid
from datetime import datetime, timezone
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
    is_preset: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc).replace(microsecond=0))

    def merge(self, other) -> bool:
        if not self.is_preset and not other.is_preset and self.check_id != other.check_id:
            raise ValueError(f"check_id mismatch: {self.check_id} != {other.check_id}")

        if self.updated_at and other.updated_at and self.updated_at >= other.updated_at:
            return False

        self.name = other.name
        self.description = other.description
        self.type = other.type
        self.params = other.params
        self.view_options = other.view_options
        self.is_checked = other.is_checked
        self.is_preset = other.is_preset
        self.updated_at = other.updated_at
        return True


class Lineage(BaseModel):
    base: dict
    current: dict
