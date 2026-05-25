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
    assert "list_checks" not in names
    assert "get_model" not in names
    assert "query" not in names
    # Other tools must still be present
    assert "lineage_diff" in names


# ---------------------------------------------------------------------------
# Test 3: Widget server registers exactly 5 tools + 5 resources
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_widget_server_registers_six_tools_and_six_resources():
    """Widget FastMCP instance has exactly 7 tools/resources (Phase A + query + query_diff widgets).

    Uses FastMCP public API: mcp.list_tools() and mcp.list_resources().
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert tool_names == {
        "row_count_diff",
        "schema_diff",
        "get_server_info",
        "list_checks",
        "get_model",
        "query",
        "query_diff",
    }
    assert resource_uris == {
        "ui://recce/row_count_diff.html",
        "ui://recce/schema_diff.html",
        "ui://recce/get_server_info.html",
        "ui://recce/list_checks.html",
        "ui://recce/get_model.html",
        "ui://recce/query.html",
        "ui://recce/query_diff.html",
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
    """All widget tools have required annotations per SDK idiom checklist.

    All tools: readOnlyHint=True, destructiveHint=False, idempotentHint=True, title set.
    openWorldHint=False for all except 'query' (which hits the warehouse, openWorldHint=True).
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    tool_map = {t.name: t for t in tools}

    for tool_name in (
        "row_count_diff",
        "schema_diff",
        "get_server_info",
        "list_checks",
        "get_model",
        "query",
        "query_diff",
    ):
        assert tool_name in tool_map, f"{tool_name} not found in widget mcp tools"
        t = tool_map[tool_name]
        a = t.annotations
        assert a is not None, f"{tool_name} has no annotations"
        assert a.readOnlyHint is True, f"{tool_name}: expected readOnlyHint=True"
        assert a.destructiveHint is False, f"{tool_name}: expected destructiveHint=False"
        assert a.idempotentHint is True, f"{tool_name}: expected idempotentHint=True"
        assert a.title is not None and len(a.title) > 0, f"{tool_name}: title must be set"

    # Closed-world tools (no external warehouse I/O)
    closed_world_tools = ("row_count_diff", "schema_diff", "get_server_info", "list_checks", "get_model")
    for tool_name in closed_world_tools:
        t = tool_map[tool_name]
        assert t.annotations.openWorldHint is False, f"{tool_name}: expected openWorldHint=False"

    # query and query_diff hit the warehouse — openWorldHint must be True
    assert tool_map["query"].annotations.openWorldHint is True, "query: expected openWorldHint=True"
    assert tool_map["query_diff"].annotations.openWorldHint is True, "query_diff: expected openWorldHint=True"


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
            "support_tasks": {
                "query": True,
                "query_base": True,
                "value_diff": True,
                "profile_diff": True,
                "row_count_diff": True,
                "top_k_diff": True,
                "histogram_diff": True,
                "change_analysis": True,
            },
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


# ---------------------------------------------------------------------------
# Test 11: list_checks widget tool is registered with correct resource URI
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_checks_widget_registered():
    """list_checks appears in widget mcp tools/list and its resource URI exists.

    Verifies:
    - tool named 'list_checks' is in widget mcp tool list
    - resource URI 'ui://recce/list_checks.html' is in widget mcp resource list
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert "list_checks" in tool_names
    assert "ui://recce/list_checks.html" in resource_uris


# ---------------------------------------------------------------------------
# Test 12: list_checks returns CallToolResult with correct Pydantic shape + counts
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_checks_returns_calltoolresult_with_pydantic_shape():
    """list_checks handler returns CallToolResult with structuredContent matching ListChecksOutput.

    Verifies:
    - content[0].text is a short human-readable sentence (not a JSON dump)
    - structuredContent passes ListChecksOutput.model_validate()
    - approved/pending counts are derived correctly from the check list
    - empty is_preset field is tolerated (default False)
    """
    from mcp.types import CallToolResult

    import recce.widget_server as ws
    from recce.widget_server import ListChecksOutput

    mock_server = MagicMock()
    mock_server._tool_list_checks = AsyncMock(
        return_value={
            "checks": [
                {
                    "check_id": "aaaaaaaa-0000-0000-0000-000000000001",
                    "name": "Row count check",
                    "type": "row_count_diff",
                    "description": "Checks that row counts match",
                    "params": {"select": "customers"},
                    "is_checked": True,
                    "is_preset": False,
                },
                {
                    "check_id": "aaaaaaaa-0000-0000-0000-000000000002",
                    "name": "Schema check",
                    "type": "schema_diff",
                    "description": "",
                    "params": {},
                    "is_checked": False,
                    "is_preset": True,
                },
            ],
            "total": 2,
            "approved": 1,
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        result = await ws.list_checks()
    finally:
        ws._recce_server = original

    assert isinstance(result, CallToolResult)
    assert len(result.content) == 1
    content_text = result.content[0].text
    assert isinstance(content_text, str)
    assert len(content_text) < 100, f"content too long ({len(content_text)} chars): {content_text!r}"
    assert "widget" in content_text.lower()

    assert result.structuredContent is not None
    validated = ListChecksOutput.model_validate(result.structuredContent)
    assert validated.total == 2
    assert validated.approved == 1
    assert validated.pending == 1
    assert len(validated.checks) == 2
    assert validated.checks[0].is_checked is True
    assert validated.checks[1].is_preset is True
    assert validated.checks[1].is_checked is False


# ---------------------------------------------------------------------------
# Test 13: get_model widget tool is registered with correct resource URI
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_model_widget_registered():
    """get_model appears in widget mcp tools/list and its resource URI exists.

    Verifies:
    - tool named 'get_model' is in widget mcp tool list
    - resource URI 'ui://recce/get_model.html' is in widget mcp resource list
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert "get_model" in tool_names
    assert "ui://recce/get_model.html" in resource_uris


# ---------------------------------------------------------------------------
# Test 14: get_model returns CallToolResult with correct Pydantic shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_model_returns_calltoolresult_with_pydantic_shape():
    """get_model handler returns CallToolResult with structuredContent matching GetModelOutput.

    Verifies:
    - content[0].text is a short human-readable sentence (not a JSON dump)
    - structuredContent passes GetModelOutput.model_validate()
    - columns are normalised from dict → list
    - primary_key is preserved
    - not_found is False when at least one env has data
    """
    from mcp.types import CallToolResult

    import recce.widget_server as ws
    from recce.widget_server import GetModelInput, GetModelOutput

    mock_server = MagicMock()
    mock_server._tool_get_model = AsyncMock(
        return_value={
            "model": {
                "base": {
                    "columns": {
                        "id": {"name": "id", "type": "bigint", "unique": True},
                        "name": {"name": "name", "type": "varchar", "not_null": True},
                        "created_at": {"name": "created_at", "type": "timestamp"},
                    },
                    "primary_key": "id",
                },
                "current": {
                    "columns": {
                        "id": {"name": "id", "type": "bigint", "unique": True},
                        "name": {"name": "name", "type": "varchar", "not_null": True},
                        "created_at": {"name": "created_at", "type": "timestamp"},
                        "updated_at": {"name": "updated_at", "type": "timestamp"},
                    },
                    "primary_key": "id",
                },
            }
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        args = GetModelInput(model_id="model.jaffle_shop.customers")
        result = await ws.get_model(args)
    finally:
        ws._recce_server = original

    assert isinstance(result, CallToolResult)
    assert len(result.content) == 1
    content_text = result.content[0].text
    assert isinstance(content_text, str)
    assert len(content_text) < 120, f"content too long ({len(content_text)} chars): {content_text!r}"
    assert "widget" in content_text.lower()

    assert result.structuredContent is not None
    validated = GetModelOutput.model_validate(result.structuredContent)
    assert validated.model_id == "model.jaffle_shop.customers"
    assert validated.not_found is False
    # base: 3 columns, primary_key=id
    assert validated.base is not None
    assert len(validated.base.columns) == 3
    assert validated.base.primary_key == "id"
    pk_col = next(c for c in validated.base.columns if c.name == "id")
    assert pk_col.unique is True
    # current: 4 columns (added updated_at)
    assert validated.current is not None
    assert len(validated.current.columns) == 4


# ---------------------------------------------------------------------------
# Test 15: query widget tool is registered with correct resource URI
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_widget_registered():
    """query appears in widget mcp tools/list and its resource URI exists.

    Verifies:
    - tool named 'query' is in widget mcp tool list
    - resource URI 'ui://recce/query.html' is in widget mcp resource list
    - sql_template is required in inputSchema
    - base is optional (has default)
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert "query" in tool_names
    assert "ui://recce/query.html" in resource_uris

    # Check inputSchema: sql_template required, base optional.
    # FastMCP wraps the Pydantic model in an 'args' outer envelope
    # (schema is {properties: {args: {$ref: ...}}, required: ["args"]}).
    # The actual field requirements live inside the $defs/QueryInput sub-schema.
    query_tool = next(t for t in tools if t.name == "query")
    schema = query_tool.inputSchema
    assert schema is not None

    # Navigate into the nested QueryInput definition
    defs = schema.get("$defs", {})
    inner_schema = next(iter(defs.values()), schema)  # first $def or top-level
    inner_required = inner_schema.get("required", [])
    inner_props = inner_schema.get("properties", {})
    assert "sql_template" in inner_required, "sql_template must be required"
    assert "base" not in inner_required, "base must be optional (has default)"
    assert "sql_template" in inner_props, "sql_template must be a property"
    assert "base" in inner_props, "base must be a property"


# ---------------------------------------------------------------------------
# Test 16: query returns CallToolResult with correct Pydantic shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_returns_calltoolresult_with_pydantic_shape():
    """query handler returns CallToolResult with structuredContent matching QueryOutput.

    Uses a realistic DataFrame.model_dump shape (confirmed from source reading):
    {columns: [{key, name, type}], data: [[...]], limit, more, total_row_count}

    Verifies:
    - content[0].text is a short human-readable sentence (not a JSON dump)
    - structuredContent passes QueryOutput.model_validate()
    - columns are hydrated correctly into QueryColumnInfo list
    - sql_template is echoed back in structuredContent
    - more/limit/total_row_count are preserved
    """
    from mcp.types import CallToolResult

    import recce.widget_server as ws
    from recce.widget_server import QueryInput, QueryOutput

    mock_server = MagicMock()
    # Realistic DataFrame.model_dump shape (shape verified from recce/tasks/dataframe.py)
    mock_server._tool_query = AsyncMock(
        return_value={
            "columns": [
                {"key": "id", "name": "id", "type": "integer"},
                {"key": "name", "name": "name", "type": "text"},
                {"key": "amount", "name": "amount", "type": "number"},
                {"key": "active", "name": "active", "type": "boolean"},
                {"key": "created_at", "name": "created_at", "type": "date"},
            ],
            "data": [
                [1, "Alice", 99.9, True, "2024-01-01"],
                [2, None, None, False, "2024-02-15"],
            ],
            "limit": 2000,
            "more": False,
            "total_row_count": 2,
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        args = QueryInput(
            sql_template="SELECT id, name, amount, active, created_at FROM {{ ref('customers') }}", base=False
        )
        result = await ws.query(args)
    finally:
        ws._recce_server = original

    assert isinstance(result, CallToolResult)
    assert len(result.content) == 1
    content_text = result.content[0].text
    assert isinstance(content_text, str)
    assert len(content_text) < 120, f"content too long ({len(content_text)} chars): {content_text!r}"
    assert "widget" in content_text.lower()

    assert result.structuredContent is not None
    validated = QueryOutput.model_validate(result.structuredContent)

    # Columns
    assert len(validated.columns) == 5
    assert validated.columns[0].name == "id"
    assert validated.columns[0].type == "integer"
    assert validated.columns[1].name == "name"
    assert validated.columns[1].type == "text"
    assert validated.columns[3].type == "boolean"

    # Data — 2 rows, nulls preserved
    assert len(validated.data) == 2
    assert validated.data[0][0] == 1
    assert validated.data[1][1] is None  # null name
    assert validated.data[1][2] is None  # null amount

    # Metadata
    assert validated.limit == 2000
    assert validated.more is False
    assert validated.total_row_count == 2

    # sql_template echoed back
    assert validated.sql_template is not None
    assert "customers" in validated.sql_template


# ---------------------------------------------------------------------------
# Test 17: query_diff widget tool is registered with correct resource URI
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_diff_widget_registered():
    """query_diff appears in widget mcp tools/list and its resource URI exists.

    Verifies:
    - tool named 'query_diff' is in widget mcp tool list
    - resource URI 'ui://recce/query_diff.html' is in widget mcp resource list
    - sql_template is required; base_sql_template and primary_keys are optional
    """
    from recce.widget_server import mcp

    tools = await mcp.list_tools()
    resources = await mcp.list_resources()

    tool_names = {t.name for t in tools}
    resource_uris = {str(r.uri) for r in resources}

    assert "query_diff" in tool_names
    assert "ui://recce/query_diff.html" in resource_uris

    # Check inputSchema: sql_template required, others optional.
    # FastMCP wraps the Pydantic model in an 'args' outer envelope.
    qd_tool = next(t for t in tools if t.name == "query_diff")
    schema = qd_tool.inputSchema
    assert schema is not None

    defs = schema.get("$defs", {})
    inner_schema = next(iter(defs.values()), schema)
    inner_required = inner_schema.get("required", [])
    inner_props = inner_schema.get("properties", {})
    assert "sql_template" in inner_required, "sql_template must be required"
    assert "base_sql_template" not in inner_required, "base_sql_template must be optional"
    assert "primary_keys" not in inner_required, "primary_keys must be optional"
    assert "sql_template" in inner_props
    assert "base_sql_template" in inner_props
    assert "primary_keys" in inner_props


# ---------------------------------------------------------------------------
# Test 18: query_diff returns CallToolResult with correct Pydantic shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_query_diff_returns_calltoolresult_with_pydantic_shape():
    """query_diff handler returns CallToolResult with structuredContent matching QueryDiffOutput.

    Tests both QueryDiffResult shapes:
    A — side-by-side (no primary_keys → base+current DataFrames)
    B — join diff (primary_keys provided → diff DataFrame with in_a/in_b)

    Verifies:
    - content[0].text is a short human-readable sentence (not a JSON dump)
    - structuredContent passes QueryDiffOutput.model_validate() for both shapes
    - sql_template is echoed back
    - _warning is extracted to output.warning named field
    """
    from mcp.types import CallToolResult

    import recce.widget_server as ws
    from recce.widget_server import QueryDiffInput, QueryDiffOutput

    # ── Shape A: side-by-side (no primary_keys) ──────────────────────────
    mock_server = MagicMock()
    base_df = {
        "columns": [
            {"key": "id", "name": "id", "type": "integer"},
            {"key": "amount", "name": "amount", "type": "number"},
        ],
        "data": [[1, 100.0], [2, 200.0]],
        "limit": 2000,
        "more": False,
        "total_row_count": 2,
    }
    curr_df = {
        "columns": [
            {"key": "id", "name": "id", "type": "integer"},
            {"key": "amount", "name": "amount", "type": "number"},
        ],
        "data": [[1, 110.0], [2, 200.0], [3, 300.0]],
        "limit": 2000,
        "more": False,
        "total_row_count": 3,
    }
    mock_server._tool_query_diff = AsyncMock(
        return_value={
            "base": base_df,
            "current": curr_df,
            "diff": None,
            "_warning": "Base environment not configured",
        }
    )

    original = ws._recce_server
    ws._recce_server = mock_server
    try:
        args = QueryDiffInput(sql_template="SELECT id, amount FROM {{ ref('orders') }}")
        result = await ws.query_diff(args)
    finally:
        ws._recce_server = original

    assert isinstance(result, CallToolResult)
    assert len(result.content) == 1
    content_text = result.content[0].text
    assert isinstance(content_text, str)
    assert len(content_text) < 140, f"content too long ({len(content_text)} chars): {content_text!r}"
    assert "widget" in content_text.lower()

    assert result.structuredContent is not None
    validated_a = QueryDiffOutput.model_validate(result.structuredContent)
    # Shape A: base + current present, diff absent
    assert validated_a.base is not None
    assert validated_a.current is not None
    assert validated_a.diff is None
    assert len(validated_a.base.columns) == 2
    assert len(validated_a.base.data) == 2
    assert len(validated_a.current.data) == 3
    # warning extracted from _warning key
    assert validated_a.warning == "Base environment not configured"
    # sql_template echoed back
    assert validated_a.sql_template is not None
    assert "orders" in validated_a.sql_template

    # ── Shape B: join diff (primary_keys → diff DataFrame with in_a/in_b) ──
    diff_df = {
        "columns": [
            {"key": "id", "name": "id", "type": "integer"},
            {"key": "amount", "name": "amount", "type": "number"},
            {"key": "in_a", "name": "in_a", "type": "boolean"},
            {"key": "in_b", "name": "in_b", "type": "boolean"},
        ],
        "data": [
            [1, 100.0, True, False],  # removed (only in base)
            [3, 300.0, False, True],  # added   (only in current)
        ],
        "limit": 2000,
        "more": False,
        "total_row_count": None,
    }
    mock_server2 = MagicMock()
    mock_server2._tool_query_diff = AsyncMock(return_value={"base": None, "current": None, "diff": diff_df})

    ws._recce_server = mock_server2
    try:
        args_b = QueryDiffInput(
            sql_template="SELECT id, amount FROM {{ ref('orders') }}",
            primary_keys=["id"],
        )
        result_b = await ws.query_diff(args_b)
    finally:
        ws._recce_server = original

    assert isinstance(result_b, CallToolResult)
    validated_b = QueryDiffOutput.model_validate(result_b.structuredContent)
    # Shape B: diff present, base/current absent
    assert validated_b.diff is not None
    assert validated_b.base is None
    assert validated_b.current is None
    # diff DataFrame has 4 columns (including in_a/in_b) and 2 rows
    assert len(validated_b.diff.columns) == 4
    assert len(validated_b.diff.data) == 2
    assert validated_b.warning is None
