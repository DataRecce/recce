"""
MCP Server E2E Tests

Tests the MCP server tools against a real DuckDB database using DbtTestHelper.
Two layers:
  - Layer 1: Direct tool method calls with real RecceContext
  - Layer 2: Full MCP protocol via anyio memory streams
"""

import json
from contextlib import asynccontextmanager
from typing import Union
from unittest.mock import patch

import anyio
import pytest

pytest.importorskip("mcp")

from mcp.client.session import ClientSession  # noqa: E402
from mcp.shared.message import SessionMessage  # noqa: E402

from recce.core import set_default_context  # noqa: E402
from recce.mcp_server import RecceMCPServer  # noqa: E402
from tests.adapter.dbt_adapter.dbt_test_helper import DbtTestHelper  # noqa: E402


@asynccontextmanager
async def create_mcp_client(mcp_server: RecceMCPServer):
    """
    Wire MCP ClientSession <-> Server via anyio in-memory streams.

    Creates two pairs of memory streams for bidirectional communication:
    - client_to_server: client writes -> server reads
    - server_to_client: server writes -> client reads
    """
    client_to_server_send, client_to_server_recv = anyio.create_memory_object_stream[Union[SessionMessage, Exception]](
        max_buffer_size=0
    )
    server_to_client_send, server_to_client_recv = anyio.create_memory_object_stream[Union[SessionMessage, Exception]](
        max_buffer_size=0
    )

    async with anyio.create_task_group() as tg:
        tg.start_soon(
            mcp_server.server.run,
            client_to_server_recv,
            server_to_client_send,
            mcp_server.server.create_initialization_options(),
        )
        async with ClientSession(server_to_client_recv, client_to_server_send) as session:
            await session.initialize()
            yield session
            tg.cancel_scope.cancel()


@pytest.fixture
def mcp_e2e():
    """RecceMCPServer backed by real DuckDB via DbtTestHelper."""
    with patch("recce.adapter.dbt_adapter.log_performance"):
        helper = DbtTestHelper()
        set_default_context(helper.context)
        server = RecceMCPServer(helper.context)
        yield server, helper
        helper.cleanup()


@pytest.fixture
def mcp_e2e_with_data(mcp_e2e):
    """Pre-populated with customers (base: 2 rows, curr: 3 rows) and orders models."""
    server, helper = mcp_e2e

    helper.create_model(
        "customers",
        base_csv="""\
            id,name,age
            1,Alice,30
            2,Bob,25""",
        curr_csv="""\
            id,name,age
            1,Alice,30
            2,Bob,25
            3,Charlie,35""",
        unique_id="model.recce_test.customers",
        base_columns={"id": "INTEGER", "name": "VARCHAR", "age": "INTEGER"},
        curr_columns={"id": "INTEGER", "name": "VARCHAR", "age": "INTEGER"},
    )

    helper.create_model(
        "orders",
        base_csv="""\
            id,customer_id,amount
            1,1,100
            2,2,200""",
        curr_csv="""\
            id,customer_id,amount
            1,1,100
            2,2,200
            3,3,300""",
        unique_id="model.recce_test.orders",
        depends_on=["model.recce_test.customers"],
        base_columns={"id": "INTEGER", "customer_id": "INTEGER", "amount": "INTEGER"},
        curr_columns={"id": "INTEGER", "customer_id": "INTEGER", "amount": "INTEGER"},
    )

    yield server, helper


# ---------------------------------------------------------------------------
# Layer 1: Direct tool method calls with real RecceContext
# ---------------------------------------------------------------------------


class TestRowCountDiffE2E:
    """Layer 1: row_count_diff with real DuckDB."""

    @pytest.mark.asyncio
    async def test_row_count_diff_detects_change(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_row_count_diff({"node_names": ["customers"]})
        assert result["customers"]["base"] == 2
        assert result["customers"]["curr"] == 3
        assert result["customers"]["base_meta"]["status"] == "ok"
        assert result["customers"]["curr_meta"]["status"] == "ok"

    @pytest.mark.asyncio
    async def test_row_count_diff_multiple_models(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_row_count_diff({"node_names": ["customers", "orders"]})
        assert result["customers"]["curr"] == 3
        assert result["orders"]["curr"] == 3

    @pytest.mark.asyncio
    async def test_row_count_diff_nonexistent_model(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_row_count_diff({"node_names": ["nonexistent"]})
        assert result["nonexistent"]["base"] is None
        assert result["nonexistent"]["curr"] is None
        assert result["nonexistent"]["base_meta"]["status"] == "not_in_manifest"


class TestQueryE2E:
    """Layer 1: query tool with real DuckDB."""

    @pytest.mark.asyncio
    async def test_query_current_env(self, mcp_e2e_with_data):
        server, helper = mcp_e2e_with_data
        schema = helper.curr_schema
        result = await server._tool_query({"sql_template": f"SELECT count(*) as cnt FROM {schema}.customers"})
        assert "columns" in result
        assert "data" in result
        assert result["data"][0][0] == 3

    @pytest.mark.asyncio
    async def test_query_base_env(self, mcp_e2e_with_data):
        server, helper = mcp_e2e_with_data
        schema = helper.base_schema
        result = await server._tool_query(
            {
                "sql_template": f"SELECT count(*) as cnt FROM {schema}.customers",
                "base": True,
            }
        )
        assert result["data"][0][0] == 2


class TestQueryDiffE2E:
    """Layer 1: query_diff tool with real DuckDB."""

    @pytest.mark.asyncio
    async def test_query_diff_detects_added_row(self, mcp_e2e_with_data):
        server, helper = mcp_e2e_with_data
        curr_schema = helper.curr_schema
        base_schema = helper.base_schema
        result = await server._tool_query_diff(
            {
                "sql_template": f"SELECT id, name FROM {curr_schema}.customers ORDER BY id",
                "base_sql_template": f"SELECT id, name FROM {base_schema}.customers ORDER BY id",
                "primary_keys": ["id"],
            }
        )
        assert isinstance(result, dict)
        assert "diff" in result
        diff = result["diff"]
        assert len(diff["data"]) == 1  # one added row (id=3, Charlie)
        assert diff["data"][0][0] == 3  # id=3


class TestProfileDiffE2E:
    """Layer 1: profile_diff tool with real DuckDB."""

    @pytest.mark.asyncio
    async def test_profile_diff_detects_stats_change(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_profile_diff({"model": "customers", "columns": ["age"]})
        assert isinstance(result, dict)
        assert len(result) > 0


class TestLineageDiffE2E:
    """Layer 1: lineage_diff with real DuckDB context."""

    @pytest.mark.asyncio
    async def test_lineage_diff_returns_nodes_and_edges(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_lineage_diff({})
        assert "nodes" in result
        assert "edges" in result
        nodes = result["nodes"]
        assert "columns" in nodes
        assert "data" in nodes
        assert len(nodes["data"]) >= 2

    @pytest.mark.asyncio
    async def test_lineage_diff_shows_dependency(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_lineage_diff({})
        edges = result["edges"]
        assert len(edges["data"]) >= 1


class TestSchemaDiffE2E:
    """Layer 1: schema_diff with real DuckDB context."""

    @pytest.mark.asyncio
    async def test_schema_diff_detects_added_column(self, mcp_e2e):
        server, helper = mcp_e2e
        helper.create_model(
            "users",
            unique_id="model.recce_test.users",
            base_csv="""\
                id,name
                1,Alice""",
            curr_csv="""\
                id,name,email
                1,Alice,a@b.com""",
            base_columns={"id": "INTEGER", "name": "VARCHAR"},
            curr_columns={
                "id": "INTEGER",
                "name": "VARCHAR",
                "email": "VARCHAR",
            },
        )
        result = await server._tool_schema_diff({})
        assert "data" in result
        changes = result["data"]
        assert len(changes) >= 1
        assert any("email" in str(row) for row in changes)

    @pytest.mark.asyncio
    async def test_schema_diff_no_changes(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_schema_diff({})
        assert "data" in result
        assert len(result["data"]) == 0


class TestCheckToolsE2E:
    """Layer 1: list_checks and run_check with real DuckDB context."""

    @pytest.mark.asyncio
    async def test_list_checks_empty(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_list_checks({})
        assert "checks" in result
        assert "total" in result
        assert result["total"] == 0
        assert result["checks"] == []

    @pytest.mark.asyncio
    async def test_list_checks_with_check(self, mcp_e2e_with_data):
        from recce.models import CheckDAO
        from recce.models.types import Check, RunType

        server, _ = mcp_e2e_with_data
        dao = CheckDAO()
        dao.create(
            Check(
                name="Row Count Check",
                type=RunType.ROW_COUNT_DIFF,
                params={"node_names": ["customers"]},
            )
        )
        result = await server._tool_list_checks({})
        assert result["total"] == 1
        assert result["checks"][0]["name"] == "Row Count Check"
        assert result["checks"][0]["type"] == "row_count_diff"

    @pytest.mark.asyncio
    async def test_run_check_row_count(self, mcp_e2e_with_data):
        from recce.models import CheckDAO
        from recce.models.types import Check, RunType

        server, _ = mcp_e2e_with_data
        dao = CheckDAO()
        check = dao.create(
            Check(
                name="Row Count Check",
                type=RunType.ROW_COUNT_DIFF,
                params={"node_names": ["customers"]},
            )
        )
        result = await server._tool_run_check({"check_id": str(check.check_id)})
        assert "run_id" in result
        assert "type" in result
        assert result["type"] == "row_count_diff"

    @pytest.mark.asyncio
    async def test_run_check_lineage_diff(self, mcp_e2e_with_data):
        from recce.models import CheckDAO
        from recce.models.types import Check, RunType

        server, _ = mcp_e2e_with_data
        dao = CheckDAO()
        check = dao.create(
            Check(
                name="Lineage Check",
                type=RunType.LINEAGE_DIFF,
                params={},
            )
        )
        result = await server._tool_run_check({"check_id": str(check.check_id)})
        assert "nodes" in result
        assert "edges" in result

    @pytest.mark.asyncio
    async def test_run_check_schema_diff(self, mcp_e2e_with_data):
        from recce.models import CheckDAO
        from recce.models.types import Check, RunType

        server, _ = mcp_e2e_with_data
        dao = CheckDAO()
        check = dao.create(
            Check(
                name="Schema Check",
                type=RunType.SCHEMA_DIFF,
                params={},
            )
        )
        result = await server._tool_run_check({"check_id": str(check.check_id)})
        assert "columns" in result
        assert "data" in result

    @pytest.mark.asyncio
    async def test_run_check_not_found(self, mcp_e2e_with_data):
        import uuid

        server, _ = mcp_e2e_with_data
        with pytest.raises(ValueError, match="not found"):
            await server._tool_run_check({"check_id": str(uuid.uuid4())})


@pytest.fixture
def mcp_e2e_single_env():
    """RecceMCPServer in single-env mode with real DuckDB."""
    with patch("recce.adapter.dbt_adapter.log_performance"):
        helper = DbtTestHelper()
        set_default_context(helper.context)
        server = RecceMCPServer(helper.context, single_env=True)

        helper.create_model(
            "customers",
            base_csv="""\
                id,name
                1,Alice
                2,Bob""",
            curr_csv="""\
                id,name
                1,Alice
                2,Bob""",
            unique_id="model.recce_test.customers",
            base_columns={"id": "INTEGER", "name": "VARCHAR"},
            curr_columns={"id": "INTEGER", "name": "VARCHAR"},
        )

        yield server, helper
        helper.cleanup()


class TestSingleEnvModeE2E:
    """Layer 1: single-env mode adds _warning to diff results."""

    @pytest.mark.asyncio
    async def test_row_count_diff_has_warning(self, mcp_e2e_single_env):
        server, _ = mcp_e2e_single_env
        result = await server._tool_row_count_diff({"node_names": ["customers"]})
        assert "_warning" in result
        assert "target-base" in result["_warning"]
        assert result["customers"]["base"] == result["customers"]["curr"]

    @pytest.mark.asyncio
    async def test_query_diff_has_warning(self, mcp_e2e_single_env):
        server, helper = mcp_e2e_single_env
        schema = helper.curr_schema
        result = await server._tool_query_diff({"sql_template": f"SELECT * FROM {schema}.customers"})
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_query_no_warning(self, mcp_e2e_single_env):
        """query (non-diff) should NOT have _warning even in single-env mode."""
        server, helper = mcp_e2e_single_env
        schema = helper.curr_schema
        result = await server._tool_query({"sql_template": f"SELECT count(*) FROM {schema}.customers"})
        if hasattr(result, "model_dump"):
            result = result.model_dump(mode="json")
        assert "_warning" not in result


# ---------------------------------------------------------------------------
# Layer 2: Full MCP protocol via in-memory transport
# ---------------------------------------------------------------------------


class TestMCPProtocolE2E:
    """Layer 2: Full MCP protocol via in-memory transport."""

    @pytest.mark.asyncio
    async def test_list_tools_returns_all_server_mode_tools(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        async with create_mcp_client(server) as client:
            result = await client.list_tools()
            tool_names = {tool.name for tool in result.tools}
            expected = {
                "lineage_diff",
                "schema_diff",
                "row_count_diff",
                "query",
                "query_diff",
                "profile_diff",
                "list_checks",
                "run_check",
            }
            assert expected == tool_names

    @pytest.mark.asyncio
    async def test_call_row_count_diff_via_protocol(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        async with create_mcp_client(server) as client:
            result = await client.call_tool("row_count_diff", {"node_names": ["customers"]})
            assert not result.isError
            data = json.loads(result.content[0].text)
            assert data["customers"]["base"] == 2
            assert data["customers"]["curr"] == 3

    @pytest.mark.asyncio
    async def test_call_lineage_diff_via_protocol(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        async with create_mcp_client(server) as client:
            result = await client.call_tool("lineage_diff", {})
            assert not result.isError
            data = json.loads(result.content[0].text)
            assert "nodes" in data
            assert "edges" in data

    @pytest.mark.asyncio
    async def test_call_query_via_protocol(self, mcp_e2e_with_data):
        server, helper = mcp_e2e_with_data
        schema = helper.curr_schema
        async with create_mcp_client(server) as client:
            result = await client.call_tool(
                "query",
                {"sql_template": f"SELECT count(*) as cnt FROM {schema}.customers"},
            )
            assert not result.isError
            data = json.loads(result.content[0].text)
            assert data["data"][0][0] == 3

    @pytest.mark.asyncio
    async def test_call_list_checks_via_protocol(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        async with create_mcp_client(server) as client:
            result = await client.call_tool("list_checks", {})
            assert not result.isError
            data = json.loads(result.content[0].text)
            assert data["total"] == 0
            assert data["checks"] == []
