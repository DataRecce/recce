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
from typing import Any, Dict, List, Optional

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
    support_tasks: Optional[List[str]] = None
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


class ListChecksInput(BaseModel):
    pass  # _tool_list_checks takes no arguments — list everything in the session


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
async def list_checks(args: ListChecksInput) -> CallToolResult:
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
