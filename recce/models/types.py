import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Set

from pydantic import UUID4, BaseModel, ConfigDict, Field, field_validator

from recce.util.pydantic_model import pydantic_model_dump


class RunType(Enum):
    SIMPLE = "simple"
    QUERY = "query"
    QUERY_BASE = "query_base"
    QUERY_DIFF = "query_diff"
    VALUE_DIFF = "value_diff"
    VALUE_DIFF_DETAIL = "value_diff_detail"
    SCHEMA_DIFF = "schema_diff"
    PROFILE = "profile"
    PROFILE_DIFF = "profile_diff"
    ROW_COUNT = "row_count"
    ROW_COUNT_DIFF = "row_count_diff"
    LINEAGE_DIFF = "lineage_diff"
    TOP_K_DIFF = "top_k_diff"
    HISTOGRAM_DIFF = "histogram_diff"
    PROFILE_DISTRIBUTION = "profile_distribution"

    def __str__(self):
        return self.value


class RunProgress(BaseModel):
    message: str
    percentage: float


class RunStatus(Enum):
    FINISHED = "Finished"
    FAILED = "Failed"
    CANCELLED = "Cancelled"
    RUNNING = "Running"


class Run(BaseModel):
    type: RunType
    name: Optional[str] = None
    params: Optional[dict] = None
    check_id: Optional[UUID4] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    status: Optional[RunStatus] = None
    progress: Optional[RunProgress] = None
    run_id: UUID4 = Field(default_factory=uuid.uuid4)
    run_at: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
    triggered_by: Optional[Literal["user", "recce_ai"]] = None  # who triggered the run

    def __init__(self, **data):
        # Normalize status for backward compatibility (lowercase -> capitalized)
        if "status" in data and data["status"] is not None:
            status = data["status"]
            if isinstance(status, str) and status not in [s.value for s in RunStatus]:
                status_map = {
                    "finished": "Finished",
                    "failed": "Failed",
                    "cancelled": "Cancelled",
                    "running": "Running",
                }
                data["status"] = status_map.get(status, status)

        type = data.get("type")

        if "result" in data and data["result"] is not None:
            result = data.get("result")

            if type in [RunType.QUERY.value, RunType.QUERY_BASE.value]:
                from recce.tasks.query import QueryResult

                data["result"] = pydantic_model_dump(QueryResult(**result))
            elif type == RunType.QUERY_DIFF.value:
                from recce.tasks.query import QueryDiffResult

                data["result"] = pydantic_model_dump(QueryDiffResult(**result))
            elif type == RunType.PROFILE.value:
                from recce.tasks.profile import ProfileResult

                data["result"] = pydantic_model_dump(ProfileResult(**result))
            elif type == RunType.PROFILE_DIFF.value:
                from recce.tasks.profile import ProfileDiffResult

                data["result"] = pydantic_model_dump(ProfileDiffResult(**result))
            elif type == RunType.VALUE_DIFF.value:
                from recce.tasks.valuediff import ValueDiffResult

                data["result"] = pydantic_model_dump(ValueDiffResult(**result))
            elif type == RunType.VALUE_DIFF_DETAIL.value:
                from recce.tasks.valuediff import ValueDiffDetailResult

                data["result"] = pydantic_model_dump(ValueDiffDetailResult(**result))

        super().__init__(**data)


class Check(BaseModel):
    name: str
    description: Optional[str] = None
    type: RunType
    params: Optional[dict] = {}
    view_options: Optional[dict] = {}
    check_id: UUID4 = Field(default_factory=uuid.uuid4)
    session_id: Optional[UUID4] = Field(default=None)
    is_checked: bool = False
    is_preset: bool = False
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
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


ChangeStatus = Literal[
    "added",
    "removed",
    "modified",
    "unknown",
]
# DEPRECATED 2026-05-25: legacy vocabulary; removal target <next release>.
# New vocab: model_wide/column/additive. See DRC-3553.
# During the aliasing window the wire/enum values stay legacy; the v2 vocabulary
# is accepted on input and emitted opt-in via `Accept-Vocabulary: v2`. See
# recce.util.change_classifier for the alias map and normalizer.
ChangeCategory = Literal[
    "breaking",
    "non_breaking",
    "partial_breaking",
    "unknown",
]

# DRC-3553: dual-vocabulary aliasing window. The wire/enum values stay LEGACY
# (above) during this deprecation window; the v2 vocabulary
# (model_wide / column / additive / unknown) is accepted on input and emitted
# opt-in via `Accept-Vocabulary: v2`. These maps live here (the low-level
# models module) so recce.util.change_classifier can re-export them without a
# circular import.
#
# legacy wire value -> v2 vocabulary value
CHANGE_CATEGORY_ALIASES: dict[str, str] = {
    "breaking": "model_wide",
    "partial_breaking": "column",
    "non_breaking": "additive",
    "unknown": "unknown",
}

# v2 vocabulary value -> legacy wire value (inverse of CHANGE_CATEGORY_ALIASES)
CHANGE_CATEGORY_ALIASES_INVERSE: dict[str, str] = {v: k for k, v in CHANGE_CATEGORY_ALIASES.items()}


def normalize_change_category(value: str) -> str:
    """Normalize a change-category label to its canonical LEGACY wire value.

    Accepts EITHER vocabulary:
      - legacy: breaking / non_breaking / partial_breaking / unknown
      - v2:     model_wide / column / additive / unknown

    Returns the legacy wire value so that, e.g.,
    ``normalize_change_category("breaking") == normalize_change_category("model_wide")``.

    Unknown/unrecognized labels are returned unchanged so callers can decide
    how strictly to validate (forward-compat: don't hard-fail on a label a
    future vocabulary introduces).
    """
    if value in CHANGE_CATEGORY_ALIASES:
        # Already a legacy value.
        return value
    if value in CHANGE_CATEGORY_ALIASES_INVERSE:
        # A v2 value; map back to legacy.
        return CHANGE_CATEGORY_ALIASES_INVERSE[value]
    return value


def to_v2_change_category(value: str) -> str:
    """Map a change-category label to its v2 vocabulary value.

    Accepts either vocabulary (normalized to legacy first) and returns the v2
    label (model_wide / column / additive / unknown). Unrecognized labels are
    returned unchanged. Used by the opt-in ``Accept-Vocabulary: v2`` output path.
    """
    legacy = normalize_change_category(value)
    return CHANGE_CATEGORY_ALIASES.get(legacy, legacy)


class NodeChange(BaseModel):
    category: ChangeCategory
    columns: Optional[dict[str, ChangeStatus]] = None

    @field_validator("category", mode="before")
    @classmethod
    def _normalize_category(cls, value):
        # DRC-3553: accept either vocabulary on input (legacy or v2) and store
        # the canonical legacy wire value. Keeps the model forward-compatible
        # with v2-emitting producers during the aliasing window.
        if isinstance(value, str):
            return normalize_change_category(value)
        return value


class NodeDiff(BaseModel):
    change_status: ChangeStatus
    change: Optional[NodeChange] = None  # Only available if change_status is 'modified'


class LineageDiff(BaseModel):
    base: dict
    current: dict
    diff: dict[str, NodeDiff]


class MergedNode(BaseModel):
    """A single node in the merged lineage wire-format response.

    Uses exclude_none so unchanged nodes omit change_status/change.
    Uses by_alias so schema_name serializes as "schema".
    Uses extra="ignore" so **source unpacking from lineage dicts works.
    """

    name: str
    resource_type: str
    package_name: str = ""
    schema_name: str | None = Field(None, alias="schema")
    materialized: str | None = None
    tags: list[str] | None = None
    source_name: str | None = None
    change_status: ChangeStatus | None = None
    change: NodeChange | None = None

    model_config = ConfigDict(
        populate_by_name=True,
        extra="ignore",
    )


class MergedEdge(BaseModel):
    """A single edge in the merged lineage wire-format response."""

    source: str
    target: str
    change_status: Literal["added", "removed"] | None = None  # edges are never "modified"


class MergedLineage(BaseModel):
    """Top-level merged lineage object returned by /api/info."""

    nodes: dict[str, MergedNode]
    edges: list[MergedEdge]
    metadata: dict[str, Any]


# Column Level Linage
class CllColumnDep(BaseModel):
    node: str
    column: str


class CllColumn(BaseModel):
    id: Optional[str] = None
    table_id: Optional[str] = None
    name: Optional[str] = None

    # data type
    type: Optional[str] = None

    # transformation type
    transformation_type: Literal["source", "passthrough", "renamed", "derived", "unknown"] = "unknown"

    # change analysis
    change_status: Optional[ChangeStatus] = None

    # column-to-column dependencies
    depends_on: List[CllColumnDep] = Field(default_factory=list)


class CllNode(BaseModel):
    id: str
    name: str
    package_name: str
    resource_type: str
    # raw_code is populated from the manifest for server-side CLL computation
    # (see DbtAdapter.get_cll_cached) but is excluded from serialization — no
    # frontend consumer reads it off a CLL-sourced node, and it bloats the
    # /api/cll payload significantly.
    raw_code: Optional[str] = Field(default=None, exclude=True)
    source_name: Optional[str] = None

    # change analysis
    change_status: Optional[ChangeStatus] = None
    change_category: Optional[ChangeCategory] = None

    # Column to column dependencies
    columns: Dict[str, CllColumn] = Field(default_factory=dict)

    @field_validator("change_category", mode="before")
    @classmethod
    def _normalize_change_category(cls, value):
        # DRC-3553: accept either vocabulary on input (legacy or v2).
        if isinstance(value, str):
            return normalize_change_category(value)
        return value

    # If the node is impacted. Only used if option 'change_analysis' is set
    impacted: Optional[bool] = None

    @classmethod
    def build_cll_node(cls, manifest, resource_key, node_id) -> Optional["CllNode"]:
        resources = getattr(manifest, resource_key)
        if node_id not in resources:
            return None
        n = resources[node_id]
        if resource_key == "nodes" and n.resource_type not in ["model", "seed", "snapshot"]:
            return None
        cll_node = CllNode(
            id=n.unique_id,
            name=n.name,
            package_name=n.package_name,
            resource_type=n.resource_type,
        )
        if resource_key == "sources":
            cll_node.source_name = n.source_name
        elif resource_key == "nodes":
            cll_node.raw_code = n.raw_code
        return cll_node


class CllData(BaseModel):
    nodes: Dict[str, CllNode] = Field(default_factory=dict)
    columns: Dict[str, CllColumn] = Field(default_factory=dict)
    parent_map: Dict[str, Set[str]] = Field(default_factory=dict)
    child_map: Dict[str, Set[str]] = Field(default_factory=dict)
