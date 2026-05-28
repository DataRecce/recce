"""Widget-enabled MCP server for Recce — parallel process to recce/mcp_server.py.

Spun up via `recce mcp-widget-server` CLI subcommand. Internally instantiates a
RecceMCPServer and delegates widget-tool calls to its existing `_tool_<name>`
methods (no logic duplication).

Coordination with `recce mcp-server`: see WIDGET_TOOLS in recce/mcp_server.py.
When RECCE_MCP_WIDGETS=1, mcp-server omits these tools from list_tools and this
widget server serves them with `_meta.ui.resourceUri` widget metadata.
"""

import importlib.resources
import logging
import sys
from typing import Any, Dict, List, Optional, Union

from mcp.server.fastmcp import FastMCP
from mcp.types import CallToolResult, TextContent
from pydantic import BaseModel, Field

mcp = FastMCP("recce-widgets")

# Forward ref — initialized in run_widget_server() to avoid eager import at module load.
_recce_server: Optional[Any] = None

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Pydantic output models
# ---------------------------------------------------------------------------


class RowCountMeta(BaseModel):
    status: str  # "ok" | "table_not_found" | "permission_denied" | etc.
    message: Optional[str] = None


class RowCountModel(BaseModel):
    base: Optional[int] = None
    curr: Optional[int] = None
    base_meta: RowCountMeta
    curr_meta: RowCountMeta


class RowCountDiffOutput(BaseModel):
    models: Dict[str, RowCountModel]
    warning: Optional[str] = None  # from single-env mode


class SchemaChange(BaseModel):
    added: List[Dict[str, str]]  # [{"name": ..., "type": ...}]
    removed: List[Dict[str, str]]
    type_changed: List[Dict[str, str]]  # [{"name": ..., "base_type": ..., "curr_type": ...}]
    unchanged_count: int


class SchemaDiffOutput(BaseModel):
    models: Dict[str, SchemaChange]


class GitInfo(BaseModel):
    """Git branch / SHA snapshot embedded in server info."""

    branch: Optional[str] = None
    base_branch: Optional[str] = None
    base_sha: Optional[str] = None
    current_sha: Optional[str] = None


class PullRequestInfo(BaseModel):
    """Pull-request metadata embedded in server info."""

    id: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None


class ServerInfoOutput(BaseModel):
    """Output model for the get_server_info widget tool.

    Fields mirror the dict returned by RecceMCPServer._tool_get_server_info.
    All fields are optional / have defaults because the handler may omit them
    in cloud mode or when the state_loader is absent.
    """

    mode: str = "local"  # "local" | "cloud" | "none"
    adapter_type: Optional[str] = None
    review_mode: Optional[bool] = None
    support_tasks: Optional[Dict[str, bool]] = None
    single_env: bool = False
    base_status: Optional[str] = None  # "fresh"|"stale_time"|"stale_sha"|"missing"|"single_env"|"unknown"
    git: Optional[GitInfo] = None
    pull_request: Optional[PullRequestInfo] = None


# ---------------------------------------------------------------------------
# Pydantic input models
# ---------------------------------------------------------------------------


class RowCountDiffInput(BaseModel):
    node_names: Optional[List[str]] = Field(
        default=None,
        description="Explicit dbt model names to check (mutually exclusive with select/exclude)",
    )
    node_ids: Optional[List[str]] = Field(
        default=None,
        description="Explicit dbt node IDs to check",
    )
    select: Optional[str] = Field(
        default=None,
        description="dbt selector syntax (e.g. 'state:modified+', 'customers orders')",
    )
    exclude: Optional[str] = Field(
        default=None,
        description="dbt selector syntax for exclusion",
    )


class SchemaDiffInput(BaseModel):
    select: Optional[str] = Field(
        default=None,
        description="dbt selector syntax (e.g. 'state:modified+', '1+state:modified')",
    )
    exclude: Optional[str] = Field(
        default=None,
        description="dbt selector syntax for exclusion",
    )
    packages: Optional[List[str]] = Field(
        default=None,
        description="Restrict to specific dbt packages by name",
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _read_widget_html(name: str) -> str:
    """Read widget HTML from recce/data/mcp/{name}.html, returning an error stub if missing."""
    try:
        ref = importlib.resources.files("recce.data.mcp") / f"{name}.html"
        return ref.read_text(encoding="utf-8")
    except (FileNotFoundError, TypeError, ModuleNotFoundError):
        return f"<html><body>Widget asset missing: {name}.html. Run pnpm run build.</body></html>"


# ---------------------------------------------------------------------------
# row_count_diff widget tool + resource
# ---------------------------------------------------------------------------


@mcp.tool(
    name="row_count_diff",
    annotations={
        "title": "Row Count Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/row_count_diff.html"},
        "ui/resourceUri": "ui://recce/row_count_diff.html",
    },
)
async def row_count_diff(args: RowCountDiffInput) -> CallToolResult:
    """Compare row counts between base and current dbt environments for specified models.

    Returns structured per-model results with status information. Rendered in
    an interactive widget; the agent should not summarize or reproduce the data
    as a text table.

    Args:
        node_names: Explicit model names (e.g. ["customers", "orders"])
        node_ids: Explicit dbt node IDs
        select: dbt selector syntax (e.g. "state:modified+", "1+state:modified")
        exclude: dbt selector for exclusion
        (use either explicit names/ids OR selector syntax, not both)

    Returns:
        CallToolResult with structuredContent: RowCountDiffOutput shape
        {models: {<name>: {base, curr, base_meta, curr_meta}}, warning?: str}

    Use when:
        - User asks "did row counts change", "regression check on counts"
        - PR review needs row count diff across models
    Don't use when:
        - Schema (column) changes — use schema_diff instead
        - SQL output comparison — use query_diff
        - Single environment without target-base — server warns about
          single-env mode but returns no useful comparison

    Error Handling:
        - table_not_found / permission_denied surface in *_meta.status
        - tool raises only on fundamental dbt/adapter failures
    """
    result = await _recce_server._tool_row_count_diff(args.model_dump(exclude_none=True))
    # Extract warning that single-env mode injects as _warning key
    warning = result.pop("_warning", None) if isinstance(result, dict) else None
    output = RowCountDiffOutput(
        models={name: RowCountModel(**v) for name, v in result.items()},
        warning=warning,
    )
    return CallToolResult(
        content=[TextContent(type="text", text="Row count diff rendered in widget.")],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/row_count_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def row_count_diff_resource() -> str:
    return _read_widget_html("row_count_diff")


# ---------------------------------------------------------------------------
# schema_diff widget tool + resource
# ---------------------------------------------------------------------------


@mcp.tool(
    name="schema_diff",
    annotations={
        "title": "Schema Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/schema_diff.html"},
        "ui/resourceUri": "ui://recce/schema_diff.html",
    },
)
async def schema_diff(args: SchemaDiffInput) -> CallToolResult:
    """Get the schema diff (column changes) between base and current dbt environments.

    Shows added, removed, and type-changed columns per model, rendered in an
    interactive widget. The agent should not reproduce the table data as plain text.

    Args:
        select: dbt selector syntax (e.g. "state:modified+", "customers orders")
        exclude: dbt selector for exclusion
        packages: restrict to specific dbt packages by name

    Returns:
        CallToolResult with structuredContent: SchemaDiffOutput shape
        {models: {<node_id>: {added, removed, type_changed, unchanged_count}}}

    Use when:
        - User asks "what columns changed", "schema diff", "any new/removed columns"
        - PR review needs to confirm no unintended column renames/removals
    Don't use when:
        - Row count changes — use row_count_diff instead
        - SQL output comparison — use query_diff
        - Single environment has no comparison target (tool will return empty diff)

    Error Handling:
        - tool raises on lineage_diff / context failure
        - empty models dict means no schema changes detected in the selected scope
    """
    lineage_diff = _recce_server.context.get_lineage_diff().model_dump(mode="json")
    rich_result = _recce_server._compute_schema_changes(
        lineage_diff,
        select=args.select,
        exclude=args.exclude,
        packages=args.packages if args.packages is not None else None,
    )
    output = SchemaDiffOutput(
        models={node_id: SchemaChange(**m) for node_id, m in rich_result.items()},
    )
    return CallToolResult(
        content=[TextContent(type="text", text="Schema diff rendered in widget.")],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/schema_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def schema_diff_resource() -> str:
    return _read_widget_html("schema_diff")


# ---------------------------------------------------------------------------
# get_server_info widget tool + resource
# ---------------------------------------------------------------------------


@mcp.tool(
    name="get_server_info",
    annotations={
        "title": "Server Info (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/get_server_info.html"},
        "ui/resourceUri": "ui://recce/get_server_info.html",
    },
)
async def get_server_info() -> CallToolResult:
    """Get Recce server runtime info and configuration state.

    Returns server mode, adapter type, single-env flag, base artifacts
    freshness status, and optional git/PR context. Rendered as a status
    widget; the agent should not summarize the data as text.

    Args: none

    Returns:
        CallToolResult with structuredContent: ServerInfoOutput shape
        {mode, adapter_type, review_mode, support_tasks, single_env,
         base_status, git?, pull_request?}

    Use when:
        - User asks "is recce configured / what's the server state?"
        - Debugging "why isn't this tool working" — base_status reveals
          stale or missing artifacts; mode shows which backend is active.
    Don't use when:
        - User wants to CHANGE backend — use set_backend instead
        - User wants tool list — use the MCP host's tool enumeration
    """
    result = await _recce_server._tool_get_server_info({})
    output = ServerInfoOutput(**result)
    return CallToolResult(
        content=[TextContent(type="text", text="Server info rendered in widget.")],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/get_server_info.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def get_server_info_resource() -> str:
    return _read_widget_html("get_server_info")


# ---------------------------------------------------------------------------
# list_checks widget tool + resource
# ---------------------------------------------------------------------------


class CheckSummary(BaseModel):
    """Minimal shape of one saved Recce check as returned by _tool_list_checks."""

    check_id: str
    name: str
    type: str  # check type slug, e.g. "row_count_diff", "schema_diff"
    description: str = ""
    is_checked: bool = False
    is_preset: bool = False
    # params intentionally omitted — widget shows name/type/status/description only


class ListChecksOutput(BaseModel):
    """Output model for the list_checks widget tool.

    Fields mirror the dict returned by RecceMCPServer._tool_list_checks plus
    derived counts computed in the widget delegate.
    """

    checks: List[CheckSummary]
    total: int
    approved: int
    pending: int


@mcp.tool(
    name="list_checks",
    annotations={
        "title": "Checks (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/list_checks.html"},
        "ui/resourceUri": "ui://recce/list_checks.html",
    },
)
async def list_checks() -> CallToolResult:
    """List all saved Recce checks for this session.

    Returns a summary card (total / approved / pending) plus a status table
    of every check. Rendered as an interactive widget; the agent should not
    reproduce the table as plain text.

    Args: none (lists every check saved in the current session)

    Returns:
        CallToolResult with structuredContent: ListChecksOutput shape
        {checks: [{check_id, name, type, description, is_checked, is_preset}],
         total: int, approved: int, pending: int}

    Use when:
        - User asks "what checks are saved" / "what's been validated"
        - Reviewing sign-off status before merging a PR
        - Checking whether the current session has any pending validations
    Don't use when:
        - User wants to RUN a check — use run_check instead
        - User wants to CREATE a check — use create_check instead
        - Server not configured — call get_server_info first
    """
    raw = await _recce_server._tool_list_checks({})
    checks = [CheckSummary(**c) for c in raw.get("checks", [])]
    total = raw.get("total", len(checks))
    approved = raw.get("approved", sum(1 for c in checks if c.is_checked))
    pending = total - approved
    output = ListChecksOutput(
        checks=checks,
        total=total,
        approved=approved,
        pending=pending,
    )
    n = len(checks)
    return CallToolResult(
        content=[TextContent(type="text", text=f"List of {n} check{'s' if n != 1 else ''} rendered in widget.")],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/list_checks.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def list_checks_resource() -> str:
    return _read_widget_html("list_checks")


# ---------------------------------------------------------------------------
# get_model widget tool + resource
# ---------------------------------------------------------------------------


class ColumnInfo(BaseModel):
    """Shape of one column entry in a get_model response."""

    name: str
    type: Optional[str] = None
    not_null: bool = False
    unique: bool = False


class ModelEnvironment(BaseModel):
    """Column details for one environment (base or current).

    ``columns`` is stored as a dict keyed by column name in the raw handler
    response.  The widget server normalises it to a list so the HTML can
    iterate without Object.values() gymnastics.
    """

    columns: List[ColumnInfo] = []
    primary_key: Optional[str] = None
    # raw_code intentionally omitted — widget shows schema, not SQL source


class GetModelOutput(BaseModel):
    """Output model for the get_model widget tool.

    ``model_id`` echoes back the requested identifier for the widget header.
    ``base`` / ``current`` hold per-environment column details.  Either may be
    None when the model exists in only one environment or is not found at all.
    ``not_found`` is True only when neither environment has the model.
    """

    model_id: str
    base: Optional[ModelEnvironment] = None
    current: Optional[ModelEnvironment] = None
    not_found: bool = False


class GetModelInput(BaseModel):
    model_id: str = Field(
        description=(
            "The dbt unique node ID of the model "
            "(e.g. 'model.jaffle_shop.customers').  "
            "Use the full unique ID, not just the model name."
        )
    )


def _parse_model_env(raw: Optional[dict]) -> Optional[ModelEnvironment]:
    """Convert raw get_model environment dict → ModelEnvironment Pydantic model.

    The raw dict has ``columns`` as a nested dict keyed by column name.
    Each value is ``{name, type, not_null?, unique?}``.  We normalise to a list
    so the widget HTML can iterate in order.
    """
    if not raw:
        return None
    raw_cols: dict = raw.get("columns") or {}
    columns = []
    for col_name, col_data in raw_cols.items():
        columns.append(
            ColumnInfo(
                name=col_data.get("name", col_name),
                type=col_data.get("type"),
                not_null=col_data.get("not_null", False),
                unique=col_data.get("unique", False),
            )
        )
    return ModelEnvironment(
        columns=columns,
        primary_key=raw.get("primary_key"),
    )


@mcp.tool(
    name="get_model",
    annotations={
        "title": "Model Detail (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/get_model.html"},
        "ui/resourceUri": "ui://recce/get_model.html",
    },
)
async def get_model(args: GetModelInput) -> CallToolResult:
    """Get column details for a single dbt model from base and current environments.

    Returns schema information (column names, types, constraints) rendered
    as a model-detail card widget. The agent should not reproduce the column
    table as plain text — the widget handles rendering.

    Args:
        model_id: Full dbt unique node ID (e.g. 'model.jaffle_shop.customers').
                  Use the full ID, not just the short model name.

    Returns:
        CallToolResult with structuredContent: GetModelOutput shape
        {model_id, base: {columns, primary_key}?, current: {columns, primary_key}?,
         not_found: bool}

    Use when:
        - User asks "what columns does {model} have" / "schema of {model}"
        - Need to verify column types or constraints before running a diff
        - Comparing base vs current column layout for a single model
    Don't use when:
        - User wants column CHANGES across models — use schema_diff instead
        - User wants ALL models — use lineage_diff for DAG scope
        - Modifying anything — get_model is read-only
    """
    raw = await _recce_server._tool_get_model({"model_id": args.model_id})
    # _tool_get_model returns {"model": {"base": {...}, "current": {...}}}
    # It raises ValueError if neither env has the model, so raw is always a dict here.
    model_data = raw.get("model", {}) if isinstance(raw, dict) else {}
    base_raw = model_data.get("base")
    curr_raw = model_data.get("current")
    base_env = _parse_model_env(base_raw if isinstance(base_raw, dict) else None)
    curr_env = _parse_model_env(curr_raw if isinstance(curr_raw, dict) else None)
    not_found = base_env is None and curr_env is None
    output = GetModelOutput(
        model_id=args.model_id,
        base=base_env,
        current=curr_env,
        not_found=not_found,
    )
    short = (
        f"Model '{args.model_id}' detail rendered in widget."
        if not not_found
        else f"Model '{args.model_id}' not found."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=short)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/get_model.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def get_model_resource() -> str:
    return _read_widget_html("get_model")


# ---------------------------------------------------------------------------
# query widget tool + resource
# ---------------------------------------------------------------------------


class QueryColumnInfo(BaseModel):
    """Shape of one column in a DataFrame result (from DataFrameColumn.model_dump)."""

    key: Optional[str] = None
    name: str
    type: str  # DataFrameColumnType enum value: "integer", "text", "number", "boolean",
    #            "date", "datetime", "timedelta", "unknown"


class QueryOutput(BaseModel):
    """Output model for the query widget tool.

    Fields mirror DataFrame.model_dump(mode='json') output, with sql_template
    echoed back for context in the empty-state and debug display.
    """

    columns: List[QueryColumnInfo]
    data: List[List[Any]]
    limit: Optional[int] = None
    more: Optional[bool] = None
    total_row_count: Optional[int] = None
    sql_template: Optional[str] = None  # echoed from input for widget header/empty-state


class QueryInput(BaseModel):
    sql_template: str = Field(
        ...,
        description=(
            "SQL query with optional Jinja templating. "
            "Use {{ ref('model_name') }} for dbt model references and other dbt macros."
        ),
    )
    base: bool = Field(
        default=False,
        description="If true, query the base environment (target-base); else current (target). Default false.",
    )


@mcp.tool(
    name="query",
    annotations={
        "title": "Query Result (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # queries hit the warehouse (external I/O)
    },
    meta={
        "ui": {"resourceUri": "ui://recce/query.html"},
        "ui/resourceUri": "ui://recce/query.html",
    },
)
async def query(args: QueryInput) -> CallToolResult:
    """Execute an ad-hoc SQL query against the dbt environment.

    Returns a scrollable result-table widget with type-aware cell rendering.
    The agent should not reproduce the table data as plain text — the widget
    handles rendering.

    Args:
        sql_template: SQL with Jinja (e.g. "SELECT count(*) FROM {{ ref('customers') }}")
        base: If true, target base environment (target-base manifest); else current. Default false.

    Returns:
        CallToolResult with structuredContent: QueryOutput shape
        {columns: [{key, name, type}], data: [[...]], limit?, more?,
         total_row_count?, sql_template}

    Use when:
        - User asks "run SQL: ..." or "query the warehouse for ..."
        - Need ad-hoc data extraction (no pre-built check type covers it)
        - Validating a hypothesis about specific values in the database
    Don't use when:
        - User wants row counts → use row_count_diff
        - User wants column-level diff → use value_diff
        - User wants the schema (columns/types) → use get_model or schema_diff
        - User wants to compare base vs current → use query_diff
    """
    raw = await _recce_server._tool_query(args.model_dump())
    # raw is DataFrame.model_dump(mode='json') — shape confirmed from source:
    # {columns: [{key, name, type}], data: [[...]], limit?, more?, total_row_count?}
    columns = [QueryColumnInfo(**c) for c in raw.get("columns", [])]
    output = QueryOutput(
        columns=columns,
        data=raw.get("data", []),
        limit=raw.get("limit"),
        more=raw.get("more"),
        total_row_count=raw.get("total_row_count"),
        sql_template=args.sql_template,
    )
    n_rows = len(output.data)
    n_cols = len(output.columns)
    text = f"Query result ({n_rows} row{'s' if n_rows != 1 else ''} × {n_cols} col{'s' if n_cols != 1 else ''}) rendered in widget."
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/query.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def query_resource() -> str:
    return _read_widget_html("query")


# ---------------------------------------------------------------------------
# value_diff widget tool + resource
# ---------------------------------------------------------------------------


class ValueDiffColumnRow(BaseModel):
    """Per-column match statistics as returned from ValueDiffResult.data rows.

    ValueDiffTask returns a DataFrame with columns ["column", "matched", "matched_p"].
    Each row encodes one model column's match stats:
        column:    str   — the column name
        matched:   int   — count of matched (identical) rows across common rows
        matched_p: float — fraction 0.0–1.0 of common rows that matched (None if common==0)
    """

    column: str
    matched: int = 0
    matched_p: Optional[float] = None  # 0.0–1.0; None when total common rows == 0


class ValueDiffSummary(BaseModel):
    """Aggregate row statistics from ValueDiffResult.summary."""

    total: int = 0  # total rows seen (union of base + current via PK join)
    added: int = 0  # rows in current only (PK absent in base)
    removed: int = 0  # rows in base only (PK absent in current)


class ValueDiffOutput(BaseModel):
    """Output model for the value_diff widget tool.

    Mirrors ValueDiffResult.model_dump(mode='json') after normalisation:
      - summary: {total, added, removed}
      - columns: per-column match stats extracted from data.data rows
      - model: echoed from input for widget header
      - primary_key: echoed from input (str or list)
      - warning: extracted from _warning key (single-env mode notice)
    """

    model: str
    primary_key: Optional[Union[str, List[str]]] = None
    summary: ValueDiffSummary
    columns: List[ValueDiffColumnRow]
    warning: Optional[str] = None


class ValueDiffInput(BaseModel):
    model: str = Field(..., description="dbt model name to compare (e.g. 'customers')")
    primary_key: Union[str, List[str]] = Field(
        ...,
        description=(
            "Primary key column(s) for row matching. "
            "Use a string for a single column (e.g. 'id'), "
            "or a list for a composite key (e.g. ['order_id', 'line_id'])."
        ),
    )
    columns: Optional[List[str]] = Field(
        default=None,
        description="Columns to compare (default: all common columns between base and current)",
    )


@mcp.tool(
    name="value_diff",
    annotations={
        "title": "Value Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # executes queries against the warehouse
    },
    meta={
        "ui": {"resourceUri": "ui://recce/value_diff.html"},
        "ui/resourceUri": "ui://recce/value_diff.html",
    },
)
async def value_diff(args: ValueDiffInput) -> CallToolResult:
    """Compare row-level values between base and current environments using primary key matching.

    Returns aggregate summary (total / added / removed rows) and per-column match
    statistics rendered as a widget. The agent should not reproduce the column
    breakdown as plain text — the widget handles rendering.

    Args:
        model: dbt model name (e.g. 'customers')
        primary_key: column(s) to match rows on; str for single col, list for composite key
        columns: optional subset of columns to compare (default: all common columns)

    Returns:
        CallToolResult with structuredContent: ValueDiffOutput shape
        {model, primary_key, summary: {total, added, removed},
         columns: [{column, matched, matched_p}], warning?}

    Use when:
        - User asks "are values consistent" / "did values shift" for a known model
        - PR review needs row-level value validation after a schema_diff shows no changes
        - Verifying data quality impact after a model refactor
    Don't use when:
        - Need row-level detail (which exact rows mismatched) → value_diff_detail
        - Schema changed → schema_diff first to see column additions/removals
        - No primary key available → query_diff with primary_keys param instead
        - Single-environment only — tool warns but returns no useful comparison
    """
    raw = await _recce_server._tool_value_diff(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None

    # Extract summary from raw dict
    raw_summary = raw.get("summary", {}) if isinstance(raw, dict) else {}
    summary = ValueDiffSummary(
        total=raw_summary.get("total", 0),
        added=raw_summary.get("added", 0),
        removed=raw_summary.get("removed", 0),
    )

    # Extract per-column rows from data.data (list of [col_name, matched_count, matched_p])
    raw_data = raw.get("data", {}) if isinstance(raw, dict) else {}
    data_rows = raw_data.get("data", []) if isinstance(raw_data, dict) else []
    columns_out: List[ValueDiffColumnRow] = []
    for row in data_rows:
        if not isinstance(row, (list, tuple)) or len(row) < 3:
            continue
        col_name, matched_count, matched_p = row[0], row[1], row[2]
        columns_out.append(
            ValueDiffColumnRow(
                column=str(col_name),
                matched=int(matched_count) if matched_count is not None else 0,
                matched_p=float(matched_p) if matched_p is not None else None,
            )
        )

    output = ValueDiffOutput(
        model=args.model,
        primary_key=args.primary_key,
        summary=summary,
        columns=columns_out,
        warning=warning,
    )

    n_cols = len(columns_out)
    mismatched = [c for c in columns_out if c.matched_p is not None and c.matched_p < 1.0]
    text = (
        f"Value diff for '{args.model}': {summary.total} rows compared, "
        f"{len(mismatched)} of {n_cols} column{'s' if n_cols != 1 else ''} have mismatches. "
        "Rendered in widget."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/value_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def value_diff_resource() -> str:
    return _read_widget_html("value_diff")


# ---------------------------------------------------------------------------
# value_diff_detail widget tool + resource
# ---------------------------------------------------------------------------


class ValueDiffDetailOutput(BaseModel):
    """Output model for the value_diff_detail widget tool.

    ValueDiffDetailTask.execute() returns ValueDiffDetailResult(DataFrame).
    After model_dump(mode='json') it becomes a standard DataFrame dict:
      {columns: [{key, name, type}], data: [[...]], limit, more, total_row_count}

    Columns include all data columns PLUS 'in_a' and 'in_b' boolean flags.
    Rows where in_a=True, in_b=False are "removed" (only in base).
    Rows where in_a=False, in_b=True are "added" (only in current).
    (Both true cannot occur — only differing rows are returned.)

    primary_key and model are echoed from input for the widget header.
    """

    model: str
    primary_key: Optional[Union[str, List[str]]] = None
    columns: List[QueryColumnInfo]
    data: List[List[Any]]
    limit: Optional[int] = None
    more: Optional[bool] = None
    total_row_count: Optional[int] = None
    warning: Optional[str] = None  # from _maybe_add_single_env_warning


class ValueDiffDetailInput(BaseModel):
    model: str = Field(..., description="dbt model name to inspect (e.g. 'customers')")
    primary_key: Union[str, List[str]] = Field(
        ...,
        description=(
            "Primary key column(s) for row matching. "
            "Use a string for a single column (e.g. 'id'), "
            "or a list for a composite key (e.g. ['order_id', 'line_id'])."
        ),
    )
    columns: Optional[List[str]] = Field(
        default=None,
        description="Columns to inspect (default: all common columns between base and current)",
    )


@mcp.tool(
    name="value_diff_detail",
    annotations={
        "title": "Value Diff Detail (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # executes queries against the warehouse
    },
    meta={
        "ui": {"resourceUri": "ui://recce/value_diff_detail.html"},
        "ui/resourceUri": "ui://recce/value_diff_detail.html",
    },
)
async def value_diff_detail(args: ValueDiffDetailInput) -> CallToolResult:
    """Show per-row detail of value differences (actual mismatched rows).

    Companion to value_diff (which shows aggregate stats). Returns the actual
    rows with mismatched values, rendered as a scrollable table with filter
    pills (All / Removed / Added). The agent should not enumerate the row list
    as plain text — the widget handles rendering.

    The result DataFrame columns include all data columns plus 'in_a' and
    'in_b' boolean flags (in_a=True, in_b=False → "removed"; in_a=False,
    in_b=True → "added"). Rows are capped at 1000 by the underlying task SQL.

    Args:
        model: dbt model name (e.g. 'customers')
        primary_key: column(s) to match rows on; str for single col, list for composite key
        columns: optional subset of columns to compare (default: all common columns)

    Returns:
        CallToolResult with structuredContent: ValueDiffDetailOutput shape
        {model, primary_key, columns: [{key, name, type}], data: [[...]], limit?,
         more?, total_row_count?, warning?}

    Use when:
        - User asks "which rows changed" / "show me the actual mismatches"
        - Investigating specific records flagged by value_diff
        - PR review needs row-level evidence of data changes
    Don't use when:
        - User wants aggregate stats → value_diff (faster, no row data)
        - Need full row comparison without primary key → query_diff instead
        - Single-environment only — tool warns but returns no useful comparison
    """
    raw = await _recce_server._tool_value_diff_detail(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None
    columns = [QueryColumnInfo(**c) for c in (raw.get("columns") or [])]
    output = ValueDiffDetailOutput(
        model=args.model,
        primary_key=args.primary_key,
        columns=columns,
        data=raw.get("data") or [],
        limit=raw.get("limit"),
        more=raw.get("more"),
        total_row_count=raw.get("total_row_count"),
        warning=warning,
    )
    n_rows = len(output.data)
    # Classify rows by in_a/in_b to build a human-readable summary
    in_a_idx = next((i for i, c in enumerate(columns) if c.name == "in_a"), None)
    in_b_idx = next((i for i, c in enumerate(columns) if c.name == "in_b"), None)
    if in_a_idx is not None and in_b_idx is not None:
        removed = sum(
            1
            for row in output.data
            if len(row) > max(in_a_idx, in_b_idx)
            and (row[in_a_idx] is True or row[in_a_idx] == 1)
            and not (row[in_b_idx] is True or row[in_b_idx] == 1)
        )
        added = sum(
            1
            for row in output.data
            if len(row) > max(in_a_idx, in_b_idx)
            and not (row[in_a_idx] is True or row[in_a_idx] == 1)
            and (row[in_b_idx] is True or row[in_b_idx] == 1)
        )
        text = (
            f"Value diff detail for '{args.model}': "
            f"{n_rows} differing row{'s' if n_rows != 1 else ''} "
            f"(+{added} added, -{removed} removed). Rendered in widget."
        )
    else:
        text = f"Value diff detail for '{args.model}': {n_rows} row{'s' if n_rows != 1 else ''} rendered in widget."
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/value_diff_detail.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def value_diff_detail_resource() -> str:
    return _read_widget_html("value_diff_detail")


# ---------------------------------------------------------------------------
# query_diff widget tool + resource
# ---------------------------------------------------------------------------


class QueryDiffInput(BaseModel):
    sql_template: str = Field(
        ...,
        description=(
            "SQL query with optional Jinja templating. "
            "Use {{ ref('model_name') }} for dbt model references. "
            "Runs against BOTH base and current environments (or produces a join diff when primary_keys supplied)."
        ),
    )
    base_sql_template: Optional[str] = Field(
        default=None,
        description="Alternative SQL template to run on the base environment (defaults to sql_template).",
    )
    primary_keys: Optional[List[str]] = Field(
        default=None,
        description=(
            "List of primary key column names for row-level join diff. "
            "When provided, the tool runs a set-based diff (INTERSECT / EXCEPT) and returns rows "
            "that differ between base and current, each tagged with in_a / in_b flags. "
            "When omitted, both base and current result sets are returned side-by-side."
        ),
    )


class QueryDiffDataFrame(BaseModel):
    """Serialised DataFrame — mirrors DataFrame.model_dump(mode='json')."""

    columns: List[QueryColumnInfo]
    data: List[List[Any]]
    limit: Optional[int] = None
    more: Optional[bool] = None
    total_row_count: Optional[int] = None


class QueryDiffOutput(BaseModel):
    """Output model for the query_diff widget tool.

    QueryDiffTask.execute() returns a QueryDiffResult with two possible shapes:

    Shape A — side-by-side (no primary_keys):
        base: DataFrame, current: DataFrame, diff: None

    Shape B — join diff (primary_keys provided):
        base: None, current: None, diff: DataFrame
        The diff DataFrame includes all data columns plus 'in_a' and 'in_b'
        boolean columns. Only rows that differ are included.

    The widget renders both shapes; JS logic checks which fields are present.
    sql_template is echoed from input for use in the widget header / empty-state.
    """

    base: Optional[QueryDiffDataFrame] = None
    current: Optional[QueryDiffDataFrame] = None
    diff: Optional[QueryDiffDataFrame] = None
    sql_template: Optional[str] = None  # echoed from input
    warning: Optional[str] = None  # from _maybe_add_single_env_warning


def _parse_dataframe(raw: Optional[dict]) -> Optional[QueryDiffDataFrame]:
    """Convert a DataFrame.model_dump(mode='json') dict → QueryDiffDataFrame.

    Returns None when raw is None/empty so callers can check presence.
    """
    if not raw:
        return None
    columns = [QueryColumnInfo(**c) for c in raw.get("columns", [])]
    return QueryDiffDataFrame(
        columns=columns,
        data=raw.get("data", []),
        limit=raw.get("limit"),
        more=raw.get("more"),
        total_row_count=raw.get("total_row_count"),
    )


@mcp.tool(
    name="query_diff",
    annotations={
        "title": "Query Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # queries hit the warehouse (external I/O)
    },
    meta={
        "ui": {"resourceUri": "ui://recce/query_diff.html"},
        "ui/resourceUri": "ui://recce/query_diff.html",
    },
)
async def query_diff(args: QueryDiffInput) -> CallToolResult:
    """Run a SQL query against BOTH base and current environments and compare results.

    Returns a comparison widget. The agent should not reproduce the comparison as
    plain text — the widget handles rendering.

    Two comparison modes depending on whether primary_keys is supplied:

    Side-by-side mode (no primary_keys):
        Executes sql_template against base and current independently.
        Returns two parallel result tables (base / current) displayed side-by-side.

    Join diff mode (primary_keys provided):
        Runs a set-based SQL diff (INTERSECT / EXCEPT) to find rows that differ.
        Returns a single table of differing rows tagged with in_a (in base) and
        in_b (in current) boolean flags.  Only changed rows are included.

    Args:
        sql_template: SQL with Jinja (e.g. "SELECT * FROM {{ ref('customers') }}")
        base_sql_template: Optional alternative SQL for the base env; defaults to sql_template.
        primary_keys: Column names to use as join keys for row-level diff (optional).

    Returns:
        CallToolResult with structuredContent: QueryDiffOutput shape
        Side-by-side: {base: {columns, data, ...}, current: {columns, data, ...}, diff: null, sql_template, warning?}
        Join diff: {base: null, current: null, diff: {columns, data, ...}, sql_template, warning?}

    Use when:
        - User asks "compare base vs current for this SQL"
        - Investigating whether a dbt model change altered output values
        - Row-level comparison with known primary key columns
    Don't use when:
        - Single environment only — use query instead
        - Schema (column) changes — use schema_diff
        - Row count only — use row_count_diff
    """
    raw = await _recce_server._tool_query_diff(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None
    output = QueryDiffOutput(
        base=_parse_dataframe(raw.get("base") if isinstance(raw, dict) else None),
        current=_parse_dataframe(raw.get("current") if isinstance(raw, dict) else None),
        diff=_parse_dataframe(raw.get("diff") if isinstance(raw, dict) else None),
        sql_template=args.sql_template,
        warning=warning,
    )
    # Build a short descriptive text based on which shape was returned
    if output.diff is not None:
        n = len(output.diff.data)
        text = f"Query diff ({n} differing row{'s' if n != 1 else ''}) rendered in widget."
    elif output.base is not None or output.current is not None:
        base_n = len(output.base.data) if output.base else 0
        curr_n = len(output.current.data) if output.current else 0
        text = f"Query diff (base: {base_n} row{'s' if base_n != 1 else ''}, current: {curr_n} row{'s' if curr_n != 1 else ''}) rendered in widget."
    else:
        text = "Query diff rendered in widget."
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/query_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def query_diff_resource() -> str:
    return _read_widget_html("query_diff")


# ---------------------------------------------------------------------------
# top_k_diff widget tool + resource
# ---------------------------------------------------------------------------


class TopKDiffInput(BaseModel):
    model: str = Field(..., description="dbt model name to analyze (e.g. 'customers')")
    column_name: str = Field(..., description="Column name to get top-K most frequent values for")
    k: Optional[int] = Field(
        default=None,
        description="Number of top values to return (default: 10)",
    )


class TopKEnvStats(BaseModel):
    """Per-environment aggregate stats for the top-K diff.

    TopKDiffTask.execute() returns parallel lists:
      values: List[str|None]  — category labels (same order for base + current)
      counts: List[int]       — occurrence count for THIS environment
      valids: int             — count of non-null rows in THIS environment
      total:  int             — total rows in THIS environment
    """

    values: List[Optional[str]] = []  # category labels (None means original null)
    counts: List[int] = []  # count per category in this env
    valids: int = 0  # non-null row count
    total: int = 0  # total row count (including nulls)


class TopKDiffOutput(BaseModel):
    """Output model for the top_k_diff widget tool.

    Mirrors TopKDiffTask.execute() return shape after _warning extraction:
      base:    {values, counts, valids, total}
      current: {values, counts, valids, total}

    Note: values[] is the same list in both envs (union of top-K by curr_count desc,
    base_count desc). counts[] are specific to each environment.

    model, column_name, k are echoed from input for the widget header.
    warning is extracted from _warning key (single-env mode notice).
    """

    model: str
    column_name: str
    k: int = 10
    base: TopKEnvStats
    current: TopKEnvStats
    warning: Optional[str] = None


@mcp.tool(
    name="top_k_diff",
    annotations={
        "title": "Top-K Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # executes queries against the warehouse
    },
    meta={
        "ui": {"resourceUri": "ui://recce/top_k_diff.html"},
        "ui/resourceUri": "ui://recce/top_k_diff.html",
    },
)
async def top_k_diff(args: TopKDiffInput) -> CallToolResult:
    """Compare the top-K most frequent values of a column across base and current environments.

    Surfaces shifts in value distribution: new dominant values, retired values,
    and count changes. Rendered as a side-by-side ranked list with inline bars.
    The agent should not reproduce the ranked list as plain text — the widget
    handles rendering.

    Top-K is computed as a SQL FULL OUTER JOIN of the top-K by current count
    (desc) then base count (desc), so the same category list is shown for both
    environments. Categories absent from one env show a count of 0.

    Args:
        model: dbt model name (e.g. 'customers')
        column_name: categorical column to analyze (e.g. 'status')
        k: number of top values to return (default: 10)

    Returns:
        CallToolResult with structuredContent: TopKDiffOutput shape
        {model, column_name, k,
         base:    {values, counts, valids, total},
         current: {values, counts, valids, total},
         warning?}

    Use when:
        - User asks "what are the most common X" or "did the distribution of Y shift"
        - Categorical column investigation during PR review
        - Cardinality or value-shape change detection (new statuses, retired categories)
    Don't use when:
        - Need numeric distribution → histogram_diff
        - Need row-level diff → value_diff_detail
        - Need full value comparison across all columns → value_diff
        - Continuous data without natural top-K semantics → profile_diff
    """
    raw = await _recce_server._tool_top_k_diff(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None

    raw_base = raw.get("base", {}) if isinstance(raw, dict) else {}
    raw_curr = raw.get("current", {}) if isinstance(raw, dict) else {}

    base_stats = TopKEnvStats(
        values=raw_base.get("values") or [],
        counts=raw_base.get("counts") or [],
        valids=raw_base.get("valids") or 0,
        total=raw_base.get("total") or 0,
    )
    curr_stats = TopKEnvStats(
        values=raw_curr.get("values") or [],
        counts=raw_curr.get("counts") or [],
        valids=raw_curr.get("valids") or 0,
        total=raw_curr.get("total") or 0,
    )

    output = TopKDiffOutput(
        model=args.model,
        column_name=args.column_name,
        k=args.k if args.k is not None else 10,
        base=base_stats,
        current=curr_stats,
        warning=warning,
    )

    n = len(base_stats.values)
    text = (
        f"Top-K diff for '{args.model}.{args.column_name}': "
        f"{n} categor{'ies' if n != 1 else 'y'} compared. Rendered in widget."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/top_k_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def top_k_diff_resource() -> str:
    return _read_widget_html("top_k_diff")


# ---------------------------------------------------------------------------
# histogram_diff widget tool + resource
# ---------------------------------------------------------------------------


class HistogramDiffInput(BaseModel):
    model: str = Field(..., description="dbt model name to analyze (e.g. 'customers')")
    column_name: str = Field(..., description="Column name to generate histogram for (numeric or datetime)")
    num_bins: Optional[int] = Field(
        default=None,
        description="Number of histogram bins (default: 50)",
    )


class HistogramEnvStats(BaseModel):
    """Per-environment histogram counts.

    HistogramDiffTask.execute() returns per-env dicts:
      counts: List[int]  — count per bin (same length as num_bins)
      total:  int        — total rows in this environment

    An empty dict {} is returned when the environment fails or produces no data.
    """

    counts: List[int] = []  # count per bin
    total: Optional[int] = None  # total rows (may be None if env produced empty dict)


class HistogramDiffOutput(BaseModel):
    """Output model for the histogram_diff widget tool.

    Mirrors HistogramDiffTask.execute() return shape after _warning extraction:
      base:      {counts, total}
      current:   {counts, total}
      min:       overall min value across both envs (numeric or ISO date string)
      max:       overall max value across both envs
      bin_edges: list of bin boundary values (N+1 values for N bins)
      labels:    list of bin label strings for numeric cols; null for datetime cols

    model, column_name are echoed from input for the widget header.
    warning is extracted from _warning key (single-env mode notice).
    """

    model: str
    column_name: str
    base: HistogramEnvStats
    current: HistogramEnvStats
    min: Optional[Any] = None
    max: Optional[Any] = None
    bin_edges: List[Any] = []  # List[int | float | date]
    labels: Optional[List[str]] = None  # None for datetime columns
    warning: Optional[str] = None


@mcp.tool(
    name="histogram_diff",
    annotations={
        "title": "Histogram Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # executes queries against the warehouse
    },
    meta={
        "ui": {"resourceUri": "ui://recce/histogram_diff.html"},
        "ui/resourceUri": "ui://recce/histogram_diff.html",
    },
)
async def histogram_diff(args: HistogramDiffInput) -> CallToolResult:
    """Compare numeric or datetime column distributions across base and current environments.

    Renders an SVG bar chart widget — base bars and current bars overlaid per bin.
    The agent should not enumerate bin counts as plain text — the widget handles
    all rendering.

    Column type is auto-detected from the dbt catalog; no explicit column_type
    argument is required.

    Args:
        model: dbt model name (e.g. 'orders')
        column_name: numeric or datetime column to bin (e.g. 'amount', 'created_at')
        num_bins: optional bin count (default: 50 for numeric; adaptive for datetime)

    Returns:
        CallToolResult with structuredContent: HistogramDiffOutput shape
        {model, column_name,
         base:    {counts, total},
         current: {counts, total},
         min, max, bin_edges, labels?,
         warning?}

    Use when:
        - User asks "how is X distributed" / "did the distribution shift"
        - Numeric or continuous column investigation during PR review
        - Detecting outliers or distribution skew between environments
    Don't use when:
        - Categorical column → use top_k_diff instead
        - Need per-row diff → use value_diff_detail
        - Stats summary only (min/max/stddev) → use profile_diff
        - String / boolean columns (not supported) → use top_k_diff
    """
    raw = await _recce_server._tool_histogram_diff(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None

    raw_base = raw.get("base", {}) if isinstance(raw, dict) else {}
    raw_curr = raw.get("current", {}) if isinstance(raw, dict) else {}

    base_stats = HistogramEnvStats(
        counts=raw_base.get("counts") or [],
        total=raw_base.get("total"),
    )
    curr_stats = HistogramEnvStats(
        counts=raw_curr.get("counts") or [],
        total=raw_curr.get("total"),
    )

    # bin_edges may contain date objects — convert to ISO strings for JSON serialisation
    raw_edges = raw.get("bin_edges") or [] if isinstance(raw, dict) else []
    bin_edges = [e.isoformat() if hasattr(e, "isoformat") else e for e in raw_edges]

    raw_min = raw.get("min") if isinstance(raw, dict) else None
    raw_max = raw.get("max") if isinstance(raw, dict) else None
    min_val = raw_min.isoformat() if hasattr(raw_min, "isoformat") else raw_min
    max_val = raw_max.isoformat() if hasattr(raw_max, "isoformat") else raw_max

    output = HistogramDiffOutput(
        model=args.model,
        column_name=args.column_name,
        base=base_stats,
        current=curr_stats,
        min=min_val,
        max=max_val,
        bin_edges=bin_edges,
        labels=raw.get("labels") if isinstance(raw, dict) else None,
        warning=warning,
    )

    n_bins = len(base_stats.counts) or len(curr_stats.counts)
    text = (
        f"Histogram diff for '{args.model}.{args.column_name}': "
        f"{n_bins} bin{'s' if n_bins != 1 else ''} rendered in widget."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/histogram_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def histogram_diff_resource() -> str:
    return _read_widget_html("histogram_diff")


# ---------------------------------------------------------------------------
# profile_diff widget tool + resource
# ---------------------------------------------------------------------------

# ProfileDiffResult.model_dump(mode='json') shape (from recce/tasks/profile.py):
#   {
#     "base":    {"columns": [{"key", "name", "type"}, ...], "data": [[row_values], ...]},
#     "current": {"columns": [{"key", "name", "type"}, ...], "data": [[row_values], ...]}
#   }
#
# Each row in data corresponds to one profiled column, with values for:
#   column_name, data_type, row_count, not_null_proportion, distinct_proportion,
#   distinct_count, is_unique, min, max, avg, median
#
# min/max are CAST TO STRING in the SQL template (`cast(min(...) as text_type)`),
# so they arrive as Python str (or None). avg/median are numeric floats or None.
# is_unique arrives as bool or None (NULL for empty tables, per template comment).


class ProfileColumnStats(BaseModel):
    """Per-environment stats for a single profiled column.

    All fields are Optional — not all stats apply to every column type:
      - min/max: only for numeric and date/time columns (cast to str in SQL)
      - avg: numeric + logical (boolean); None for text/struct
      - median: numeric only; None otherwise
      - is_unique: None for empty tables (SQL emits NULL by design)
    """

    row_count: Optional[int] = None
    not_null_proportion: Optional[float] = None
    distinct_proportion: Optional[float] = None
    distinct_count: Optional[int] = None
    is_unique: Optional[bool] = None
    min: Optional[str] = None  # always str — SQL CAST to text type
    max: Optional[str] = None  # always str — SQL CAST to text type
    avg: Optional[float] = None
    median: Optional[float] = None


class ProfileColumnDiff(BaseModel):
    """Profile diff for one column: name, data_type, base stats, current stats."""

    column_name: str
    data_type: Optional[str] = None
    base: Optional[ProfileColumnStats] = None
    current: Optional[ProfileColumnStats] = None


class ProfileDiffOutput(BaseModel):
    """Output model for the profile_diff widget tool.

    ProfileDiffResult.model_dump(mode='json') returns two DataFrames (base, current).
    Each DataFrame has columns [column_name, data_type, row_count, not_null_proportion,
    distinct_proportion, distinct_count, is_unique, min, max, avg, median] and data rows,
    one row per profiled column.

    The delegate merges base + current rows by column_name into per-column ProfileColumnDiff
    entries, then stores them in a list.

    model is echoed from input for the widget header.
    warning is extracted from _warning key (single-env mode notice).
    """

    model: str
    columns: List[ProfileColumnDiff]
    warning: Optional[str] = None


class ProfileDiffInput(BaseModel):
    model: str = Field(..., description="dbt model name to profile (e.g. 'customers')")
    columns: Optional[List[str]] = Field(
        default=None,
        description="Columns to profile (default: all columns in the model)",
    )


def _parse_profile_dataframe(raw_df: Optional[dict]) -> Dict[str, ProfileColumnStats]:
    """Convert a ProfileDiffResult DataFrame dict → {column_name: ProfileColumnStats}.

    Returns empty dict when raw_df is None or missing columns/data.
    The DataFrame columns list is used to build an index so row values are mapped
    by position to the correct stat field.
    """
    if not raw_df:
        return {}

    col_meta = raw_df.get("columns") or []
    col_names = [c.get("name") or c.get("key", "") for c in col_meta]
    rows = raw_df.get("data") or []

    result: Dict[str, ProfileColumnStats] = {}
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < len(col_names):
            continue
        row_dict = dict(zip(col_names, row))

        col_name = row_dict.get("column_name")
        if not col_name:
            continue

        def _to_float(v: Any) -> Optional[float]:
            if v is None:
                return None
            # May arrive as a Decimal (from agate) serialised to string by model_dump
            try:
                return float(v)
            except (TypeError, ValueError):
                return None

        def _to_int(v: Any) -> Optional[int]:
            if v is None:
                return None
            try:
                return int(v)
            except (TypeError, ValueError):
                return None

        def _to_str(v: Any) -> Optional[str]:
            if v is None:
                return None
            if hasattr(v, "isoformat"):
                return v.isoformat()
            return str(v)

        def _to_bool(v: Any) -> Optional[bool]:
            if v is None:
                return None
            if isinstance(v, bool):
                return v
            if isinstance(v, int):
                return bool(v)
            if isinstance(v, str):
                return v.lower() in ("true", "1", "t", "yes")
            return None

        result[str(col_name)] = ProfileColumnStats(
            row_count=_to_int(row_dict.get("row_count")),
            not_null_proportion=_to_float(row_dict.get("not_null_proportion")),
            distinct_proportion=_to_float(row_dict.get("distinct_proportion")),
            distinct_count=_to_int(row_dict.get("distinct_count")),
            is_unique=_to_bool(row_dict.get("is_unique")),
            min=_to_str(row_dict.get("min")),
            max=_to_str(row_dict.get("max")),
            avg=_to_float(row_dict.get("avg")),
            median=_to_float(row_dict.get("median")),
        )
    return result


def _parse_data_type_map(raw_df: Optional[dict]) -> Dict[str, Optional[str]]:
    """Extract {column_name: data_type} from a profile DataFrame dict."""
    if not raw_df:
        return {}
    col_meta = raw_df.get("columns") or []
    col_names = [c.get("name") or c.get("key", "") for c in col_meta]
    rows = raw_df.get("data") or []

    result: Dict[str, Optional[str]] = {}
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) < len(col_names):
            continue
        row_dict = dict(zip(col_names, row))
        col_name = row_dict.get("column_name")
        if col_name:
            result[str(col_name)] = row_dict.get("data_type")
    return result


@mcp.tool(
    name="profile_diff",
    annotations={
        "title": "Profile Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # executes queries against the warehouse
    },
    meta={
        "ui": {"resourceUri": "ui://recce/profile_diff.html"},
        "ui/resourceUri": "ui://recce/profile_diff.html",
    },
)
async def profile_diff(args: ProfileDiffInput) -> CallToolResult:
    """Compare per-column statistical profiles across base and current environments.

    Returns side-by-side stats (row count, null proportion, distinct count, min, max,
    avg, median) for every profiled column, rendered as a card grid. The agent should
    not enumerate the stats as plain text — the widget handles presentation.

    Column type is inferred by the profiling SQL: numeric columns get avg/median;
    date/time columns get min/max as ISO strings; text columns show only count
    and distinct stats.

    Args:
        model: dbt model name (e.g. 'customers')
        columns: optional subset of columns to profile (default: all columns)

    Returns:
        CallToolResult with structuredContent: ProfileDiffOutput shape
        {model, columns: [{column_name, data_type, base: {stats}, current: {stats}}],
         warning?}

    Use when:
        - User asks "did the stats shift" / "any null count change"
        - PR review needs distribution sanity check across columns
        - Following up a row_count_diff showing changes — drill into which columns shifted
        - Verifying numeric ranges (min/max) or distinct cardinality changed
    Don't use when:
        - Need value-level diff → value_diff or value_diff_detail
        - Need distribution bars → histogram_diff (one column at a time)
        - Need top-K most frequent values → top_k_diff
        - Single-environment only — tool warns but returns no useful comparison
    """
    raw = await _recce_server._tool_profile_diff(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None

    raw_base = raw.get("base") if isinstance(raw, dict) else None
    raw_curr = raw.get("current") if isinstance(raw, dict) else None

    base_stats = _parse_profile_dataframe(raw_base)
    curr_stats = _parse_profile_dataframe(raw_curr)

    # Build data_type map from whichever DataFrame has it (prefer current)
    dtype_base = _parse_data_type_map(raw_base)
    dtype_curr = _parse_data_type_map(raw_curr)

    # Union of all column names, preserving order (base first, then current-only)
    all_columns: List[str] = []
    seen: set = set()
    for col in list(base_stats.keys()) + list(curr_stats.keys()):
        if col not in seen:
            all_columns.append(col)
            seen.add(col)

    col_diffs: List[ProfileColumnDiff] = []
    for col_name in all_columns:
        data_type = dtype_curr.get(col_name) or dtype_base.get(col_name)
        col_diffs.append(
            ProfileColumnDiff(
                column_name=col_name,
                data_type=data_type,
                base=base_stats.get(col_name),
                current=curr_stats.get(col_name),
            )
        )

    output = ProfileDiffOutput(
        model=args.model,
        columns=col_diffs,
        warning=warning,
    )

    n_cols = len(col_diffs)
    text = (
        f"Profile diff for '{args.model}': "
        f"{n_cols} column{'s' if n_cols != 1 else ''} profiled. Rendered in widget."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/profile_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def profile_diff_resource() -> str:
    return _read_widget_html("profile_diff")


# ---------------------------------------------------------------------------
# get_cll widget tool + resource
# ---------------------------------------------------------------------------


class GetCllInput(BaseModel):
    node_id: str = Field(..., description="Full dbt node ID (e.g. 'model.jaffle_shop.customers')")
    column: str = Field(..., description="Column name to trace lineage for")
    change_analysis: bool = Field(
        default=False,
        description="Highlight columns whose transformation logic changed between base and current",
    )


class GetCllColumnDep(BaseModel):
    """A single column-to-column dependency edge (source of column data)."""

    node: str  # node_id of the source node
    column: str  # source column name


class GetCllColumnInfo(BaseModel):
    """Per-column lineage info from CllColumn, adapted for the widget."""

    id: Optional[str] = None
    table_id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None
    transformation_type: str = "unknown"  # source|passthrough|renamed|derived|unknown
    change_status: Optional[str] = None
    depends_on: List[GetCllColumnDep] = []


class GetCllNodeInfo(BaseModel):
    """Per-node info from CllNode, adapted for the widget."""

    id: str
    name: str
    package_name: str
    resource_type: str
    source_name: Optional[str] = None
    change_status: Optional[str] = None
    change_category: Optional[str] = None
    impacted: Optional[bool] = None
    # columns dict: column_name → GetCllColumnInfo
    columns: Dict[str, GetCllColumnInfo] = {}


class GetCllOutput(BaseModel):
    """Output model for the get_cll widget tool.

    Mirrors CllData.model_dump(mode='json') after normalisation.

    CllData has:
      nodes:      Dict[str, CllNode]     — keyed by node_id
      columns:    Dict[str, CllColumn]   — keyed by "{node_id}_{column_name}"
      parent_map: Dict[str, Set[str]]    — child → set of parent keys
      child_map:  Dict[str, Set[str]]    — parent → set of child keys

    The widget uses nodes/columns to draw cards and parent_map/child_map for edges.
    We echo the query params so the widget header can show "{node}.{column}".

    node_count / edge_count enable the bail-out path in the widget without
    the widget having to recompute them.
    """

    node_id: str  # echoed from input
    column: str  # echoed from input
    change_analysis: bool  # echoed from input
    nodes: Dict[str, GetCllNodeInfo]
    columns: Dict[str, GetCllColumnInfo]
    parent_map: Dict[str, List[str]]  # Set serialises as list in JSON
    child_map: Dict[str, List[str]]
    node_count: int
    edge_count: int  # total directed edges (sum of len(parents) for each key)
    warning: Optional[str] = None


@mcp.tool(
    name="get_cll",
    annotations={
        "title": "Column Lineage (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,  # reads dbt manifest only, no warehouse I/O
    },
    meta={
        "ui": {"resourceUri": "ui://recce/get_cll.html"},
        "ui/resourceUri": "ui://recce/get_cll.html",
    },
)
async def get_cll(args: GetCllInput) -> CallToolResult:
    """Show column-level lineage — which upstream columns feed into a target column, and which downstream columns consume it.

    Rendered as a mini SVG DAG with layered layout: source nodes on the left,
    the queried node in the middle, downstream nodes on the right. Column rows
    are shown inside model "cards" (rectangles). Bezier edges connect source
    column rows to target column rows.

    For complex graphs (>12 nodes or >30 edges), falls back to a summary list
    with a hint to use the Recce web app lineage view for the full DAG.

    Only available with dbt adapter (reads dbt manifest — no warehouse I/O).

    Args:
        node_id: Full dbt node ID (e.g. 'model.jaffle_shop.customers')
        column: Column name within that model to trace lineage for
        change_analysis: True to highlight transformation-logic changes between base and current envs

    Returns:
        CallToolResult with structuredContent: GetCllOutput shape
        {node_id, column, change_analysis, nodes, columns, parent_map, child_map,
         node_count, edge_count, warning?}

    Use when:
        - User asks "where does column X come from / what uses it"
        - Tracing data origin for a specific field during PR review
        - Verifying a refactor preserved column semantics (with change_analysis=True)
    Don't use when:
        - Need full model-level DAG → lineage_diff (future widget) or Recce web app
        - Need impact_analysis across changed models → impact_analysis
        - Column doesn't exist in the model → use get_model to verify schema first
        - Non-dbt adapter → tool raises immediately
    """
    raw = await _recce_server._tool_get_cll(args.model_dump())
    # raw is CllData.model_dump(mode="json"):
    #   {nodes: {node_id: {id, name, ...}},
    #    columns: {col_key: {id, name, ...}},
    #    parent_map: {key: [parents...]},
    #    child_map: {key: [children...]}}
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None

    raw_nodes = raw.get("nodes", {}) if isinstance(raw, dict) else {}
    raw_cols = raw.get("columns", {}) if isinstance(raw, dict) else {}
    raw_parent_map = raw.get("parent_map", {}) if isinstance(raw, dict) else {}
    raw_child_map = raw.get("child_map", {}) if isinstance(raw, dict) else {}

    # Normalise nodes
    nodes_out: Dict[str, GetCllNodeInfo] = {}
    for nid, ndata in raw_nodes.items():
        if not isinstance(ndata, dict):
            continue
        raw_node_cols = ndata.get("columns", {}) or {}
        node_cols: Dict[str, GetCllColumnInfo] = {}
        for cname, cdata in raw_node_cols.items():
            if isinstance(cdata, dict):
                deps = [
                    GetCllColumnDep(node=d["node"], column=d["column"])
                    for d in (cdata.get("depends_on") or [])
                    if isinstance(d, dict) and "node" in d and "column" in d
                ]
                node_cols[cname] = GetCllColumnInfo(
                    id=cdata.get("id"),
                    table_id=cdata.get("table_id"),
                    name=cdata.get("name"),
                    type=cdata.get("type"),
                    transformation_type=cdata.get("transformation_type") or "unknown",
                    change_status=cdata.get("change_status"),
                    depends_on=deps,
                )
        nodes_out[nid] = GetCllNodeInfo(
            id=ndata.get("id", nid),
            name=ndata.get("name", nid),
            package_name=ndata.get("package_name", ""),
            resource_type=ndata.get("resource_type", "model"),
            source_name=ndata.get("source_name"),
            change_status=ndata.get("change_status"),
            change_category=ndata.get("change_category"),
            impacted=ndata.get("impacted"),
            columns=node_cols,
        )

    # Normalise flat columns dict (keyed by "{node_id}_{column_name}")
    cols_out: Dict[str, GetCllColumnInfo] = {}
    for col_key, cdata in raw_cols.items():
        if not isinstance(cdata, dict):
            continue
        deps = [
            GetCllColumnDep(node=d["node"], column=d["column"])
            for d in (cdata.get("depends_on") or [])
            if isinstance(d, dict) and "node" in d and "column" in d
        ]
        cols_out[col_key] = GetCllColumnInfo(
            id=cdata.get("id"),
            table_id=cdata.get("table_id"),
            name=cdata.get("name"),
            type=cdata.get("type"),
            transformation_type=cdata.get("transformation_type") or "unknown",
            change_status=cdata.get("change_status"),
            depends_on=deps,
        )

    # Normalise parent_map / child_map (sets serialise as lists in JSON)
    parent_map_out: Dict[str, List[str]] = {
        k: list(v) if isinstance(v, (list, set)) else [] for k, v in raw_parent_map.items()
    }
    child_map_out: Dict[str, List[str]] = {
        k: list(v) if isinstance(v, (list, set)) else [] for k, v in raw_child_map.items()
    }

    # Compute counts for bail-out logic
    node_count = len(nodes_out)
    edge_count = sum(len(parents) for parents in parent_map_out.values())

    output = GetCllOutput(
        node_id=args.node_id,
        column=args.column,
        change_analysis=args.change_analysis,
        nodes=nodes_out,
        columns=cols_out,
        parent_map=parent_map_out,
        child_map=child_map_out,
        node_count=node_count,
        edge_count=edge_count,
        warning=warning,
    )

    # Short content text — widget handles rendering
    node_name = nodes_out.get(
        args.node_id, GetCllNodeInfo(id=args.node_id, name=args.node_id, package_name="", resource_type="model")
    ).name
    text = (
        f"Column lineage for {node_name}.{args.column}: "
        f"{node_count} node{'s' if node_count != 1 else ''}, "
        f"{edge_count} edge{'s' if edge_count != 1 else ''}. Rendered in widget."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/get_cll.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def get_cll_resource() -> str:
    return _read_widget_html("get_cll")


# ---------------------------------------------------------------------------
# impact_analysis widget tool + resource
# ---------------------------------------------------------------------------


class ImpactAnalysisInput(BaseModel):
    select: Optional[str] = Field(
        default=None,
        description=(
            "dbt selector syntax. Default: data-affecting changes only "
            "(body + macros + contract and their downstream). "
            "Use 'state:modified+' to include all changes including config."
        ),
    )
    skip_value_diff: bool = Field(
        default=False,
        description="Skip row-level value comparison on modified models.",
    )
    skip_downstream_value_diff: bool = Field(
        default=False,
        description="Skip value comparison on downstream models (faster for large DAGs).",
    )


class RowCountSummary(BaseModel):
    """Row count comparison between base and current environments."""

    base: Optional[int] = None
    current: Optional[int] = None
    delta: Optional[int] = None
    delta_pct: Optional[float] = None


class ImpactValueDiffSummary(BaseModel):
    """Row-level value diff summary (PK join result) as returned by impact_analysis."""

    affected_row_count: int = 0
    rows_added: int = 0
    rows_removed: int = 0
    rows_changed: int = 0
    columns: Optional[Dict[str, Any]] = None  # column → {affected_row_count, base_mean, current_mean}


class NextAction(BaseModel):
    """Suggested follow-up tool to investigate a model further."""

    tool: str  # "profile_diff" | "query_diff" | "row_count_diff" | etc.
    columns: Optional[List[str]] = None
    reason: str
    priority: str  # "high" | "medium" | "low"


class ColumnSchemaChange(BaseModel):
    """A single column-level schema change used by impact_analysis.

    Distinct from the model-level SchemaChange defined for schema_diff
    (which carries added/removed/type_changed lists per model).
    """

    column: str
    change_status: str  # "added" | "removed" | "modified"


class ImpactedModelEntry(BaseModel):
    """Per-model impact record from _tool_impact_analysis."""

    name: str
    change_status: Optional[str] = None  # "added" | "removed" | "modified" | None (downstream)
    materialized: Optional[str] = None  # "table" | "view" | "incremental" | etc.
    row_count: Optional[RowCountSummary] = None
    schema_changes: List[ColumnSchemaChange] = []
    value_diff: Optional[ImpactValueDiffSummary] = None
    affected_row_count: Optional[int] = None
    data_impact: Optional[str] = None  # "confirmed" | "none" | "potential"
    next_action: Optional[NextAction] = None


class ImpactAnalysisOutput(BaseModel):
    """Output model for the impact_analysis widget tool.

    Mirrors _tool_impact_analysis return shape (without _guidance).

    Fields:
      guidance:                   LLM-facing triage hint (from _guidance)
      classification_source:      always "lineage_dag"
      max_affected_row_count:     max across all confirmed models
      confirmed_impacted_models:  list of all blast-radius models with data_impact field
      confirmed_not_impacted_models: list of model names confirmed clean
      errors:                     list of per-step error dicts (step, message, model?)
      warning:                    single-env warning if present
    """

    guidance: Optional[str] = None
    classification_source: Optional[str] = None
    max_affected_row_count: int = 0
    confirmed_impacted_models: List[ImpactedModelEntry] = []
    confirmed_not_impacted_models: List[str] = []
    errors: List[Dict[str, Any]] = []
    warning: Optional[str] = None


@mcp.tool(
    name="impact_analysis",
    annotations={
        "title": "Impact Analysis (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": True,  # runs row_count_diff + value_diff SQL against warehouse
    },
    meta={
        "ui": {"resourceUri": "ui://recce/impact_analysis.html"},
        "ui/resourceUri": "ui://recce/impact_analysis.html",
    },
)
async def impact_analysis(args: ImpactAnalysisInput) -> CallToolResult:
    """Show the blast radius of dbt model changes — which models are confirmed-impacted, clean, or need investigation.

    Rendered as a model-level impact dashboard: summary counts, optional SVG mini-DAG
    of impacted models (up to 15 nodes), and an actionable "What to investigate next"
    list extracted from each model's next_action field grouped by priority.

    Runs warehouse queries (row_count_diff + value_diff) for non-view models with a
    primary key. View models and models without a PK receive data_impact='potential'
    and a next_action hint instead.

    Args:
        select:                   dbt selector syntax (default: data-affecting changes + downstream)
        skip_value_diff:          skip value comparison on all models
        skip_downstream_value_diff: skip value comparison on downstream models only

    Returns:
        CallToolResult with structuredContent: ImpactAnalysisOutput shape
        {guidance, classification_source, max_affected_row_count,
         confirmed_impacted_models, confirmed_not_impacted_models, errors, warning?}

    Use when:
        - Starting a PR review: "what models are impacted by my changes?"
        - Triaging blast radius before deciding which diffs to run
        - Building a structured change report for stakeholders
    Don't use when:
        - Need column-level lineage → get_cll
        - Need detailed row-by-row diffs for a specific model → value_diff / value_diff_detail
        - Already have impact results and need to drill in → profile_diff / query_diff
    """
    raw = await _recce_server._tool_impact_analysis(args.model_dump(exclude_none=True))
    warning = raw.pop("_warning", None) if isinstance(raw, dict) else None

    guidance = raw.get("_guidance") if isinstance(raw, dict) else None
    classification_source = raw.get("classification_source") if isinstance(raw, dict) else None
    max_affected = raw.get("max_affected_row_count", 0) if isinstance(raw, dict) else 0
    raw_impacted = raw.get("confirmed_impacted_models", []) if isinstance(raw, dict) else []
    raw_not_impacted = raw.get("confirmed_not_impacted_models", []) if isinstance(raw, dict) else []
    raw_errors = raw.get("errors", []) if isinstance(raw, dict) else []

    # Normalise impacted model entries
    impacted_models: List[ImpactedModelEntry] = []
    for m in raw_impacted:
        if not isinstance(m, dict):
            continue
        rc = m.get("row_count")
        row_count = (
            RowCountSummary(
                base=rc.get("base"),
                current=rc.get("current"),
                delta=rc.get("delta"),
                delta_pct=rc.get("delta_pct"),
            )
            if isinstance(rc, dict)
            else None
        )
        vd = m.get("value_diff")
        value_diff = (
            ImpactValueDiffSummary(
                affected_row_count=vd.get("affected_row_count", 0),
                rows_added=vd.get("rows_added", 0),
                rows_removed=vd.get("rows_removed", 0),
                rows_changed=vd.get("rows_changed", 0),
                columns=vd.get("columns"),
            )
            if isinstance(vd, dict)
            else None
        )
        na = m.get("next_action")
        next_action = (
            NextAction(
                tool=na.get("tool", "profile_diff"),
                columns=na.get("columns"),
                reason=na.get("reason", ""),
                priority=na.get("priority", "medium"),
            )
            if isinstance(na, dict)
            else None
        )
        schema_changes = [
            ColumnSchemaChange(column=sc["column"], change_status=sc["change_status"])
            for sc in (m.get("schema_changes") or [])
            if isinstance(sc, dict) and "column" in sc and "change_status" in sc
        ]
        impacted_models.append(
            ImpactedModelEntry(
                name=m.get("name", ""),
                change_status=m.get("change_status"),
                materialized=m.get("materialized"),
                row_count=row_count,
                schema_changes=schema_changes,
                value_diff=value_diff,
                affected_row_count=m.get("affected_row_count"),
                data_impact=m.get("data_impact"),
                next_action=next_action,
            )
        )

    # confirmed_not_impacted_models is a list of name strings
    not_impacted: List[str] = [n for n in raw_not_impacted if isinstance(n, str)]

    output = ImpactAnalysisOutput(
        guidance=guidance,
        classification_source=classification_source,
        max_affected_row_count=max_affected if isinstance(max_affected, int) else 0,
        confirmed_impacted_models=impacted_models,
        confirmed_not_impacted_models=not_impacted,
        errors=[e for e in raw_errors if isinstance(e, dict)],
        warning=warning,
    )

    n_confirmed = sum(1 for m in impacted_models if m.data_impact == "confirmed")
    n_potential = sum(1 for m in impacted_models if m.data_impact == "potential")
    n_none = sum(1 for m in impacted_models if m.data_impact == "none")
    total_impacted = len(impacted_models)
    text = (
        f"Impact analysis: {total_impacted} model{'s' if total_impacted != 1 else ''} in blast radius "
        f"({n_confirmed} confirmed, {n_potential} potential, {n_none} no impact). "
        f"Max affected rows: {max_affected:,}. Rendered in widget."
    )
    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(),
    )


@mcp.resource(
    uri="ui://recce/impact_analysis.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def impact_analysis_resource() -> str:
    return _read_widget_html("impact_analysis")


# ---------------------------------------------------------------------------
# lineage_diff widget tool + resource (Phase E first version, 10-node cap)
# ---------------------------------------------------------------------------

MAX_INLINE_NODES = 10


class LineageDiffInput(BaseModel):
    select: Optional[str] = Field(
        default=None,
        description="dbt selector syntax (e.g. 'state:modified+', '1+state:modified')",
    )
    exclude: Optional[str] = Field(
        default=None,
        description="dbt selector syntax for exclusion",
    )
    packages: Optional[List[str]] = Field(
        default=None,
        description="Restrict to specific dbt packages by name",
    )
    view_mode: Optional[str] = Field(
        default="changed_models",
        description="'all' (full lineage) or 'changed_models' (default, modified + downstream).",
    )


class LineageNode(BaseModel):
    """One node in the lineage DAG, flattened from the DataFrame row format."""

    idx: int
    id: str
    name: Optional[str] = None
    resource_type: Optional[str] = None
    materialized: Optional[str] = None
    change_status: Optional[str] = None  # "added" | "modified" | "removed" | None
    impacted: bool = False


class LineageEdge(BaseModel):
    """One directed edge in the lineage DAG (parent_idx -> child_idx).

    The underlying DataFrame uses 'from'/'to' column keys, which are Python
    reserved words — Pydantic aliases let us accept those keys while exposing
    idiomatic Python attribute names.
    """

    from_idx: int = Field(alias="from")
    to_idx: int = Field(alias="to")

    model_config = {"populate_by_name": True}


class LineageDiffOutput(BaseModel):
    """Output model for the lineage_diff widget tool.

    First-version contract: when node_count > MAX_INLINE_NODES the widget
    receives empty `nodes`/`edges` lists plus `exceeds_limit=True` so the HTML
    can render a graceful skip message. No truncation, no toggle.
    """

    nodes: List[LineageNode]
    edges: List[LineageEdge]
    node_count: int
    exceeds_limit: bool
    max_inline_nodes: int


def _dataframe_rows(df: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert a serialized DataFrame ({columns:[{name,...}], data:[tuple,...]})
    into a flat list of {column_name: value} dicts.

    Returns [] when columns or data are missing/empty.
    """
    columns = df.get("columns") or []
    rows = df.get("data") or []
    keys = [c.get("name") for c in columns if isinstance(c, dict)]
    return [dict(zip(keys, row)) for row in rows]


@mcp.tool(
    name="lineage_diff",
    annotations={
        "title": "Lineage Diff (Widget)",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
    meta={
        "ui": {"resourceUri": "ui://recce/lineage_diff.html"},
        "ui/resourceUri": "ui://recce/lineage_diff.html",
    },
)
async def lineage_diff(args: LineageDiffInput) -> CallToolResult:
    """Show the lineage DAG diff between base and current dbt environments.

    Renders an interactive SVG of modified models and their dependencies, hand-rolled
    using the same BFS layered layout as the impact_analysis mini-DAG. First version
    is capped at MAX_INLINE_NODES (10) inline nodes — larger graphs are skipped with
    a graceful message pointing the user to the Recce web UI.

    Args:
        select: dbt selector syntax (e.g. "state:modified+", "customers orders")
        exclude: dbt selector for exclusion
        packages: restrict to specific dbt packages by name
        view_mode: 'all' or 'changed_models' (default)

    Returns:
        CallToolResult with structuredContent: LineageDiffOutput shape
        {nodes: [{idx, id, name, resource_type, materialized, change_status, impacted}],
         edges: [{from, to}], node_count, exceeds_limit, max_inline_nodes}

    Use when:
        - User asks "show me the lineage diff" / "what models depend on X"
        - Visualizing the dependency graph of changed models in a small PR
    Don't use when:
        - Need column-level lineage → use get_cll
        - Need data impact triage with row counts → use impact_analysis
        - Lineage scope exceeds 10 nodes — widget will show a skip message and the
          user should be directed to the Recce web UI

    Error Handling:
        - Underlying _tool_lineage_diff raises on adapter/context failure
        - >10 nodes returns exceeds_limit=True with empty nodes/edges (not an error)
    """
    result = await _recce_server._tool_lineage_diff(args.model_dump(exclude_none=True))
    nodes_df = result.get("nodes", {}) if isinstance(result, dict) else {}
    edges_df = result.get("edges", {}) if isinstance(result, dict) else {}

    raw_nodes = _dataframe_rows(nodes_df)
    raw_edges = _dataframe_rows(edges_df)

    nodes = [LineageNode(**row) for row in raw_nodes]
    edges = [LineageEdge(**row) for row in raw_edges]

    node_count = len(nodes)
    exceeds = node_count > MAX_INLINE_NODES

    output = LineageDiffOutput(
        nodes=[] if exceeds else nodes,
        edges=[] if exceeds else edges,
        node_count=node_count,
        exceeds_limit=exceeds,
        max_inline_nodes=MAX_INLINE_NODES,
    )

    if exceeds:
        text = (
            f"Lineage diff: {node_count} nodes exceeds {MAX_INLINE_NODES}-node "
            f"inline widget cap. Open the Recce web UI for the full view."
        )
    else:
        text = (
            f"Lineage diff: {node_count} node{'s' if node_count != 1 else ''}, "
            f"{len(edges)} edge{'s' if len(edges) != 1 else ''}. Rendered in widget."
        )

    return CallToolResult(
        content=[TextContent(type="text", text=text)],
        structuredContent=output.model_dump(by_alias=True),
    )


@mcp.resource(
    uri="ui://recce/lineage_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={
        "ui": {
            "csp": {"resourceDomains": ["https://unpkg.com"]},
            "prefersBorder": False,
        },
    },
)
def lineage_diff_resource() -> str:
    return _read_widget_html("lineage_diff")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run_widget_server(**kwargs) -> None:
    """
    Entry point for the Recce MCP Widget Server.

    Iter 1 is LOCAL MODE ONLY — cloud/session kwargs are not supported.
    Register both `recce mcp-server` and `recce mcp-widget-server` entries
    in Claude Desktop config with RECCE_MCP_WIDGETS=1 set on both.

    mcp.run(transport="stdio") manages its own asyncio event loop internally.
    Do NOT wrap this function in asyncio.run().
    """
    global _recce_server

    if kwargs.get("cloud") or kwargs.get("session"):
        raise ValueError(
            "recce mcp-widget-server does not support cloud/session mode in iter 1 "
            "— use recce mcp-server for cloud sessions"
        )

    logging.basicConfig(
        level=logging.INFO,
        stream=sys.stderr,  # NEVER stdout — that's the JSON-RPC channel
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Lazy imports to avoid heavy startup cost at CLI --help time
    from recce.core import load_context
    from recce.mcp_server import RecceMCPServer
    from recce.server import RecceServerMode

    single_env = kwargs.pop("single_env", False)
    context = load_context(**kwargs)

    _recce_server = RecceMCPServer(
        context,
        mode=RecceServerMode.server,
        debug=kwargs.get("debug", False),
        state_loader=kwargs.get("state_loader"),
        single_env=single_env,
        api_token=kwargs.get("api_token"),
    )

    mcp.run(transport="stdio")
