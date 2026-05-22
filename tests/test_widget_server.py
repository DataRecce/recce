"""Tests for recce/widget_server.py and WIDGET_TOOLS env-var coordination.

Covers:
- WIDGET_TOOLS enumeration regression (main mcp-server with/without widgets enabled)
- Widget server tool + resource registration (FastMCP public API)
- Resource handler graceful degradation when HTML asset is missing
"""

from unittest.mock import MagicMock, patch

import pytest

# Skip entire module if mcp is not available
pytest.importorskip("mcp")

from mcp.types import ListToolsRequest  # noqa: E402

from recce.core import RecceContext  # noqa: E402
from recce.mcp_server import WIDGET_TOOLS, RecceMCPServer  # noqa: E402
from recce.server import RecceServerMode  # noqa: E402

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _list_tool_names(server: RecceMCPServer):
    """Call the registered list_tools handler and return tool name set."""
    handler = server.server.request_handlers[ListToolsRequest]
    result = await handler(ListToolsRequest(method="tools/list"))
    return {t.name for t in result.root.tools}


# ---------------------------------------------------------------------------
# Test 1: All tools present when widgets disabled (no-regression baseline)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mcp_server_lists_all_tools_when_widgets_disabled(monkeypatch):
    """When RECCE_MCP_WIDGETS is unset/empty, all tools including widget tools are returned."""
    monkeypatch.delenv("RECCE_MCP_WIDGETS", raising=False)

    mock_context = MagicMock(spec=RecceContext)
    server = RecceMCPServer(mock_context, mode=RecceServerMode.server)
    names = await _list_tool_names(server)

    assert "row_count_diff" in names
    assert "schema_diff" in names
    # Sanity: lineage_diff is always present
    assert "lineage_diff" in names


# ---------------------------------------------------------------------------
# Test 2: Widget tools filtered when RECCE_MCP_WIDGETS=1
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mcp_server_filters_widget_tools_when_widgets_enabled(monkeypatch):
    """When RECCE_MCP_WIDGETS=1, widget tools are omitted from mcp-server's list_tools."""
    monkeypatch.setenv("RECCE_MCP_WIDGETS", "1")

    mock_context = MagicMock(spec=RecceContext)
    server = RecceMCPServer(mock_context, mode=RecceServerMode.server)
    names = await _list_tool_names(server)

    assert "row_count_diff" not in names
    assert "schema_diff" not in names
    # Other tools must still be present
    assert "lineage_diff" in names


# ---------------------------------------------------------------------------
# Test 3: Widget server registers exactly 2 tools + 2 resources
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_widget_server_registers_two_tools_and_two_resources():
    """Widget FastMCP instance has exactly row_count_diff + schema_diff tools and resources.

    Uses FastMCP public API: mcp.list_tools() and mcp.list_resources().
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert tool_names == {"row_count_diff", "schema_diff"}
    assert resource_uris == {
        "ui://recce/row_count_diff.html",
        "ui://recce/schema_diff.html",
    }


# ---------------------------------------------------------------------------
# Test 4: Resource handler returns error stub when HTML asset is missing
# ---------------------------------------------------------------------------


def test_widget_resource_handler_returns_error_stub_when_html_missing():
    """_read_widget_html returns a valid HTML stub when the asset file does not exist."""
    from recce.widget_server import _read_widget_html

    with patch("importlib.resources.files", side_effect=FileNotFoundError("no such file")):
        result = _read_widget_html("row_count_diff")

    assert result.startswith("<html><body>")
    assert "Widget asset missing" in result
    assert "row_count_diff.html" in result


# ---------------------------------------------------------------------------
# Test 5: Difference between disabled and enabled is exactly WIDGET_TOOLS
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_tool_enumeration_diff_is_exactly_widget_tools(monkeypatch):
    """The set difference between widgets-off and widgets-on is exactly WIDGET_TOOLS."""
    mock_context = MagicMock(spec=RecceContext)

    monkeypatch.delenv("RECCE_MCP_WIDGETS", raising=False)
    server_off = RecceMCPServer(mock_context, mode=RecceServerMode.server)
    names_off = await _list_tool_names(server_off)

    monkeypatch.setenv("RECCE_MCP_WIDGETS", "1")
    server_on = RecceMCPServer(mock_context, mode=RecceServerMode.server)
    names_on = await _list_tool_names(server_on)

    assert names_off - names_on == WIDGET_TOOLS
    assert names_on - names_off == set()
