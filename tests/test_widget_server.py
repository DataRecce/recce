"""Tests for recce/widget_server.py and WIDGET_TOOLS env-var coordination.

Covers:
- WIDGET_TOOLS enumeration regression (main mcp-server with/without widgets enabled)
- Widget server tool + resource registration (FastMCP public API)
- Resource handler graceful degradation when HTML asset is missing
- CallToolResult shape: short content + structuredContent matching Pydantic models
- Tool annotations presence and values
"""

from unittest.mock import AsyncMock, MagicMock, patch

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
    assert "get_server_info" in names
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
    assert "get_server_info" not in names
    # Other tools must still be present
    assert "lineage_diff" in names


# ---------------------------------------------------------------------------
# Test 3: Widget server registers exactly 3 tools + 3 resources
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_widget_server_registers_three_tools_and_three_resources():
    """Widget FastMCP instance has exactly row_count_diff + schema_diff + get_server_info tools/resources.

    Uses FastMCP public API: mcp.list_tools() and mcp.list_resources().
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert tool_names == {"row_count_diff", "schema_diff", "get_server_info"}
    assert resource_uris == {
        "ui://recce/row_count_diff.html",
        "ui://recce/schema_diff.html",
        "ui://recce/get_server_info.html",
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


# ---------------------------------------------------------------------------
# Test 6: row_count_diff returns CallToolResult with short one-sentence content
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_row_count_diff_returns_calltoolresult_with_short_content():
    """row_count_diff handler returns CallToolResult with one-sentence content and structuredContent.

    Verifies:
    - content[0].text is a short string, NOT a JSON dump of the full result
    - structuredContent is populated (not empty, not None)
    - structuredContent has 'models' and 'warning' keys (RowCountDiffOutput shape)
    """
    from mcp.types import CallToolResult

    import recce.widget_server as ws
    from recce.widget_server import RowCountDiffInput

    # Mock _recce_server._tool_row_count_diff to return a minimal row count result
    mock_server = MagicMock()
    mock_server._tool_row_count_diff = AsyncMock(
        return_value={
            "customers": {
                "base": 1000,
                "curr": 1000,
                "base_meta": {"status": "ok"},
                "curr_meta": {"status": "ok"},
            }
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        args = RowCountDiffInput(select="customers")
        result = await ws.row_count_diff(args)
    finally:
        ws._recce_server = original

    assert isinstance(result, CallToolResult)
    assert len(result.content) == 1
    content_text = result.content[0].text
    # Content must be a short human-readable sentence, NOT a JSON data dump
    assert isinstance(content_text, str)
    assert len(content_text) < 100, f"content too long (got {len(content_text)} chars): {content_text!r}"
    assert "widget" in content_text.lower()
    # structuredContent must be populated with Pydantic output shape
    assert result.structuredContent is not None
    assert "models" in result.structuredContent
    assert "warning" in result.structuredContent


# ---------------------------------------------------------------------------
# Test 7: structuredContent matches RowCountDiffOutput Pydantic model schema
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_structured_content_matches_pydantic_model():
    """structuredContent from row_count_diff passes RowCountDiffOutput.model_validate().

    Proves Pydantic shape is clean and matches what widget JS reads.
    """
    import recce.widget_server as ws
    from recce.widget_server import RowCountDiffInput, RowCountDiffOutput

    mock_server = MagicMock()
    mock_server._tool_row_count_diff = AsyncMock(
        return_value={
            "orders": {
                "base": None,
                "curr": 500,
                "base_meta": {"status": "table_not_found", "message": "Table not found"},
                "curr_meta": {"status": "ok"},
            },
            "customers": {
                "base": 200,
                "curr": 210,
                "base_meta": {"status": "ok"},
                "curr_meta": {"status": "ok"},
            },
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        args = RowCountDiffInput()
        result = await ws.row_count_diff(args)
    finally:
        ws._recce_server = original

    # Must round-trip through Pydantic validation without error
    validated = RowCountDiffOutput.model_validate(result.structuredContent)
    assert len(validated.models) == 2
    assert validated.models["orders"].base is None
    assert validated.models["orders"].curr == 500
    assert validated.models["orders"].base_meta.status == "table_not_found"
    assert validated.models["customers"].base == 200
    assert validated.warning is None


# ---------------------------------------------------------------------------
# Test 8: Tool annotations are present and correct on both widget tools
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_widget_tool_annotations_present():
    """Both widget tools have required annotations per SDK idiom checklist.

    Asserts readOnlyHint=True, destructiveHint=False, idempotentHint=True,
    openWorldHint=False, and title is set.
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    tool_map = {t.name: t for t in tools}

    for tool_name in ("row_count_diff", "schema_diff", "get_server_info"):
        assert tool_name in tool_map, f"{tool_name} not found in widget mcp tools"
        t = tool_map[tool_name]
        a = t.annotations
        assert a is not None, f"{tool_name} has no annotations"
        assert a.readOnlyHint is True, f"{tool_name}: expected readOnlyHint=True"
        assert a.destructiveHint is False, f"{tool_name}: expected destructiveHint=False"
        assert a.idempotentHint is True, f"{tool_name}: expected idempotentHint=True"
        assert a.openWorldHint is False, f"{tool_name}: expected openWorldHint=False"
        assert a.title is not None and len(a.title) > 0, f"{tool_name}: title must be set"


# ---------------------------------------------------------------------------
# Test 9: get_server_info widget tool is registered with correct resource URI
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_server_info_widget_registered():
    """get_server_info appears in widget mcp tools/list and its resource URI exists.

    Verifies:
    - tool named 'get_server_info' is in widget mcp tool list
    - resource URI 'ui://recce/get_server_info.html' is in widget mcp resource list
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert "get_server_info" in tool_names
    assert "ui://recce/get_server_info.html" in resource_uris


# ---------------------------------------------------------------------------
# Test 10: get_server_info returns CallToolResult with ServerInfoOutput shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_server_info_returns_calltoolresult_with_pydantic_shape():
    """get_server_info handler returns CallToolResult with structuredContent matching ServerInfoOutput.

    Verifies:
    - content[0].text is a short human-readable sentence (not a JSON dump)
    - structuredContent is populated and passes ServerInfoOutput.model_validate()
    - structuredContent has expected fields: mode, single_env, base_status
    """
    from mcp.types import CallToolResult

    import recce.widget_server as ws
    from recce.widget_server import ServerInfoOutput

    mock_server = MagicMock()
    mock_server._tool_get_server_info = AsyncMock(
        return_value={
            "mode": "local",
            "adapter_type": "dbt",
            "review_mode": False,
            "support_tasks": ["row_count_diff", "schema_diff"],
            "single_env": False,
            "base_status": "fresh",
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        result = await ws.get_server_info()
    finally:
        ws._recce_server = original

    assert isinstance(result, CallToolResult)
    assert len(result.content) == 1
    content_text = result.content[0].text
    assert isinstance(content_text, str)
    assert len(content_text) < 100, f"content too long ({len(content_text)} chars): {content_text!r}"
    assert "widget" in content_text.lower()

    assert result.structuredContent is not None
    # Must round-trip through Pydantic validation without error
    validated = ServerInfoOutput.model_validate(result.structuredContent)
    assert validated.mode == "local"
    assert validated.adapter_type == "dbt"
    assert validated.single_env is False
    assert validated.base_status == "fresh"
    assert validated.git is None
    assert validated.pull_request is None
