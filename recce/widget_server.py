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
