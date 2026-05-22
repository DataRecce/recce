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
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("recce-widgets")

# Forward ref — initialized in run_widget_server() to avoid eager import at module load.
_recce_server: Optional[Any] = None

logger = logging.getLogger(__name__)


def _read_widget_html(name: str) -> str:
    """Read widget HTML from recce/data/mcp/{name}.html, returning an error stub if missing."""
    try:
        ref = importlib.resources.files("recce.data.mcp") / f"{name}.html"
        return ref.read_text(encoding="utf-8")
    except (FileNotFoundError, TypeError, ModuleNotFoundError):
        return f"<html><body>" f"Widget asset missing: {name}.html. Run pnpm run build." f"</body></html>"


# ---------------------------------------------------------------------------
# row_count_diff widget tool + resource
# ---------------------------------------------------------------------------


@mcp.tool(
    name="row_count_diff",
    description=(
        "Compare row counts between base and current environments for specified models. "
        "Returns structured results with status information for each model.\n\n"
        "Response format: {model_name: {base: int|null, curr: int|null, "
        "base_meta: {status, message?}, curr_meta: {status, message?}}}\n"
        "- base/curr: row count as integer, or null if unavailable\n"
        "- base_meta/curr_meta: status details explaining the count value\n\n"
        "Status codes (in *_meta.status):\n"
        "- 'ok': Row count retrieved successfully\n"
        "- 'not_in_manifest': Model not found in dbt manifest\n"
        "- 'unsupported_resource_type': Node is not a model/snapshot\n"
        "- 'unsupported_materialization': Materialization doesn't support row counts\n"
        "- 'table_not_found': Table defined in manifest but doesn't exist in database\n"
        "- 'permission_denied': User lacks permission to access the table"
    ),
    meta={
        "ui": {"resourceUri": "ui://recce/row_count_diff.html"},
        "ui/resourceUri": "ui://recce/row_count_diff.html",
    },
)
async def row_count_diff(
    node_names: Optional[List[str]] = None,
    node_ids: Optional[List[str]] = None,
    select: Optional[str] = None,
    exclude: Optional[str] = None,
) -> Dict[str, Any]:
    """Compare row counts between base and current environments."""
    arguments = {
        k: v
        for k, v in {
            "node_names": node_names,
            "node_ids": node_ids,
            "select": select,
            "exclude": exclude,
        }.items()
        if v is not None
    }
    return await _recce_server._tool_row_count_diff(arguments)


@mcp.resource(
    uri="ui://recce/row_count_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={"ui": {"csp": {"resourceDomains": ["https://unpkg.com"]}}},
)
def row_count_diff_resource() -> str:
    return _read_widget_html("row_count_diff")


# ---------------------------------------------------------------------------
# schema_diff widget tool + resource
# ---------------------------------------------------------------------------


@mcp.tool(
    name="schema_diff",
    description=(
        "Get the schema diff (column changes) between base and current environments. "
        "Shows added, removed, and type-changed columns in compact dataframe format."
    ),
    meta={
        "ui": {"resourceUri": "ui://recce/schema_diff.html"},
        "ui/resourceUri": "ui://recce/schema_diff.html",
    },
)
async def schema_diff(
    select: Optional[str] = None,
    exclude: Optional[str] = None,
    packages: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Get schema diff (column changes) between base and current environments."""
    arguments = {
        k: v
        for k, v in {
            "select": select,
            "exclude": exclude,
            "packages": packages,
        }.items()
        if v is not None
    }
    return await _recce_server._tool_schema_diff(arguments)


@mcp.resource(
    uri="ui://recce/schema_diff.html",
    mime_type="text/html;profile=mcp-app",
    meta={"ui": {"csp": {"resourceDomains": ["https://unpkg.com"]}}},
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
