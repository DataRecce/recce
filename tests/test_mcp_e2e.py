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


@pytest.fixture
def mcp_e2e_impact(mcp_e2e):
    """Pre-populated for impact_analysis tests.

    customers: modified (different base/curr data → different checksum).
    orders: depends on customers, but same data in both envs → purely downstream.
    """
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

    # orders has SAME data in both envs — only downstream of customers, not directly modified
    helper.create_model(
        "orders",
        base_csv="""\
            id,customer_id,amount
            1,1,100
            2,2,200""",
        curr_csv="""\
            id,customer_id,amount
            1,1,100
            2,2,200""",
        unique_id="model.recce_test.orders",
        depends_on=["model.recce_test.customers"],
        base_columns={"id": "INTEGER", "customer_id": "INTEGER", "amount": "INTEGER"},
        curr_columns={"id": "INTEGER", "customer_id": "INTEGER", "amount": "INTEGER"},
    )

    yield server, helper


class TestImpactAnalysisE2E:
    """Layer 1: impact_analysis with real DuckDB."""

    @pytest.mark.asyncio
    async def test_classifies_modified_and_downstream(self, mcp_e2e_impact):
        """customers modified, orders is downstream."""
        server, helper = mcp_e2e_impact
        result = await server._tool_impact_analysis({})

        # Structure check
        assert "confirmed_impacted_models" in result
        assert "confirmed_not_impacted_models" in result
        assert "errors" in result

        # customers is modified (different data → different checksum)
        model_names = [m["name"] for m in result["confirmed_impacted_models"]]
        assert "customers" in model_names

        customers = next(m for m in result["confirmed_impacted_models"] if m["name"] == "customers")
        assert customers["change_status"] == "modified"
        assert customers["materialized"] == "table"

    @pytest.mark.asyncio
    async def test_downstream_has_null_change_status(self, mcp_e2e_impact):
        """orders is downstream of modified customers — change_status should be null."""
        server, _ = mcp_e2e_impact
        result = await server._tool_impact_analysis({})

        model_names = [m["name"] for m in result["confirmed_impacted_models"]]
        assert "orders" in model_names

        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")
        assert orders["change_status"] is None  # downstream, not directly modified

    @pytest.mark.asyncio
    async def test_no_false_positives_without_siblings(self, mcp_e2e_impact):
        """Only impacted models appear in impacted_models."""
        server, helper = mcp_e2e_impact
        # Add an unrelated model with no dependency on customers
        helper.create_model(
            "unrelated",
            base_csv="id\n1",
            curr_csv="id\n1",
            unique_id="model.recce_test.unrelated",
            base_columns={"id": "INTEGER"},
            curr_columns={"id": "INTEGER"},
        )
        result = await server._tool_impact_analysis({})

        impacted_names = [m["name"] for m in result["confirmed_impacted_models"]]
        assert "unrelated" not in impacted_names
        assert "unrelated" in result["confirmed_not_impacted_models"]

    @pytest.mark.asyncio
    async def test_row_count_populated_for_tables(self, mcp_e2e_impact):
        """Tables get row_count, views get null."""
        server, _ = mcp_e2e_impact
        result = await server._tool_impact_analysis({})

        customers = next(m for m in result["confirmed_impacted_models"] if m["name"] == "customers")
        assert customers["row_count"] is not None
        assert customers["row_count"]["base"] == 2
        assert customers["row_count"]["current"] == 3
        assert customers["row_count"]["delta"] == 1
        # delta_pct = 1/2 * 100 = 50.0
        assert customers["row_count"]["delta_pct"] == 50.0

    @pytest.mark.asyncio
    async def test_row_count_null_for_views(self, mcp_e2e_impact):
        """Views now included in row_count (delta detection signal)."""
        server, helper = mcp_e2e_impact

        # Add a view model
        helper.create_model(
            "customers_view",
            base_csv="id\n1",
            curr_csv="id\n1",
            unique_id="model.recce_test.customers_view",
            depends_on=["model.recce_test.customers"],
            base_columns={"id": "INTEGER"},
            curr_columns={"id": "INTEGER"},
            patch_func=lambda d: d["config"].update({"materialized": "view"}),
        )
        result = await server._tool_impact_analysis({})

        view_model = next((m for m in result["confirmed_impacted_models"] if m["name"] == "customers_view"), None)
        assert view_model is not None
        # Views get row_count (useful metadata signal) but no value_diff
        assert view_model["row_count"] is not None
        assert view_model["value_diff"] is None

    @pytest.mark.asyncio
    async def test_schema_changes_detected(self, mcp_e2e):
        """Column additions/removals appear in schema_changes."""
        server, helper = mcp_e2e

        # Model with schema change: base has (id, name), curr has (id, name, email)
        helper.create_model(
            "users",
            base_csv="id,name\n1,Alice",
            curr_csv="id,name,email\n1,Alice,alice@test.com",
            unique_id="model.recce_test.users",
            base_columns={"id": "INTEGER", "name": "VARCHAR"},
            curr_columns={"id": "INTEGER", "name": "VARCHAR", "email": "VARCHAR"},
        )
        result = await server._tool_impact_analysis({})

        users = next(m for m in result["confirmed_impacted_models"] if m["name"] == "users")
        assert len(users["schema_changes"]) > 0
        added_cols = [c for c in users["schema_changes"] if c["change_status"] == "added"]
        assert any(c["column"] == "email" for c in added_cols)

    @pytest.mark.asyncio
    async def test_schema_changes_empty_when_no_change(self, mcp_e2e_impact):
        """Models with identical schema should have empty schema_changes."""
        server, _ = mcp_e2e_impact
        result = await server._tool_impact_analysis({})

        customers = next(m for m in result["confirmed_impacted_models"] if m["name"] == "customers")
        assert customers["schema_changes"] == []

    @pytest.mark.asyncio
    async def test_next_action_row_count_delta(self, mcp_e2e_impact):
        """Row count delta > 5% on potential model → next_action profile_diff."""
        server, _ = mcp_e2e_impact
        result = await server._tool_impact_analysis({})

        # customers: base=2, curr=3, delta_pct=50%, modified → data_impact depends on value_diff
        customers = next(m for m in result["confirmed_impacted_models"] if m["name"] == "customers")
        # If data_impact is potential (no PK), next_action should suggest profile_diff
        if customers["data_impact"] == "potential":
            assert customers["next_action"] is not None
            assert customers["next_action"]["tool"] == "profile_diff"

    @pytest.mark.asyncio
    async def test_next_action_schema_change(self, mcp_e2e):
        """Schema changes on potential model → next_action profile_diff on changed columns."""
        server, helper = mcp_e2e

        helper.create_model(
            "users",
            base_csv="id,name\n1,Alice",
            curr_csv="id,name,email\n1,Alice,alice@test.com",
            unique_id="model.recce_test.users",
            base_columns={"id": "INTEGER", "name": "VARCHAR"},
            curr_columns={"id": "INTEGER", "name": "VARCHAR", "email": "VARCHAR"},
        )
        result = await server._tool_impact_analysis({})

        users = next(m for m in result["confirmed_impacted_models"] if m["name"] == "users")
        assert users["next_action"] is not None
        assert users["next_action"]["tool"] == "profile_diff"
        assert users["next_action"]["priority"] == "high"
        assert "email" in (users["next_action"].get("columns") or [])

    @pytest.mark.asyncio
    async def test_next_action_downstream_view_low_priority(self, mcp_e2e):
        """Downstream view → next_action with priority=low."""
        server, helper = mcp_e2e

        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100",
            curr_csv="id,amount\n1,200",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        # downstream view of orders
        helper.create_model(
            "orders_view",
            base_csv="id,amount\n1,100",
            curr_csv="id,amount\n1,100",
            unique_id="model.recce_test.orders_view",
            depends_on=["model.recce_test.orders"],
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
            patch_func=lambda d: d["config"].update({"materialized": "view"}),
        )
        result = await server._tool_impact_analysis({"skip_downstream_value_diff": True})

        view = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders_view")
        assert view["data_impact"] == "potential"
        assert view["next_action"] is not None
        assert view["next_action"]["priority"] == "low"

    @pytest.mark.asyncio
    async def test_next_action_null_value_diff_on_view(self, mcp_e2e):
        """Modified view (value_diff=null) → next_action profile_diff."""
        server, helper = mcp_e2e

        # Create a modified view: different data → different checksum → "modified"
        # Views get value_diff=null (skipped), so next_action should trigger
        helper.create_model(
            "stg_orders",
            base_csv="id,amount\n1,100",
            curr_csv="id,amount\n1,200",
            unique_id="model.recce_test.stg_orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
            patch_func=lambda d: d["config"].update({"materialized": "view"}),
        )
        result = await server._tool_impact_analysis({})

        # stg_orders is modified (different checksum) + view (value_diff=null)
        stg = next(m for m in result["confirmed_impacted_models"] if m["name"] == "stg_orders")
        assert stg["change_status"] == "modified"
        assert stg["value_diff"] is None
        assert stg["data_impact"] == "potential"

        assert stg["next_action"] is not None
        assert stg["next_action"]["tool"] == "profile_diff"
        assert stg["next_action"]["columns"] is None  # whole model
        assert stg["next_action"]["priority"] == "high"


class TestImpactAnalysisFullScenario:
    """Full scenario matching ch3-join-shift pattern from spec."""

    @pytest.mark.asyncio
    async def test_full_scenario_modified_with_downstream(self, mcp_e2e):
        """Modified model + downstream + unrelated → correct classification."""
        server, helper = mcp_e2e

        # stg_orders: source (modified, different data)
        helper.create_model(
            "stg_orders",
            base_csv="id,amount\n1,100\n2,200",
            curr_csv="id,amount\n1,150\n2,250",
            unique_id="model.recce_test.stg_orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        # orders: downstream of stg_orders
        helper.create_model(
            "orders",
            base_csv="id,total\n1,100\n2,200",
            curr_csv="id,total\n1,100\n2,200",
            unique_id="model.recce_test.orders",
            depends_on=["model.recce_test.stg_orders"],
            base_columns={"id": "INTEGER", "total": "INTEGER"},
            curr_columns={"id": "INTEGER", "total": "INTEGER"},
        )
        # customers: unrelated model (no dependency)
        helper.create_model(
            "customers",
            base_csv="id,name\n1,Alice",
            curr_csv="id,name\n1,Alice",
            unique_id="model.recce_test.customers",
            base_columns={"id": "INTEGER", "name": "VARCHAR"},
            curr_columns={"id": "INTEGER", "name": "VARCHAR"},
        )

        result = await server._tool_impact_analysis({})

        # Verify classification
        impacted_names = {m["name"] for m in result["confirmed_impacted_models"]}
        assert "stg_orders" in impacted_names
        assert "orders" in impacted_names
        assert "customers" not in impacted_names
        assert "customers" in result["confirmed_not_impacted_models"]

        # Verify row counts
        stg = next(m for m in result["confirmed_impacted_models"] if m["name"] == "stg_orders")
        assert stg["row_count"]["base"] == 2
        assert stg["row_count"]["current"] == 2
        assert stg["row_count"]["delta"] == 0

        # No errors
        assert result["errors"] == []


class TestImpactAnalysisSingleEnv:
    @pytest.mark.asyncio
    async def test_single_env_adds_warning(self, mcp_e2e_single_env):
        server, helper = mcp_e2e_single_env
        # mcp_e2e_single_env fixture already has customers model
        result = await server._tool_impact_analysis({})
        assert "_warning" in result


class TestImpactAnalysisErrorResilience:
    @pytest.mark.asyncio
    async def test_row_count_error_captured_not_fatal(self, mcp_e2e):
        """If row_count_diff fails for one model, others still get results."""
        server, helper = mcp_e2e

        # Create a model in manifest but without a physical table (sql-only, no csv)
        helper.create_model(
            "ghost",
            base_sql="SELECT 1",
            curr_sql="SELECT 1",
            unique_id="model.recce_test.ghost",
            base_columns={"id": "INTEGER"},
            curr_columns={"id": "INTEGER"},
        )
        helper.create_model(
            "real_model",
            base_csv="id\n1",
            curr_csv="id\n1\n2",
            unique_id="model.recce_test.real_model",
            base_columns={"id": "INTEGER"},
            curr_columns={"id": "INTEGER"},
        )
        result = await server._tool_impact_analysis({})

        # Should not crash — structure is intact
        assert "confirmed_impacted_models" in result
        assert "errors" in result

    @pytest.mark.asyncio
    async def test_schema_diff_error_does_not_block_value_diff(self, mcp_e2e):
        """Regression: schema-diff failure must not prevent value-diff from running.

        Before the fix, node_id_by_name was built inside the schema-diff try block.
        If schema-diff raised before building the dict, value-diff would crash with
        UnboundLocalError.
        """
        server, helper = mcp_e2e

        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100",
            curr_csv="id,amount\n1,150",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        helper.add_unique_test("model.recce_test.orders", "orders", "id")

        # Corrupt base node columns to force schema-diff to raise AttributeError
        # (columns=None → None.keys() fails), while keeping classification intact
        from unittest.mock import MagicMock

        original_fn = server.context.get_lineage_diff

        def patched_get_lineage_diff():
            result = original_fn()
            data = result.model_dump(mode="json")
            for nid in list(data.get("base", {}).get("nodes", {}).keys()):
                data["base"]["nodes"][nid]["columns"] = None
            mock_result = MagicMock()
            mock_result.model_dump.return_value = data
            return mock_result

        with patch.object(server.context, "get_lineage_diff", patched_get_lineage_diff):
            result = await server._tool_impact_analysis({})

        # Schema-diff error captured, not fatal
        assert any(e["step"] == "schema_diff" for e in result["errors"])

        # Function returned successfully (no UnboundLocalError)
        assert "confirmed_impacted_models" in result
        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")

        # Value-diff still ran (the whole point of the fix)
        assert orders["value_diff"] is not None
        assert orders["value_diff"]["affected_row_count"] >= 0


class TestImpactAnalysisValueDiff:
    """Phase 2: value_diff with PK detection."""

    @pytest.mark.asyncio
    async def test_value_diff_with_pk(self, mcp_e2e):
        """Models with unique test + changed data get value_diff populated."""
        server, helper = mcp_e2e
        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100\n2,200",
            curr_csv="id,amount\n1,150\n2,200\n3,300",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        helper.add_unique_test("model.recce_test.orders", "orders", "id")

        result = await server._tool_impact_analysis({})
        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")
        vd = orders["value_diff"]
        assert vd is not None
        assert vd["rows_changed"] == 1  # id=1: amount 100→150
        assert vd["rows_added"] == 1  # id=3: new
        assert vd["rows_removed"] == 0
        assert "columns" in vd
        assert "amount" in vd["columns"]
        assert vd["columns"]["amount"]["affected_row_count"] == 1

    @pytest.mark.asyncio
    async def test_no_pk_returns_null(self, mcp_e2e):
        """Models without unique test get value_diff: null."""
        server, helper = mcp_e2e
        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100",
            curr_csv="id,amount\n1,150",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        result = await server._tool_impact_analysis({})
        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")
        assert orders["value_diff"] is None

    @pytest.mark.asyncio
    async def test_skip_value_diff_flag(self, mcp_e2e):
        """skip_value_diff=true keeps value_diff as null even with PK."""
        server, helper = mcp_e2e
        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100",
            curr_csv="id,amount\n1,150",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        helper.add_unique_test("model.recce_test.orders", "orders", "id")
        result = await server._tool_impact_analysis({"skip_value_diff": True})
        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")
        assert orders["value_diff"] is None

    @pytest.mark.asyncio
    async def test_r1_high_rows_changed_stable_count(self, mcp_e2e):
        """R1: rows_changed high + row_count stable → suggest profile_diff on changed columns."""
        server, helper = mcp_e2e

        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100\n2,200",
            curr_csv="id,amount\n1,999\n2,888",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        helper.add_unique_test("model.recce_test.orders", "orders", "id")

        result = await server._tool_impact_analysis({})

        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")
        # row_count: base=2, curr=2, delta=0 (stable)
        # value_diff: rows_changed=2 (100% of matched rows)
        assert orders["row_count"]["delta"] == 0
        assert orders["value_diff"]["affected_row_count"] == 2

        # High change ratio → next_action suggests profile_diff on changed columns
        assert orders["next_action"] is not None
        assert orders["next_action"]["tool"] == "profile_diff"
        assert "amount" in (orders["next_action"]["columns"] or [])

    @pytest.mark.asyncio
    async def test_value_diff_per_column_means(self, mcp_e2e):
        """Per-column base_mean and current_mean for numeric columns."""
        server, helper = mcp_e2e
        helper.create_model(
            "orders",
            base_csv="id,amount\n1,100\n2,200",
            curr_csv="id,amount\n1,150\n2,250",
            unique_id="model.recce_test.orders",
            base_columns={"id": "INTEGER", "amount": "INTEGER"},
            curr_columns={"id": "INTEGER", "amount": "INTEGER"},
        )
        helper.add_unique_test("model.recce_test.orders", "orders", "id")
        result = await server._tool_impact_analysis({})
        orders = next(m for m in result["confirmed_impacted_models"] if m["name"] == "orders")
        vd = orders["value_diff"]
        assert vd["columns"]["amount"]["base_mean"] is not None
        assert vd["columns"]["amount"]["current_mean"] is not None


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
        # _tool_run_check now returns a Run object with result nested inside
        assert "run_id" in result
        assert "type" in result
        assert result["type"] == "lineage_diff"
        assert result["result"] is not None
        assert "nodes" in result["result"]
        assert "edges" in result["result"]

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
        # _tool_run_check now returns a Run object with result nested inside
        assert "run_id" in result
        assert "type" in result
        assert result["type"] == "schema_diff"
        assert result["result"] is not None
        assert "columns" in result["result"]
        assert "data" in result["result"]

    @pytest.mark.asyncio
    async def test_run_check_not_found(self, mcp_e2e_with_data):
        import uuid

        server, _ = mcp_e2e_with_data
        with pytest.raises(ValueError, match="not found"):
            await server._tool_run_check({"check_id": str(uuid.uuid4())})


class TestCreateCheckE2E:
    """Layer 1: create_check with real DuckDB."""

    @pytest.mark.asyncio
    async def test_create_check_row_count_diff(self, mcp_e2e_with_data):
        """create_check creates a check with a linked run."""
        server, _ = mcp_e2e_with_data
        result = await server._tool_create_check(
            {
                "type": "row_count_diff",
                "params": {"node_names": ["customers"]},
                "name": "Row Count Diff of customers",
                "description": "Checking row count changes",
            }
        )

        assert result["created"] is True
        assert result["run_executed"] is True
        assert "run_error" not in result

        # Verify check appears in list_checks
        checks_result = await server._tool_list_checks({})
        assert checks_result["total"] == 1
        assert checks_result["checks"][0]["name"] == "Row Count Diff of customers"
        assert checks_result["checks"][0]["check_id"] == result["check_id"]

    @pytest.mark.asyncio
    async def test_create_check_idempotent(self, mcp_e2e_with_data):
        """Calling create_check twice with same (type, params) does not duplicate."""
        server, _ = mcp_e2e_with_data

        await server._tool_create_check(
            {
                "type": "row_count_diff",
                "params": {"node_names": ["customers"]},
                "name": "First name",
                "description": "First description",
            }
        )
        result2 = await server._tool_create_check(
            {
                "type": "row_count_diff",
                "params": {"node_names": ["customers"]},
                "name": "Updated name",
                "description": "Updated description",
            }
        )

        assert result2["created"] is False

        checks_result = await server._tool_list_checks({})
        assert checks_result["total"] == 1
        assert checks_result["checks"][0]["name"] == "Updated name"

    @pytest.mark.asyncio
    async def test_create_check_then_run_check(self, mcp_e2e_with_data):
        """A check created via create_check can be re-run via run_check."""
        server, _ = mcp_e2e_with_data

        create_result = await server._tool_create_check(
            {
                "type": "row_count_diff",
                "params": {"node_names": ["customers"]},
                "name": "Row Count Check",
            }
        )
        check_id = create_result["check_id"]

        run_result = await server._tool_run_check({"check_id": check_id})
        assert "run_id" in run_result
        assert run_result["type"] == "row_count_diff"


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


class TestValueDiffE2E:
    """Layer 1: value_diff with real DuckDB."""

    @pytest.mark.asyncio
    async def test_value_diff_detects_added_row(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_value_diff({"model": "customers", "primary_key": "id"})
        assert "summary" in result
        assert result["summary"]["added"] == 1  # Charlie added

    @pytest.mark.asyncio
    async def test_value_diff_detail_shows_rows(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_value_diff_detail({"model": "customers", "primary_key": "id"})
        assert isinstance(result, dict)
        assert "data" in result


class TestTopKDiffE2E:
    """Layer 1: top_k_diff with real DuckDB."""

    @pytest.mark.asyncio
    async def test_top_k_diff_returns_values(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_top_k_diff({"model": "customers", "column_name": "name"})
        assert isinstance(result, dict)
        assert "base" in result
        assert "current" in result


class TestHistogramDiffE2E:
    """Layer 1: histogram_diff with real DuckDB."""

    @pytest.mark.asyncio
    async def test_histogram_diff_auto_detects_type(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_histogram_diff({"model": "customers", "column_name": "age"})
        assert isinstance(result, dict)
        assert "base" in result
        assert "current" in result


class TestGetModelE2E:
    """Layer 1: get_model with real DuckDB."""

    @pytest.mark.asyncio
    async def test_get_model_returns_columns(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_get_model({"model_id": "model.recce_test.customers"})
        assert "model" in result
        assert "base" in result["model"]
        assert "current" in result["model"]


class TestGetCllE2E:
    """Layer 1: get_cll with real DuckDB."""

    @pytest.mark.asyncio
    async def test_get_cll_returns_cll_data(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_get_cll({})
        assert isinstance(result, dict)
        assert "nodes" in result
        assert "columns" in result


class TestGetServerInfoE2E:
    """Layer 1: get_server_info with real DuckDB."""

    @pytest.mark.asyncio
    async def test_get_server_info_returns_info(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_get_server_info({})
        assert result["adapter_type"] == "dbt"
        assert "support_tasks" in result
        assert isinstance(result["support_tasks"], dict)


class TestSelectNodesE2E:
    """Layer 1: select_nodes with real DuckDB."""

    @pytest.mark.asyncio
    async def test_select_nodes_returns_node_ids(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_select_nodes({})
        assert "nodes" in result
        assert isinstance(result["nodes"], list)
        # Should contain our models
        assert any("customers" in n for n in result["nodes"])

    @pytest.mark.asyncio
    async def test_select_nodes_filters_test_nodes(self, mcp_e2e_with_data):
        server, _ = mcp_e2e_with_data
        result = await server._tool_select_nodes({})
        for node in result["nodes"]:
            assert not node.startswith("test.")


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
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_query_no_warning(self, mcp_e2e_single_env):
        """query (non-diff) should NOT have _warning even in single-env mode."""
        server, helper = mcp_e2e_single_env
        schema = helper.curr_schema
        result = await server._tool_query({"sql_template": f"SELECT count(*) FROM {schema}.customers"})
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
                "value_diff",
                "value_diff_detail",
                "top_k_diff",
                "histogram_diff",
                "impact_analysis",
                "get_model",
                "get_cll",
                "get_server_info",
                "select_nodes",
                "list_checks",
                "run_check",
                "create_check",
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
