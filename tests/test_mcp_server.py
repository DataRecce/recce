import asyncio
from unittest.mock import MagicMock, patch

import pytest

# Skip all tests in this module if mcp is not available
pytest.importorskip("mcp")

from mcp.types import CallToolRequest, CallToolRequestParams  # noqa: E402

from recce.core import RecceContext  # noqa: E402
from recce.mcp_server import RecceMCPServer, run_mcp_server  # noqa: E402
from recce.models.types import LineageDiff  # noqa: E402
from recce.server import RecceServerMode  # noqa: E402
from recce.tasks.histogram import HistogramDiffTask  # noqa: E402
from recce.tasks.profile import ProfileDiffTask  # noqa: E402
from recce.tasks.query import QueryDiffTask, QueryTask  # noqa: E402
from recce.tasks.rowcount import RowCountDiffTask  # noqa: E402
from recce.tasks.top_k import TopKDiffTask  # noqa: E402
from recce.tasks.valuediff import ValueDiffDetailTask, ValueDiffTask  # noqa: E402


@pytest.fixture
def mcp_server():
    """Fixture to create a RecceMCPServer instance for testing"""
    mock_context = MagicMock(spec=RecceContext)
    return RecceMCPServer(mock_context), mock_context


class TestRecceMCPServer:
    """Test cases for the RecceMCPServer class"""

    def test_server_initialization(self, mcp_server):
        """Test that the MCP server initializes correctly"""
        server, mock_context = mcp_server
        assert server.context == mock_context
        assert server.server is not None
        assert server.server.name == "recce"

    @pytest.mark.asyncio
    async def test_tool_lineage_diff(self, mcp_server):
        """Test the lineage_diff tool"""
        server, mock_context = mcp_server
        # Mock the lineage diff response
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "resource_type": "model",
                        "config": {"materialized": "view"},
                    },
                    "model.project.model_b": {
                        "name": "model_b",
                        "resource_type": "model",
                    },
                },
                "parent_map": {
                    "model.project.model_a": [],
                    "model.project.model_b": ["model.project.model_a"],
                },
            },
            "current": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "resource_type": "model",
                        "config": {"materialized": "view"},
                    },
                    "model.project.model_b": {
                        "name": "model_b",
                        "resource_type": "model",
                    },
                },
                "parent_map": {
                    "model.project.model_a": [],
                    "model.project.model_b": ["model.project.model_a"],
                },
            },
            "diff": {
                "model.project.model_a": {"change_status": "modified"},
            },
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = {
            "model.project.model_a",
            "model.project.model_b",
        }

        # Execute the method
        result = await server._tool_lineage_diff({})

        # Verify the result structure
        assert "nodes" in result
        assert "edges" in result

        # Verify nodes is a DataFrame dict with columns and data
        nodes = result["nodes"]
        assert "columns" in nodes
        assert "data" in nodes

        # Verify data is a list with 2 rows
        assert isinstance(nodes["data"], list)
        assert len(nodes["data"]) == 2

        # Verify edges is a DataFrame dict with columns and data
        edges = result["edges"]
        assert "columns" in edges
        assert "data" in edges
        assert isinstance(edges["data"], list)
        # Verify edges contains the parent-child relationship (model_a -> model_b)
        assert len(edges["data"]) == 1

        mock_context.get_lineage_diff.assert_called_once()
        mock_context.adapter.select_nodes.assert_called()

    @pytest.mark.asyncio
    async def test_tool_schema_diff(self, mcp_server):
        """Test the schema_diff tool"""
        server, mock_context = mcp_server
        # Mock the lineage diff response with schema information
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "resource_type": "model",
                        "columns": {
                            "id": {"name": "id", "type": "integer"},
                            "name": {"name": "name", "type": "text"},
                        },
                    },
                },
            },
            "current": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "resource_type": "model",
                        "columns": {
                            "id": {"name": "id", "type": "integer"},
                            "name": {"name": "name", "type": "text"},
                            "age": {"name": "age", "type": "integer"},
                        },
                    },
                },
            },
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = {"model.project.model_a"}

        # Execute the method
        result = await server._tool_schema_diff({})

        # Verify the result is a DataFrame dict with columns and data
        assert "columns" in result
        assert "data" in result
        assert "limit" in result
        assert "more" in result

        # Verify limit and more fields
        assert result["limit"] == 100
        assert isinstance(result["more"], bool)
        assert isinstance(result["data"], list)
        # Verify the data contains the added column
        assert len(result["data"]) > 0

        mock_context.get_lineage_diff.assert_called_once()

    @pytest.mark.asyncio
    async def test_tool_row_count_diff(self, mcp_server):
        """Test the row_count_diff tool"""
        server, _ = mcp_server
        # Mock the task execution
        mock_result = {"results": [{"node_id": "model.project.my_model", "base": 100, "current": 105, "diff": 5}]}

        with patch.object(RowCountDiffTask, "execute", return_value=mock_result):
            result = await server._tool_row_count_diff({"node_names": ["my_model"]})

        # Verify the result
        assert result == mock_result
        assert "results" in result

    @pytest.mark.asyncio
    async def test_tool_query(self, mcp_server):
        """Test the query tool"""
        server, _ = mcp_server
        # Mock the task execution
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "columns": ["id", "name"],
            "data": [[1, "Alice"], [2, "Bob"]],
        }

        with patch.object(QueryTask, "execute", return_value=mock_result):
            result = await server._tool_query({"sql_template": "SELECT * FROM {{ ref('my_model') }}", "base": False})

        # Verify the result
        assert "columns" in result
        assert "data" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_query_with_base_flag(self, mcp_server):
        """Test the query tool with base environment flag"""
        server, _ = mcp_server
        mock_result = {"columns": ["id"], "data": [[1]]}

        with patch.object(QueryTask, "execute", return_value=mock_result) as mock_execute:
            with patch.object(QueryTask, "__init__", return_value=None):
                task = QueryTask(params={"sql_template": "SELECT 1"})
                task.is_base = True
                task.execute = mock_execute

                result = await server._tool_query({"sql_template": "SELECT 1", "base": True})

                # Verify base flag was set (would need to inspect task creation)
                assert result == mock_result

    @pytest.mark.asyncio
    async def test_tool_query_diff(self, mcp_server):
        """Test the query_diff tool"""
        server, _ = mcp_server
        # Mock the task execution
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "diff": {
                "added": [[3, "Charlie"]],
                "removed": [[1, "Alice"]],
                "modified": [],
            }
        }

        with patch.object(QueryDiffTask, "execute", return_value=mock_result):
            result = await server._tool_query_diff(
                {
                    "sql_template": "SELECT * FROM {{ ref('my_model') }}",
                    "primary_keys": ["id"],
                }
            )

        # Verify the result
        assert "diff" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_profile_diff(self, mcp_server):
        """Test the profile_diff tool"""
        server, _ = mcp_server
        # Mock the task execution
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "columns": {
                "id": {
                    "base": {"min": 1, "max": 100, "avg": 50.5},
                    "current": {"min": 1, "max": 105, "avg": 53.0},
                }
            }
        }

        with patch.object(ProfileDiffTask, "execute", return_value=mock_result):
            result = await server._tool_profile_diff({"model": "my_model", "columns": ["id"]})

        # Verify the result
        assert "columns" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_list_checks(self, mcp_server):
        """Test the list_checks tool"""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunType

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.name = "Test Check"
        mock_check.type = RunType.SCHEMA_DIFF
        mock_check.description = "Test description"
        mock_check.params = {"select": "model_a"}
        mock_check.is_checked = True
        mock_check.is_preset = False

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = [mock_check]
        mock_check_dao.status.return_value = {"total": 1, "approved": 1}

        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            result = await server._tool_list_checks({})

        # Verify the result structure
        assert "checks" in result
        assert "total" in result
        assert "approved" in result
        assert len(result["checks"]) == 1
        assert result["checks"][0]["check_id"] == str(check_id)
        assert result["checks"][0]["name"] == "Test Check"
        assert result["checks"][0]["type"] == "schema_diff"
        assert result["total"] == 1
        assert result["approved"] == 1

    @pytest.mark.asyncio
    async def test_tool_create_check_basic(self, mcp_server):
        """create_check creates a new check and auto-runs it."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import Check, RunStatus, RunType

        check_id = uuid4()
        mock_check = MagicMock(spec=Check)
        mock_check.check_id = check_id

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.error = None

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []  # No existing checks

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check) as mock_create,
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))) as mock_submit,
            patch("recce.apis.check_func.export_persistent_state"),
        ):

            result = await server._tool_create_check(
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["orders"]},
                    "name": "Row Count Diff of orders",
                    "description": "15% increase",
                }
            )

        assert result["check_id"] == str(check_id)
        assert result["created"] is True
        assert result["run_executed"] is True
        assert "run_error" not in result
        mock_create.assert_called_once()
        mock_submit.assert_called_once_with(
            RunType.ROW_COUNT_DIFF,
            params={"node_names": ["orders"]},
            check_id=check_id,
            triggered_by="user",
        )

    @pytest.mark.asyncio
    async def test_tool_create_check_idempotent_update(self, mcp_server):
        """create_check with same (type, params) updates instead of creating."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunStatus, RunType

        check_id = uuid4()
        existing_check = MagicMock()
        existing_check.check_id = check_id
        existing_check.type = RunType.ROW_COUNT_DIFF
        existing_check.params = {"node_names": ["orders"]}
        existing_check.is_checked = True  # Already approved

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.error = None

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = [existing_check]

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))),
            patch("recce.apis.check_func.export_persistent_state"),
        ):
            result = await server._tool_create_check(
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["orders"]},
                    "name": "Updated name",
                    "description": "Updated description",
                }
            )

        assert result["check_id"] == str(check_id)
        assert result["created"] is False
        mock_check_dao.update_check_by_id.assert_called_once()
        call_args = mock_check_dao.update_check_by_id.call_args
        assert call_args[0][0] == check_id
        patch_in = call_args[0][1]
        assert patch_in.name == "Updated name"
        assert patch_in.description == "Updated description"
        assert patch_in.is_checked is None  # Not touching approval

    @pytest.mark.asyncio
    async def test_tool_create_check_metadata_run_for_schema_diff(self, mcp_server):
        """create_check with schema_diff creates a metadata run (no submit_run)."""
        server, mock_context = mcp_server
        from uuid import uuid4

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []

        # Mock lineage diff for schema_diff tool
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {"nodes": {}, "parent_map": {}},
            "current": {"nodes": {}, "parent_map": {}},
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = set()

        # Mock RunDAO to avoid default_context() call in _create_metadata_run
        mock_run_dao = MagicMock()

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check),
            patch("recce.apis.run_func.submit_run") as mock_submit,
            patch("recce.apis.check_func.export_persistent_state"),
            patch("recce.models.RunDAO", return_value=mock_run_dao),
        ):
            result = await server._tool_create_check(
                {
                    "type": "schema_diff",
                    "params": {"node_id": "model.proj.customers"},
                    "name": "Schema Diff of customers",
                }
            )

        assert result["run_executed"] is True
        mock_submit.assert_not_called()
        # Verify a metadata run was created via RunDAO
        mock_run_dao.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_tool_create_check_run_failure(self, mcp_server):
        """create_check returns run_error when the auto-run fails."""
        server, _ = mcp_server
        from recce.models.types import RunStatus

        mock_check = MagicMock()
        mock_check.check_id = MagicMock()

        mock_run = MagicMock()
        mock_run.status = RunStatus.FAILED
        mock_run.error = "Table not found: orders"

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))),
            patch("recce.apis.check_func.export_persistent_state"),
        ):
            result = await server._tool_create_check(
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["orders"]},
                    "name": "Row Count Diff of orders",
                }
            )

        assert result["run_executed"] is False
        assert result["run_error"] == "Table not found: orders"

    @pytest.mark.asyncio
    async def test_tool_create_check_idempotent_update_with_run_failure(self, mcp_server):
        """Idempotent update path also reports run_error when re-run fails."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunStatus, RunType

        check_id = uuid4()
        existing_check = MagicMock()
        existing_check.check_id = check_id
        existing_check.type = RunType.ROW_COUNT_DIFF
        existing_check.params = {"node_names": ["orders"]}

        mock_run = MagicMock()
        mock_run.status = RunStatus.FAILED
        mock_run.error = "Permission denied"

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = [existing_check]

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))),
            patch("recce.apis.check_func.export_persistent_state"),
        ):
            result = await server._tool_create_check(
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["orders"]},
                    "name": "Updated name",
                }
            )

        assert result["created"] is False
        assert result["run_executed"] is False
        assert result["run_error"] == "Permission denied"

    @pytest.mark.asyncio
    async def test_tool_run_check_row_count_diff(self, mcp_server):
        """Test running a row_count_diff check"""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunType

        check_id = uuid4()
        run_id = uuid4()

        # Create mock check with row_count_diff type
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.name = "Row Count Check"
        mock_check.type = RunType.ROW_COUNT_DIFF
        mock_check.params = {"node_names": ["model_a"]}

        # Create mock run
        mock_run = MagicMock()
        mock_run.run_id = run_id
        mock_run.type = RunType.ROW_COUNT_DIFF
        mock_run.result = {"results": [{"node_id": "model.project.model_a", "base": 100, "current": 105, "diff": 5}]}
        mock_run.error = None
        mock_run.check_id = check_id
        mock_run.model_dump.return_value = {
            "run_id": str(run_id),
            "check_id": str(check_id),
            "type": "row_count_diff",
            "result": mock_run.result,
            "error": None,
        }

        # Mock CheckDAO and submit_run
        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            with patch("recce.apis.run_func.submit_run") as mock_submit_run:
                mock_submit_run.return_value = (mock_run, asyncio.sleep(0))
                result = await server._tool_run_check({"check_id": str(check_id)})

        # Verify the result
        assert "run_id" in result
        assert result["run_id"] == str(run_id)
        assert "type" in result
        assert result["type"] == "row_count_diff"
        assert "check_id" in result
        assert result["check_id"] == str(check_id)

    @pytest.mark.asyncio
    async def test_tool_run_check_with_lineage_diff(self, mcp_server):
        """Test running a lineage_diff check delegates to _tool_lineage_diff"""
        server, mock_context = mcp_server
        from uuid import uuid4

        from recce.models.types import LineageDiff, RunType

        check_id = uuid4()

        # Create mock check with lineage_diff type
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.name = "Lineage Check"
        mock_check.type = RunType.LINEAGE_DIFF
        mock_check.params = {"select": "model_a"}

        # Mock lineage diff response
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {"nodes": {}, "parent_map": {}},
            "current": {"nodes": {}, "parent_map": {}},
            "diff": {},
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = set()

        # Mock CheckDAO and RunDAO (for _create_metadata_run)
        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check
        mock_run_dao = MagicMock()

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.models.RunDAO", return_value=mock_run_dao),
        ):
            result = await server._tool_run_check({"check_id": str(check_id)})

        # Result is now a Run.model_dump() dict (not raw lineage_diff result)
        assert "type" in result
        assert "check_id" in result
        # Verify a metadata run was persisted
        mock_run_dao.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_tool_run_check_with_schema_diff(self, mcp_server):
        """Test running a schema_diff check delegates to _tool_schema_diff"""
        server, mock_context = mcp_server
        from uuid import uuid4

        from recce.models.types import LineageDiff, RunType

        check_id = uuid4()

        # Create mock check with schema_diff type
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.name = "Schema Check"
        mock_check.type = RunType.SCHEMA_DIFF
        mock_check.params = {"select": "model_a"}

        # Mock lineage diff response
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {"nodes": {}, "parent_map": {}},
            "current": {"nodes": {}, "parent_map": {}},
            "diff": {},
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = set()

        # Mock CheckDAO and RunDAO (for _create_metadata_run)
        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check
        mock_run_dao = MagicMock()

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.models.RunDAO", return_value=mock_run_dao),
        ):
            result = await server._tool_run_check({"check_id": str(check_id)})

        # Result is now a Run.model_dump() dict (not raw schema_diff result)
        assert "type" in result
        assert "check_id" in result
        # Verify a metadata run was persisted
        mock_run_dao.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_tool_value_diff(self, mcp_server):
        """Test the value_diff tool"""
        server, _ = mcp_server
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "summary": {"total": 100, "added": 5, "removed": 2},
            "data": {"columns": ["column", "matched", "matched_p"], "data": [["id", 93, 93.0]]},
        }

        with patch.object(ValueDiffTask, "execute", return_value=mock_result):
            result = await server._tool_value_diff({"model": "my_model", "primary_key": "id"})

        assert "summary" in result
        assert "data" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_value_diff_detail(self, mcp_server):
        """Test the value_diff_detail tool"""
        server, _ = mcp_server
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "columns": ["id", "name__base", "name__curr"],
            "data": [[1, "Alice", "Alicia"]],
        }

        with patch.object(ValueDiffDetailTask, "execute", return_value=mock_result):
            result = await server._tool_value_diff_detail({"model": "my_model", "primary_key": "id"})

        assert "columns" in result
        assert "data" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_top_k_diff(self, mcp_server):
        """Test the top_k_diff tool"""
        server, _ = mcp_server
        mock_result = {
            "base": {"values": ["a", "b"], "counts": [10, 5], "valids": 15, "total": 15},
            "current": {"values": ["a", "b", "c"], "counts": [10, 5, 3], "valids": 18, "total": 18},
        }

        with patch.object(TopKDiffTask, "execute", return_value=mock_result):
            result = await server._tool_top_k_diff({"model": "my_model", "column_name": "status"})

        assert "base" in result
        assert "current" in result

    @pytest.mark.asyncio
    async def test_tool_histogram_diff(self, mcp_server):
        """Test the histogram_diff tool with auto-detected column type"""
        server, mock_context = mcp_server
        mock_context.build_name_to_unique_id_index.return_value = {"my_model": "model.project.my_model"}
        mock_context.get_model.return_value = {
            "columns": {"age": {"name": "age", "type": "INTEGER"}},
        }

        mock_result = {
            "base": {"counts": [5, 10], "total": 15},
            "current": {"counts": [5, 12], "total": 17},
            "min": 0,
            "max": 100,
            "bin_edges": [0, 50, 100],
            "labels": ["0-50", "50-100"],
        }

        with patch.object(HistogramDiffTask, "execute", return_value=mock_result):
            result = await server._tool_histogram_diff({"model": "my_model", "column_name": "age"})

        assert "base" in result
        assert "current" in result
        mock_context.get_model.assert_called_once_with("model.project.my_model", base=False)

    @pytest.mark.asyncio
    async def test_tool_histogram_diff_missing_model(self, mcp_server):
        """Test histogram_diff raises when model is missing"""
        server, _ = mcp_server
        with pytest.raises(ValueError, match="model is required"):
            await server._tool_histogram_diff({"column_name": "age"})

    @pytest.mark.asyncio
    async def test_tool_histogram_diff_missing_column_name(self, mcp_server):
        """Test histogram_diff raises when column_name is missing"""
        server, _ = mcp_server
        with pytest.raises(ValueError, match="column_name is required"):
            await server._tool_histogram_diff({"model": "my_model"})

    @pytest.mark.asyncio
    async def test_tool_histogram_diff_unknown_column(self, mcp_server):
        """Test histogram_diff raises when column type cannot be determined"""
        server, mock_context = mcp_server
        mock_context.build_name_to_unique_id_index.return_value = {}
        mock_context.get_model.return_value = {"columns": {}}

        with pytest.raises(ValueError, match="Cannot determine column type"):
            await server._tool_histogram_diff({"model": "my_model", "column_name": "unknown"})

    @pytest.mark.asyncio
    async def test_tool_get_model(self, mcp_server):
        """Test the get_model tool"""
        server, mock_context = mcp_server
        mock_context.get_model.side_effect = [
            {"columns": {"id": {"name": "id", "type": "integer"}}},
            {"columns": {"id": {"name": "id", "type": "integer"}, "age": {"name": "age", "type": "integer"}}},
        ]

        result = await server._tool_get_model({"model_id": "model.project.my_model"})

        assert "model" in result
        assert "base" in result["model"]
        assert "current" in result["model"]
        assert mock_context.get_model.call_count == 2

    @pytest.mark.asyncio
    async def test_tool_get_model_missing_id(self, mcp_server):
        """Test get_model raises when model_id is missing"""
        server, _ = mcp_server
        with pytest.raises(ValueError, match="model_id is required"):
            await server._tool_get_model({})

    @pytest.mark.asyncio
    async def test_tool_get_model_not_found(self, mcp_server):
        """Test get_model raises when model not found in either environment"""
        server, mock_context = mcp_server
        mock_context.get_model.return_value = {}

        with pytest.raises(ValueError, match="not found in either environment"):
            await server._tool_get_model({"model_id": "model.project.nonexistent"})

    @pytest.mark.asyncio
    async def test_tool_get_cll(self, mcp_server):
        """Test the get_cll tool"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "dbt"

        mock_cll = MagicMock()
        mock_cll.model_dump.return_value = {
            "nodes": {"model.project.a": {"name": "a"}},
            "columns": {},
            "parent_map": {},
            "child_map": {},
        }
        mock_context.adapter.get_cll.return_value = mock_cll

        result = await server._tool_get_cll({"node_id": "model.project.a"})

        assert "nodes" in result
        mock_context.adapter.get_cll.assert_called_once_with(
            node_id="model.project.a",
            column=None,
            change_analysis=False,
        )

    @pytest.mark.asyncio
    async def test_tool_get_cll_non_dbt(self, mcp_server):
        """Test get_cll raises for non-dbt adapter"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "sqlmesh"

        with pytest.raises(ValueError, match="only available with dbt"):
            await server._tool_get_cll({})

    @pytest.mark.asyncio
    async def test_tool_get_server_info(self, mcp_server):
        """Test the get_server_info tool"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "dbt"
        mock_context.review_mode = False
        mock_context.support_tasks.return_value = {"row_count_diff": True, "query_diff": True}
        mock_context.state_loader = None

        result = await server._tool_get_server_info({})

        assert result["adapter_type"] == "dbt"
        assert result["review_mode"] is False
        assert result["support_tasks"] == {"row_count_diff": True, "query_diff": True}

    @pytest.mark.asyncio
    async def test_tool_select_nodes(self, mcp_server):
        """Test the select_nodes tool"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "dbt"
        mock_context.adapter.select_nodes.return_value = {
            "model.project.model_a",
            "model.project.model_b",
            "test.project.test_a",
        }

        result = await server._tool_select_nodes({"select": "state:modified"})

        assert "nodes" in result
        # Test nodes should be filtered out
        assert "test.project.test_a" not in result["nodes"]
        assert "model.project.model_a" in result["nodes"]
        assert result["nodes"] == sorted(result["nodes"])

    @pytest.mark.asyncio
    async def test_tool_select_nodes_non_dbt(self, mcp_server):
        """Test select_nodes raises for non-dbt adapter"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "sqlmesh"

        with pytest.raises(ValueError, match="only available with dbt"):
            await server._tool_select_nodes({})

    @pytest.mark.asyncio
    async def test_tool_top_k_diff_with_model_dump(self, mcp_server):
        """Test top_k_diff when task returns a Pydantic model (has model_dump)"""
        server, _ = mcp_server
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"base": {"values": ["a"]}, "current": {"values": ["a"]}}

        with patch.object(TopKDiffTask, "execute", return_value=mock_result):
            result = await server._tool_top_k_diff({"model": "m", "column_name": "c"})

        assert "base" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_histogram_diff_with_model_dump(self, mcp_server):
        """Test histogram_diff when task returns a Pydantic model (has model_dump)"""
        server, mock_context = mcp_server
        mock_context.build_name_to_unique_id_index.return_value = {"m": "model.p.m"}
        mock_context.get_model.return_value = {"columns": {"c": {"name": "c", "type": "INTEGER"}}}

        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"base": {"counts": [1]}, "current": {"counts": [2]}}

        with patch.object(HistogramDiffTask, "execute", return_value=mock_result):
            result = await server._tool_histogram_diff({"model": "m", "column_name": "c"})

        assert "base" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_tool_histogram_diff_case_insensitive_column(self, mcp_server):
        """Test histogram_diff resolves column name case-insensitively"""
        server, mock_context = mcp_server
        mock_context.build_name_to_unique_id_index.return_value = {"m": "model.p.m"}
        # Column stored as uppercase in catalog
        mock_context.get_model.return_value = {"columns": {"AGE": {"name": "AGE", "type": "INTEGER"}}}

        mock_result = {"base": {}, "current": {}}
        with patch.object(HistogramDiffTask, "execute", return_value=mock_result):
            result = await server._tool_histogram_diff({"model": "m", "column_name": "age"})

        assert "base" in result

    @pytest.mark.asyncio
    async def test_tool_get_server_info_with_state_loader(self, mcp_server):
        """Test get_server_info includes git and PR info when state_loader is available"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "dbt"
        mock_context.review_mode = False
        mock_context.support_tasks.return_value = {"row_count_diff": True}

        mock_git = MagicMock()
        mock_git.model_dump.return_value = {"branch": "feature/test"}
        mock_pr = MagicMock()
        mock_pr.model_dump.return_value = {"url": "https://github.com/org/repo/pull/1"}

        mock_state = MagicMock()
        mock_state.git = mock_git
        mock_state.pull_request = mock_pr
        mock_context.export_state.return_value = mock_state
        mock_context.state_loader = MagicMock()  # non-None to trigger the branch

        result = await server._tool_get_server_info({})

        assert result["git"] == {"branch": "feature/test"}
        assert result["pull_request"] == {"url": "https://github.com/org/repo/pull/1"}

    @pytest.mark.asyncio
    async def test_tool_get_server_info_state_loader_error(self, mcp_server):
        """Test get_server_info handles export_state errors gracefully"""
        server, mock_context = mcp_server
        mock_context.adapter_type = "dbt"
        mock_context.review_mode = False
        mock_context.support_tasks.return_value = {}
        mock_context.state_loader = MagicMock()
        mock_context.export_state.side_effect = Exception("git error")

        result = await server._tool_get_server_info({})

        # Should still return basic info without git/PR
        assert result["adapter_type"] == "dbt"
        assert "git" not in result

    @pytest.mark.asyncio
    async def test_error_handling(self, mcp_server):
        """Test error handling in tool execution"""
        server, mock_context = mcp_server
        # Make get_lineage_diff raise an exception
        mock_context.get_lineage_diff.side_effect = Exception("Test error")

        # The method should raise the exception
        with pytest.raises(Exception, match="Test error"):
            await server._tool_lineage_diff({})


class TestCreateMetadataRun:
    """Test cases for the _create_metadata_run helper method."""

    @pytest.fixture
    def mcp_server(self):
        mock_context = MagicMock(spec=RecceContext)
        return RecceMCPServer(mock_context), mock_context

    @pytest.mark.asyncio
    async def test_creates_run_with_correct_fields(self, mcp_server):
        """_create_metadata_run creates a Run with correct type, params, check_id, and result."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunStatus, RunType

        check_id = uuid4()
        params = {"select": "model_a"}
        result_data = {"columns": ["col1"], "data": [["val1"]]}

        mock_run_dao = MagicMock()
        with patch("recce.models.RunDAO", return_value=mock_run_dao):
            run = server._create_metadata_run(
                check_type=RunType.SCHEMA_DIFF,
                params=params,
                check_id=check_id,
                result=result_data,
                triggered_by="recce_ai",
            )

        assert run.type == RunType.SCHEMA_DIFF
        assert run.params == params
        assert run.check_id == check_id
        assert run.result == result_data
        assert run.status == RunStatus.FINISHED
        assert run.triggered_by == "recce_ai"
        assert run.name is not None  # generate_run_name should set it
        mock_run_dao.create.assert_called_once_with(run)

    @pytest.mark.asyncio
    async def test_creates_run_for_lineage_diff(self, mcp_server):
        """_create_metadata_run works for lineage_diff type."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunType

        check_id = uuid4()
        result_data = {"nodes": {}, "edges": {}}

        mock_run_dao = MagicMock()
        with patch("recce.models.RunDAO", return_value=mock_run_dao):
            run = server._create_metadata_run(
                check_type=RunType.LINEAGE_DIFF,
                params={},
                check_id=check_id,
                result=result_data,
                triggered_by="user",
            )

        assert run.type == RunType.LINEAGE_DIFF
        assert run.triggered_by == "user"
        assert run.name == "Lineage diff"
        mock_run_dao.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_triggered_by_none_allowed(self, mcp_server):
        """_create_metadata_run accepts triggered_by=None."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunType

        check_id = uuid4()

        mock_run_dao = MagicMock()
        with patch("recce.models.RunDAO", return_value=mock_run_dao):
            run = server._create_metadata_run(
                check_type=RunType.LINEAGE_DIFF,
                params={},
                check_id=check_id,
                result={},
                triggered_by=None,
            )

        assert run.triggered_by is None


class TestCreateCheckTriggeredBy:
    """Test cases for triggered_by propagation in create_check and run_check."""

    @pytest.fixture
    def mcp_server(self):
        mock_context = MagicMock(spec=RecceContext)
        return RecceMCPServer(mock_context), mock_context

    @pytest.mark.asyncio
    async def test_create_check_passes_triggered_by_to_submit_run(self, mcp_server):
        """create_check passes triggered_by from arguments to submit_run."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import Check, RunStatus, RunType

        check_id = uuid4()
        mock_check = MagicMock(spec=Check)
        mock_check.check_id = check_id

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.error = None

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))) as mock_submit,
            patch("recce.apis.check_func.export_persistent_state"),
        ):
            await server._tool_create_check(
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["orders"]},
                    "name": "Row Count Diff",
                    "triggered_by": "recce_ai",
                }
            )

        mock_submit.assert_called_once_with(
            RunType.ROW_COUNT_DIFF,
            params={"node_names": ["orders"]},
            check_id=check_id,
            triggered_by="recce_ai",
        )

    @pytest.mark.asyncio
    async def test_create_check_triggered_by_defaults_to_user(self, mcp_server):
        """create_check defaults triggered_by to 'user' when not specified."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import Check, RunStatus, RunType

        check_id = uuid4()
        mock_check = MagicMock(spec=Check)
        mock_check.check_id = check_id

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.error = None

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))) as mock_submit,
            patch("recce.apis.check_func.export_persistent_state"),
        ):
            await server._tool_create_check(
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["orders"]},
                    "name": "Row Count Diff",
                }
            )

        mock_submit.assert_called_once_with(
            RunType.ROW_COUNT_DIFF,
            params={"node_names": ["orders"]},
            check_id=check_id,
            triggered_by="user",
        )

    @pytest.mark.asyncio
    async def test_create_check_metadata_run_passes_triggered_by(self, mcp_server):
        """create_check passes triggered_by to _create_metadata_run for schema_diff."""
        server, mock_context = mcp_server
        from uuid import uuid4

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []

        # Mock schema_diff dependencies
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {"nodes": {}, "parent_map": {}},
            "current": {"nodes": {}, "parent_map": {}},
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = set()

        mock_run_dao = MagicMock()

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check),
            patch("recce.apis.check_func.export_persistent_state"),
            patch("recce.models.RunDAO", return_value=mock_run_dao),
        ):
            await server._tool_create_check(
                {
                    "type": "schema_diff",
                    "params": {},
                    "name": "Schema Diff",
                    "triggered_by": "recce_ai",
                }
            )

        # Verify the Run created via RunDAO has triggered_by="recce_ai"
        created_run = mock_run_dao.create.call_args[0][0]
        assert created_run.triggered_by == "recce_ai"

    @pytest.mark.asyncio
    async def test_run_check_passes_triggered_by(self, mcp_server):
        """run_check passes triggered_by from arguments to submit_run."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunStatus, RunType

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.type = RunType.ROW_COUNT_DIFF
        mock_check.params = {"node_names": ["orders"]}

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.model_dump.return_value = {"run_id": "fake", "type": "row_count_diff"}

        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))) as mock_submit,
        ):
            await server._tool_run_check({"check_id": str(check_id), "triggered_by": "recce_ai"})

        mock_submit.assert_called_once_with(
            RunType.ROW_COUNT_DIFF,
            params={"node_names": ["orders"]},
            check_id=str(check_id),
            triggered_by="recce_ai",
        )

    @pytest.mark.asyncio
    async def test_run_check_triggered_by_defaults_to_user(self, mcp_server):
        """run_check defaults triggered_by to 'user' when not specified."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.models.types import RunStatus, RunType

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.type = RunType.ROW_COUNT_DIFF
        mock_check.params = {"node_names": ["orders"]}

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.model_dump.return_value = {"run_id": "fake", "type": "row_count_diff"}

        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))) as mock_submit,
        ):
            await server._tool_run_check({"check_id": str(check_id)})

        mock_submit.assert_called_once_with(
            RunType.ROW_COUNT_DIFF,
            params={"node_names": ["orders"]},
            check_id=str(check_id),
            triggered_by="user",
        )


class TestRunMCPServer:
    """Test cases for the run_mcp_server function"""

    @pytest.mark.asyncio
    @patch("recce.mcp_server.load_context")
    @patch.object(RecceMCPServer, "run")
    async def test_run_mcp_server(self, mock_run, mock_load_context):
        """Test the run_mcp_server entry point"""
        # Mock the context
        mock_context = MagicMock(spec=RecceContext)
        mock_load_context.return_value = mock_context

        # Mock the server run method
        mock_run.return_value = None

        # Run the server
        await run_mcp_server(project_dir="/test/path")

        # Verify context was loaded with correct kwargs
        mock_load_context.assert_called_once_with(project_dir="/test/path")

        # Verify server was run
        mock_run.assert_called_once()

    @pytest.mark.asyncio
    @patch("recce.mcp_server.load_context")
    @patch.object(RecceMCPServer, "run")
    async def test_run_mcp_server_passes_single_env(self, mock_run, mock_load_context):
        """Test that run_mcp_server pops single_env from kwargs and passes it to constructor"""
        mock_context = MagicMock(spec=RecceContext)
        mock_load_context.return_value = mock_context
        mock_run.return_value = None

        init_kwargs = {}

        def capture_init(self_arg, *args, **kw):
            init_kwargs.update(kw)
            self_arg.context = mock_context
            self_arg.state_loader = kw.get("state_loader")
            self_arg.mode = RecceServerMode.server
            self_arg.single_env = kw.get("single_env", False)
            self_arg.server = MagicMock()
            self_arg.mcp_logger = MagicMock()

        with patch.object(RecceMCPServer, "__init__", side_effect=capture_init):
            await run_mcp_server(project_dir="/test/path", single_env=True)

        # Verify single_env was passed to constructor
        assert init_kwargs.get("single_env") is True

        # Verify single_env was NOT passed to load_context (it should be popped)
        load_context_kwargs = mock_load_context.call_args[1]
        assert "single_env" not in load_context_kwargs

    @pytest.mark.asyncio
    @patch("recce.mcp_server.load_context")
    async def test_run_mcp_server_context_error(self, mock_load_context):
        """Test run_mcp_server handles context loading errors"""
        # Make load_context raise an exception
        mock_load_context.side_effect = FileNotFoundError("manifest.json not found")

        # The function should raise the exception
        with pytest.raises(FileNotFoundError):
            await run_mcp_server()


def test_mcp_cli_command_exists():
    """Test that the mcp-server CLI command is registered"""
    from recce.cli import cli

    # Check that mcp_server is in the CLI commands
    commands = [cmd.name for cmd in cli.commands.values()]
    assert "mcp_server" in commands or "mcp-server" in commands


class TestMCPServerModes:
    """Test cases for MCP server mode functionality"""

    def test_server_mode_default(self):
        """Test that server mode is the default when not specified"""
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context)

        # Default mode should be server
        assert server.mode == RecceServerMode.server

    def test_non_server_mode_restricts_tools(self):
        """Test that non-server mode (preview, read-only) restricts diff tools"""
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context, mode=RecceServerMode.preview)

        # Verify mode is set correctly
        assert server.mode == RecceServerMode.preview
        # Verify it's not server mode
        assert server.mode != RecceServerMode.server

    @pytest.mark.asyncio
    async def test_non_server_mode_blocks_new_diff_tools(self):
        """Test that preview mode blocks new diff tools but allows metadata tools"""
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context, mode=RecceServerMode.preview)

        blocked_tools = ["value_diff", "value_diff_detail", "top_k_diff", "histogram_diff"]
        for tool_name in blocked_tools:
            result = await TestCallToolHandler._invoke_call_tool(server, tool_name, {})
            assert result.root.isError is True

    @pytest.mark.asyncio
    async def test_create_check_in_server_mode_tools(self):
        """create_check tool is available in server mode."""
        from mcp.types import ListToolsRequest

        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context, mode=RecceServerMode.server)
        handler = server.server.request_handlers[ListToolsRequest]
        result = await handler(ListToolsRequest(method="tools/list"))
        tools = result.root.tools
        tool_names = [t.name for t in tools]
        assert "create_check" in tool_names

    @pytest.mark.asyncio
    async def test_create_check_blocked_in_non_server_mode(self):
        """create_check is blocked in preview/read-only mode."""
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context, mode=RecceServerMode.preview)
        r = await TestCallToolHandler._invoke_call_tool(
            server,
            "create_check",
            {"type": "row_count_diff", "params": {}, "name": "test"},
        )
        assert r.root.isError is True


@pytest.fixture
def mcp_server_single_env():
    """Fixture for single-env mode MCP server"""
    mock_context = MagicMock(spec=RecceContext)
    return RecceMCPServer(mock_context, single_env=True), mock_context


class TestMCPServerSingleEnv:
    """Test cases for single-env onboarding mode"""

    def test_single_env_flag_stored(self):
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context, single_env=True)
        assert server.single_env is True

    def test_single_env_flag_default_false(self):
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context)
        assert server.single_env is False

    def test_instructions_set_in_single_env(self):
        """Server instructions should inform agent about single-env mode"""
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context, single_env=True)
        assert server.server.instructions is not None
        assert "single-environment mode" in server.server.instructions
        assert "target-base" in server.server.instructions

    def test_instructions_none_in_normal_mode(self):
        """Server instructions should be None in normal mode"""
        mock_context = MagicMock(spec=RecceContext)
        server = RecceMCPServer(mock_context)
        assert server.server.instructions is None

    @pytest.mark.asyncio
    async def test_row_count_diff_has_warning_in_single_env(self, mcp_server_single_env):
        server, _ = mcp_server_single_env
        mock_result = {"model_a": {"base": 100, "curr": 100}}
        with patch.object(RowCountDiffTask, "execute", return_value=mock_result):
            result = await server._tool_row_count_diff({"node_names": ["model_a"]})
        assert "_warning" in result
        assert "target-path target-base" in result["_warning"]

    @pytest.mark.asyncio
    async def test_row_count_diff_no_warning_in_normal_mode(self, mcp_server):
        server, _ = mcp_server
        mock_result = {"model_a": {"base": 100, "curr": 105}}
        with patch.object(RowCountDiffTask, "execute", return_value=mock_result):
            result = await server._tool_row_count_diff({"node_names": ["model_a"]})
        assert "_warning" not in result

    @pytest.mark.asyncio
    async def test_query_diff_has_warning_in_single_env(self, mcp_server_single_env):
        server, _ = mcp_server_single_env
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"diff": {"added": [], "removed": [], "modified": []}}
        with patch.object(QueryDiffTask, "execute", return_value=mock_result):
            result = await server._tool_query_diff({"sql_template": "SELECT 1"})
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_profile_diff_has_warning_in_single_env(self, mcp_server_single_env):
        server, _ = mcp_server_single_env
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"columns": {}}
        with patch.object(ProfileDiffTask, "execute", return_value=mock_result):
            result = await server._tool_profile_diff({"model": "my_model"})
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_value_diff_has_warning_in_single_env(self, mcp_server_single_env):
        server, _ = mcp_server_single_env
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"summary": {"total": 10, "added": 0, "removed": 0}, "data": {}}
        with patch.object(ValueDiffTask, "execute", return_value=mock_result):
            result = await server._tool_value_diff({"model": "m", "primary_key": "id"})
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_value_diff_detail_has_warning_in_single_env(self, mcp_server_single_env):
        server, _ = mcp_server_single_env
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"columns": [], "data": []}
        with patch.object(ValueDiffDetailTask, "execute", return_value=mock_result):
            result = await server._tool_value_diff_detail({"model": "m", "primary_key": "id"})
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_top_k_diff_has_warning_in_single_env(self, mcp_server_single_env):
        server, _ = mcp_server_single_env
        mock_result = {"base": {}, "current": {}}
        with patch.object(TopKDiffTask, "execute", return_value=mock_result):
            result = await server._tool_top_k_diff({"model": "m", "column_name": "c"})
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_histogram_diff_has_warning_in_single_env(self, mcp_server_single_env):
        server, mock_context = mcp_server_single_env
        mock_context.build_name_to_unique_id_index.return_value = {"m": "model.p.m"}
        mock_context.get_model.return_value = {"columns": {"c": {"name": "c", "type": "INTEGER"}}}
        mock_result = {"base": {}, "current": {}}
        with patch.object(HistogramDiffTask, "execute", return_value=mock_result):
            result = await server._tool_histogram_diff({"model": "m", "column_name": "c"})
        assert "_warning" in result

    @pytest.mark.asyncio
    async def test_query_no_warning_in_single_env(self, mcp_server_single_env):
        """query (single-env) is NOT a diff tool, should have no warning"""
        server, _ = mcp_server_single_env
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {"columns": ["id"], "data": [[1]]}
        with patch.object(QueryTask, "execute", return_value=mock_result):
            result = await server._tool_query({"sql_template": "SELECT 1"})
        assert "_warning" not in result

    @pytest.mark.asyncio
    async def test_diff_tool_descriptions_have_single_env_note(self, mcp_server_single_env):
        """Diff tool descriptions should include single-env note when in single-env mode"""
        from mcp.types import ListToolsRequest

        server, _ = mcp_server_single_env
        handler = server.server.request_handlers[ListToolsRequest]
        result = await handler(ListToolsRequest(method="tools/list"))
        tools = result.root.tools

        diff_tool_names = {
            "row_count_diff",
            "query_diff",
            "profile_diff",
            "value_diff",
            "value_diff_detail",
            "top_k_diff",
            "histogram_diff",
        }
        note_text = "base environment is not configured"

        for tool in tools:
            if tool.name in diff_tool_names:
                assert note_text in tool.description, f"Tool '{tool.name}' description should contain single-env note"

    @pytest.mark.asyncio
    async def test_diff_tool_descriptions_no_note_in_normal_mode(self, mcp_server):
        """Diff tool descriptions should NOT include single-env note in normal mode"""
        from mcp.types import ListToolsRequest

        server, _ = mcp_server
        handler = server.server.request_handlers[ListToolsRequest]
        result = await handler(ListToolsRequest(method="tools/list"))
        tools = result.root.tools

        note_text = "base environment is not configured"

        for tool in tools:
            assert (
                note_text not in tool.description
            ), f"Tool '{tool.name}' should not have single-env note in normal mode"


class TestErrorClassification:
    """Test the _classify_db_error method and call_tool error handling"""

    def test_classify_table_not_found(self, mcp_server):
        server, _ = mcp_server
        assert server._classify_db_error("Object 'MY_TABLE' does not exist") == "table_not_found"
        assert server._classify_db_error("42S02: table not found") == "table_not_found"
        assert server._classify_db_error("42P01: relation does not exist") == "table_not_found"
        assert server._classify_db_error("Catalog Error: Table with name foo does not exist!") == "table_not_found"

    def test_classify_permission_denied(self, mcp_server):
        server, _ = mcp_server
        assert server._classify_db_error("SQL access control error: Insufficient privileges") == "permission_denied"
        assert server._classify_db_error("Permission denied for table users") == "permission_denied"
        assert server._classify_db_error("Not authorized to access object") == "permission_denied"

    def test_classify_syntax_error(self, mcp_server):
        server, _ = mcp_server
        assert server._classify_db_error("SQL compilation error: syntax error") == "syntax_error"
        assert server._classify_db_error("Parser Error: blah blah") == "syntax_error"

    def test_classify_permission_denied_takes_priority(self, mcp_server):
        """When error matches both permission_denied and table_not_found, permission_denied wins."""
        server, _ = mcp_server
        # "access denied" (permission) + "does not exist" (table_not_found) in same message
        assert server._classify_db_error("Access denied: object does not exist") == "permission_denied"

    def test_classify_unknown_error(self, mcp_server):
        server, _ = mcp_server
        assert server._classify_db_error("Connection refused") is None
        assert server._classify_db_error("Internal server error") is None

    def test_classify_snowflake_table_does_not_exist_or_not_authorized(self, mcp_server):
        """DRC-3052 / RECCE-746: Snowflake 'does not exist or not authorized' matches permission_denied first."""
        server, _ = mcp_server
        assert (
            server._classify_db_error(
                "Database Error: Table 'FCT_GHA_AUCTION_COMBINED_SPEND' does not exist or not authorized."
            )
            == "permission_denied"
        )

    def test_classify_snowflake_schema_does_not_exist_or_not_authorized(self, mcp_server):
        """DRC-3052 / RECCE-7A7: Schema variant also matches permission_denied first."""
        server, _ = mcp_server
        assert (
            server._classify_db_error(
                "Database Error: Schema 'PARADIME_TURBO_CI_PR_628_BASE' does not exist or not authorized."
            )
            == "permission_denied"
        )

    def test_classify_snowflake_object_does_not_exist_or_not_authorized(self, mcp_server):
        """DRC-3052 / RECCE-73P: Object variant also matches permission_denied first."""
        server, _ = mcp_server
        assert (
            server._classify_db_error(
                "Database Error: Object 'STG_PRODUCT_ANALYTICS_EVENTS' does not exist or not authorized."
            )
            == "permission_denied"
        )

    def test_classify_snowflake_invalid_query_block(self, mcp_server):
        """DRC-3054 / RECCE-72T: Snowflake 002076 (42601) SQL compilation error."""
        server, _ = mcp_server
        assert server._classify_db_error("SQL compilation error: Invalid query block 'db_staging'") == "syntax_error"

    def test_classify_snowflake_column_count_mismatch(self, mcp_server):
        """DRC-3054 / RECCE-73R: Snowflake 002057 (42601) view definition mismatch."""
        server, _ = mcp_server
        assert (
            server._classify_db_error("SQL compilation error: View definition column count mismatch in MART_VISITS")
            == "syntax_error"
        )

    def test_classify_snowflake_invalid_identifier(self, mcp_server):
        """DRC-3053 / RECCE-8BZ: Snowflake 000904 (42000) invalid column reference."""
        server, _ = mcp_server
        assert server._classify_db_error("SQL compilation error: invalid identifier 'DBT_VALID_FROM'") == "syntax_error"

    def test_classify_recce_exception_model_not_found(self, mcp_server):
        """DRC-3051: RecceException from get_columns None guard should classify as table_not_found."""
        server, _ = mcp_server
        msg = "Model 'stg_orders' does not exist in base environment. Check that the model is in the manifest and catalog."
        assert server._classify_db_error(msg) == "table_not_found"

    @pytest.mark.asyncio
    async def test_classified_error_propagates(self, mcp_server):
        """Classified DB errors should still raise (SDK sets isError=True)"""
        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception("Object 'MY_TABLE' does not exist")

        with pytest.raises(Exception, match="does not exist"):
            await server._tool_lineage_diff({})

    @pytest.mark.asyncio
    async def test_unclassified_error_still_raises(self, mcp_server):
        """Unclassified errors should propagate (SDK sets isError=True)"""
        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception("Connection refused")

        with pytest.raises(Exception, match="Connection refused"):
            await server._tool_lineage_diff({})


class TestCallToolHandler:
    """Test the call_tool handler's error classification, logging, and metrics."""

    @staticmethod
    async def _invoke_call_tool(server, tool_name, arguments=None):
        """Invoke the registered call_tool handler directly via MCP Server internals."""
        handler = server.server.request_handlers[CallToolRequest]
        req = CallToolRequest(
            method="tools/call",
            params=CallToolRequestParams(name=tool_name, arguments=arguments or {}),
        )
        return await handler(req)

    @pytest.mark.asyncio
    async def test_classified_error_logs_warning(self, mcp_server, caplog):
        """Classified DB errors should log warning (not error) through call_tool handler."""
        import logging

        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception("Object 'MY_TABLE' does not exist")

        with caplog.at_level(logging.WARNING, logger="recce.mcp_server"):
            result = await self._invoke_call_tool(server, "lineage_diff")

        assert result.root.isError is True
        assert "Expected table_not_found error" in caplog.text

    @pytest.mark.asyncio
    async def test_unclassified_error_logs_error(self, mcp_server, caplog):
        """Unclassified errors should log error through call_tool handler."""
        import logging

        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception("Connection refused")

        with caplog.at_level(logging.ERROR, logger="recce.mcp_server"):
            result = await self._invoke_call_tool(server, "lineage_diff")

        assert result.root.isError is True
        assert "Error executing tool lineage_diff" in caplog.text

    @pytest.mark.asyncio
    async def test_classified_error_emits_sentry_metric(self, mcp_server):
        """Classified errors should emit sentry_metrics.count when sentry_sdk is available."""
        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception("Object 'MY_TABLE' does not exist")

        with patch("recce.mcp_server.sentry_metrics") as mock_metrics:
            await self._invoke_call_tool(server, "lineage_diff")
            mock_metrics.count.assert_called_once_with(
                "mcp.expected_error",
                1,
                attributes={"tool": "lineage_diff", "error_type": "table_not_found"},
            )

    @pytest.mark.asyncio
    async def test_classified_error_skips_metric_when_sentry_unavailable(self, mcp_server):
        """When sentry_metrics is None, no metric is emitted (no crash)."""
        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception("Object 'MY_TABLE' does not exist")

        with patch("recce.mcp_server.sentry_metrics", None):
            result = await self._invoke_call_tool(server, "lineage_diff")

        assert result.root.isError is True

    @pytest.mark.asyncio
    async def test_existing_tools_dispatch_via_call_tool(self, mcp_server):
        """Pre-existing tools dispatch correctly through the call_tool handler."""
        server, mock_context = mcp_server

        # schema_diff
        mock_lineage_diff = MagicMock()
        mock_lineage_diff.model_dump.return_value = {
            "base": {"nodes": {}, "parent_map": {}},
            "current": {"nodes": {}, "parent_map": {}},
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        r = await self._invoke_call_tool(server, "schema_diff", {})
        assert r.root.isError is not True

        # row_count_diff
        with patch.object(RowCountDiffTask, "execute", return_value={"m": {"base": 1, "curr": 1}}):
            r = await self._invoke_call_tool(server, "row_count_diff", {"node_names": ["m"]})
        assert r.root.isError is not True

        # query
        mock_qr = MagicMock()
        mock_qr.model_dump.return_value = {"columns": ["c"], "data": [[1]]}
        with patch.object(QueryTask, "execute", return_value=mock_qr):
            r = await self._invoke_call_tool(server, "query", {"sql_template": "SELECT 1"})
        assert r.root.isError is not True

        # query_diff
        mock_qdr = MagicMock()
        mock_qdr.model_dump.return_value = {"diff": {"added": [], "removed": [], "modified": []}}
        with patch.object(QueryDiffTask, "execute", return_value=mock_qdr):
            r = await self._invoke_call_tool(server, "query_diff", {"sql_template": "SELECT 1"})
        assert r.root.isError is not True

        # profile_diff
        mock_pdr = MagicMock()
        mock_pdr.model_dump.return_value = {"columns": {}}
        with patch.object(ProfileDiffTask, "execute", return_value=mock_pdr):
            r = await self._invoke_call_tool(server, "profile_diff", {"model": "m"})
        assert r.root.isError is not True

        # list_checks
        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []
        mock_check_dao.status.return_value = {"total": 0, "approved": 0}
        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            r = await self._invoke_call_tool(server, "list_checks", {})
        assert r.root.isError is not True

        # run_check (successful dispatch via lineage_diff path)
        from uuid import uuid4

        from recce.models.types import LineageDiff, RunType

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.type = RunType.LINEAGE_DIFF
        mock_check.params = {}

        mock_ld = MagicMock(spec=LineageDiff)
        mock_ld.model_dump.return_value = {
            "base": {"nodes": {}, "parent_map": {}},
            "current": {"nodes": {}, "parent_map": {}},
            "diff": {},
        }
        mock_context.get_lineage_diff.return_value = mock_ld
        mock_context.adapter.select_nodes.return_value = set()

        mock_check_dao2 = MagicMock()
        mock_check_dao2.find_check_by_id.return_value = mock_check
        mock_run_dao = MagicMock()
        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao2),
            patch("recce.models.RunDAO", return_value=mock_run_dao),
        ):
            r = await self._invoke_call_tool(server, "run_check", {"check_id": str(check_id)})
        assert r.root.isError is not True

        # unknown tool
        r = await self._invoke_call_tool(server, "nonexistent_tool", {})
        assert r.root.isError is True

    @pytest.mark.asyncio
    async def test_create_check_dispatches_via_call_tool(self, mcp_server):
        """create_check dispatches correctly through call_tool handler."""
        server, mock_context = mcp_server
        from recce.models.types import RunStatus

        mock_check = MagicMock()
        mock_check.check_id = MagicMock()

        mock_run = MagicMock()
        mock_run.status = RunStatus.FINISHED
        mock_run.error = None

        mock_check_dao = MagicMock()
        mock_check_dao.list.return_value = []

        with (
            patch("recce.models.CheckDAO", return_value=mock_check_dao),
            patch("recce.apis.check_func.create_check_without_run", return_value=mock_check),
            patch("recce.apis.run_func.submit_run", return_value=(mock_run, asyncio.sleep(0))),
            patch("recce.apis.check_func.export_persistent_state"),
        ):
            r = await self._invoke_call_tool(
                server,
                "create_check",
                {
                    "type": "row_count_diff",
                    "params": {"node_names": ["m"]},
                    "name": "test",
                },
            )
        assert r.root.isError is not True

    @pytest.mark.asyncio
    async def test_new_syntax_error_logs_warning(self, mcp_server, caplog):
        """DRC-3053/3054: New SYNTAX_ERROR indicators should log warning through call_tool."""
        import logging

        server, mock_context = mcp_server
        mock_context.get_lineage_diff.side_effect = Exception(
            "SQL compilation error: invalid identifier 'DBT_VALID_FROM'"
        )
        with caplog.at_level(logging.WARNING, logger="recce.mcp_server"):
            result = await self._invoke_call_tool(server, "lineage_diff")
        assert result.root.isError is True
        assert "Expected syntax_error error" in caplog.text

    @pytest.mark.asyncio
    async def test_large_response_truncates_log(self, mcp_server):
        """Large tool responses are truncated in the debug log."""
        server, mock_context = mcp_server
        # Return a large result that serializes to >1000 chars
        large_result = {"data": "x" * 2000}
        with patch.object(RowCountDiffTask, "execute", return_value=large_result):
            r = await self._invoke_call_tool(server, "row_count_diff", {"node_names": ["m"]})
        assert r.root.isError is not True

    @pytest.mark.asyncio
    async def test_new_tools_dispatch_via_call_tool(self, mcp_server):
        """New tools dispatch correctly through the call_tool handler."""
        server, mock_context = mcp_server

        # value_diff
        mock_vd = MagicMock()
        mock_vd.model_dump.return_value = {"summary": {}, "data": {}}
        with patch.object(ValueDiffTask, "execute", return_value=mock_vd):
            r = await self._invoke_call_tool(server, "value_diff", {"model": "m", "primary_key": "id"})
        assert r.root.isError is not True

        # value_diff_detail
        mock_vdd = MagicMock()
        mock_vdd.model_dump.return_value = {"columns": [], "data": []}
        with patch.object(ValueDiffDetailTask, "execute", return_value=mock_vdd):
            r = await self._invoke_call_tool(server, "value_diff_detail", {"model": "m", "primary_key": "id"})
        assert r.root.isError is not True

        # top_k_diff
        with patch.object(TopKDiffTask, "execute", return_value={"base": {}, "current": {}}):
            r = await self._invoke_call_tool(server, "top_k_diff", {"model": "m", "column_name": "c"})
        assert r.root.isError is not True

        # histogram_diff
        mock_context.build_name_to_unique_id_index.return_value = {"m": "model.p.m"}
        mock_context.get_model.return_value = {"columns": {"c": {"name": "c", "type": "INTEGER"}}}
        with patch.object(HistogramDiffTask, "execute", return_value={"base": {}, "current": {}}):
            r = await self._invoke_call_tool(server, "histogram_diff", {"model": "m", "column_name": "c"})
        assert r.root.isError is not True

        # get_model
        mock_context.get_model.side_effect = [{"columns": {}}, {"columns": {}}]
        r = await self._invoke_call_tool(server, "get_model", {"model_id": "model.p.m"})
        assert r.root.isError is not True

        # get_cll
        mock_context.adapter_type = "dbt"
        mock_cll = MagicMock()
        mock_cll.model_dump.return_value = {"nodes": {}, "columns": {}, "parent_map": {}, "child_map": {}}
        mock_context.adapter.get_cll.return_value = mock_cll
        r = await self._invoke_call_tool(server, "get_cll", {})
        assert r.root.isError is not True

        # get_server_info
        mock_context.adapter_type = "dbt"
        mock_context.review_mode = False
        mock_context.support_tasks.return_value = {}
        mock_context.state_loader = None
        r = await self._invoke_call_tool(server, "get_server_info", {})
        assert r.root.isError is not True

        # select_nodes
        mock_context.adapter_type = "dbt"
        mock_context.adapter.select_nodes.return_value = {"model.p.m"}
        r = await self._invoke_call_tool(server, "select_nodes", {})
        assert r.root.isError is not True


class TestLineageDiffEdgeCases:
    """Test edge cases in _tool_lineage_diff"""

    @pytest.mark.asyncio
    async def test_lineage_diff_missing_base_env(self, mcp_server):
        """When lineage_diff has no 'base' key, the loop should skip it (line 549)."""
        server, mock_context = mcp_server
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            # Only "current", no "base"
            "current": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "resource_type": "model",
                        "config": {"materialized": "table"},
                    },
                },
                "parent_map": {"model.project.model_a": []},
            },
            "diff": {},
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff
        mock_context.adapter.select_nodes.return_value = {"model.project.model_a"}

        result = await server._tool_lineage_diff({})

        assert "nodes" in result
        assert len(result["nodes"]["data"]) == 1


class TestSchemaDiffEdgeCases:
    """Test edge cases in _tool_schema_diff for removed and modified columns."""

    @pytest.mark.asyncio
    async def test_schema_diff_removed_column(self, mcp_server):
        """Column in base but not in current should be reported as 'removed' (line 673)."""
        server, mock_context = mcp_server
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "columns": {
                            "id": {"name": "id", "type": "integer"},
                            "legacy_col": {"name": "legacy_col", "type": "text"},
                        },
                    },
                },
            },
            "current": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "columns": {
                            "id": {"name": "id", "type": "integer"},
                        },
                    },
                },
            },
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff

        result = await server._tool_schema_diff({})

        changes = result["data"]
        assert len(changes) == 1
        # data tuple: (node_id, column, change_status)
        assert changes[0][1] == "legacy_col"
        assert changes[0][2] == "removed"

    @pytest.mark.asyncio
    async def test_schema_diff_modified_column_type(self, mcp_server):
        """Column with different type should be reported as 'modified' (line 680)."""
        server, mock_context = mcp_server
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "base": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "columns": {
                            "id": {"name": "id", "type": "integer"},
                            "amount": {"name": "amount", "type": "integer"},
                        },
                    },
                },
            },
            "current": {
                "nodes": {
                    "model.project.model_a": {
                        "name": "model_a",
                        "columns": {
                            "id": {"name": "id", "type": "integer"},
                            "amount": {"name": "amount", "type": "float"},
                        },
                    },
                },
            },
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff

        result = await server._tool_schema_diff({})

        changes = result["data"]
        assert len(changes) == 1
        assert changes[0][1] == "amount"
        assert changes[0][2] == "modified"


class TestRunCheckEdgeCases:
    """Test edge cases in _tool_run_check."""

    @pytest.mark.asyncio
    async def test_run_check_missing_check_id(self, mcp_server):
        """run_check without check_id should raise ValueError (line 792)."""
        server, _ = mcp_server
        with pytest.raises(ValueError, match="check_id is required"):
            await server._tool_run_check({})

    @pytest.mark.asyncio
    async def test_run_check_recce_exception(self, mcp_server):
        """RecceException from submit_run should be wrapped in ValueError (lines 808-809)."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.exceptions import RecceException
        from recce.models.types import RunType

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.type = RunType.ROW_COUNT_DIFF
        mock_check.params = {"node_names": ["model_a"]}

        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            with patch("recce.apis.run_func.submit_run", side_effect=RecceException("Task execution failed")):
                with pytest.raises(ValueError, match="Task execution failed"):
                    await server._tool_run_check({"check_id": str(check_id)})

    @pytest.mark.asyncio
    async def test_run_check_metadata_branch_recce_exception(self, mcp_server):
        """RecceException from _tool_lineage_diff in metadata branch should be wrapped in ValueError."""
        server, _ = mcp_server
        from uuid import uuid4

        from recce.exceptions import RecceException
        from recce.models.types import RunType

        check_id = uuid4()
        mock_check = MagicMock()
        mock_check.check_id = check_id
        mock_check.type = RunType.LINEAGE_DIFF
        mock_check.params = {}

        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            with patch.object(server, "_tool_lineage_diff", side_effect=RecceException("Lineage data unavailable")):
                with pytest.raises(ValueError, match="Lineage data unavailable"):
                    await server._tool_run_check({"check_id": str(check_id)})


class TestQueryRowCountDbtErrors:
    """Test _query_row_count error classification in the dbt path (lines 141, 154)."""

    @staticmethod
    def _make_mock_adapter(execute_side_effect=None):
        """Create a mock dbt adapter that passes through to execute()."""
        adapter = MagicMock()
        node = MagicMock()
        node.resource_type = "model"
        node.config.materialized = "table"
        adapter.find_node_by_name.return_value = node
        adapter.create_relation.return_value = "test_schema.test_model"
        adapter.generate_sql.return_value = "SELECT count(*) FROM test_schema.test_model"
        if execute_side_effect:
            adapter.execute.side_effect = execute_side_effect
        return adapter

    def test_permission_denied_error(self):
        """PERMISSION_DENIED error returns permission_denied status (line 141)."""
        from recce.tasks.rowcount import RowCountStatus, _query_row_count

        adapter = self._make_mock_adapter(
            execute_side_effect=Exception("SQL access control error: Insufficient privileges to operate on table")
        )
        result = _query_row_count(adapter, "test_model")
        assert result["status"] == RowCountStatus.PERMISSION_DENIED
        assert result["count"] is None
        assert "Permission denied" in result["message"]

    def test_table_not_found_error(self):
        """TABLE_NOT_FOUND error returns table_not_found status (line 154)."""
        from recce.tasks.rowcount import RowCountStatus, _query_row_count

        adapter = self._make_mock_adapter(execute_side_effect=Exception("Object 'ANALYTICS.ORDERS' does not exist"))
        result = _query_row_count(adapter, "test_model")
        assert result["status"] == RowCountStatus.TABLE_NOT_FOUND
        assert result["count"] is None
        assert "not found" in result["message"]


class TestImpactAnalysisRegistration:
    """Test impact_analysis tool registration."""

    @pytest.mark.asyncio
    async def test_impact_analysis_in_tool_list(self, mcp_server):
        from mcp.types import ListToolsRequest

        server, mock_context = mcp_server
        handler = server.server.request_handlers[ListToolsRequest]
        result = await handler(ListToolsRequest(method="tools/list"))
        tool_names = [t.name for t in result.root.tools]
        assert "impact_analysis" in tool_names

    @pytest.mark.asyncio
    async def test_impact_analysis_schema_has_select(self, mcp_server):
        from mcp.types import ListToolsRequest

        server, mock_context = mcp_server
        handler = server.server.request_handlers[ListToolsRequest]
        result = await handler(ListToolsRequest(method="tools/list"))
        tool = next(t for t in result.root.tools if t.name == "impact_analysis")
        assert "select" in tool.inputSchema["properties"]
        assert "skip_value_diff" in tool.inputSchema["properties"]
        assert "skip_downstream_value_diff" in tool.inputSchema["properties"]


class TestImpactAnalysisBehavior:
    """Test impact_analysis behavioral logic: data_impact, downstream value_diff."""

    # ---------------------------------------------------------------------------
    # Mock setup helpers
    # ---------------------------------------------------------------------------

    LINEAGE_DIFF_DATA = {
        "base": {
            "nodes": {
                "model.project.modified_model": {
                    "name": "modified_model",
                    "config": {"materialized": "table"},
                    "columns": {
                        "id": {"type": "INTEGER"},
                        "amount": {"type": "DECIMAL"},
                    },
                },
                "model.project.downstream_model": {
                    "name": "downstream_model",
                    "config": {"materialized": "table"},
                    "columns": {
                        "id": {"type": "INTEGER"},
                        "total": {"type": "DECIMAL"},
                    },
                },
                "model.project.view_model": {
                    "name": "view_model",
                    "config": {"materialized": "view"},
                    "columns": {},
                },
            },
            "parent_map": {},
        },
        "current": {
            "nodes": {
                "model.project.modified_model": {
                    "name": "modified_model",
                    "config": {"materialized": "table"},
                    "columns": {
                        "id": {"type": "INTEGER"},
                        "amount": {"type": "DECIMAL"},
                    },
                },
                "model.project.downstream_model": {
                    "name": "downstream_model",
                    "config": {"materialized": "table"},
                    "columns": {
                        "id": {"type": "INTEGER"},
                        "total": {"type": "DECIMAL"},
                    },
                },
                "model.project.view_model": {
                    "name": "view_model",
                    "config": {"materialized": "view"},
                    "columns": {},
                },
            },
            "parent_map": {},
        },
        "diff": {
            "model.project.modified_model": {"change_status": "modified"},
        },
    }

    @staticmethod
    def _make_mock_adapter():
        """Return a mock adapter with all value_diff and row_count hooks wired up."""
        adapter = MagicMock()

        def mock_select_nodes(select=""):
            if any(
                s in select
                for s in [
                    "state:modified.body+",
                    "state:modified.macros+",
                    "state:modified.contract+",
                ]
            ):
                return {
                    "model.project.modified_model",
                    "model.project.downstream_model",
                    "model.project.view_model",
                }
            elif select == "state:modified":
                return {"model.project.modified_model"}
            return set()

        adapter.select_nodes.side_effect = mock_select_nodes

        def mock_get_model(node_id):
            models = {
                "model.project.modified_model": {
                    "primary_key": "id",
                    "columns": {
                        "id": {"type": "INTEGER"},
                        "amount": {"type": "DECIMAL"},
                    },
                },
                "model.project.downstream_model": {
                    "primary_key": "id",
                    "columns": {
                        "id": {"type": "INTEGER"},
                        "total": {"type": "DECIMAL"},
                    },
                },
            }
            return models.get(node_id, {})

        adapter.get_model.side_effect = mock_get_model
        adapter.create_relation.return_value = "some_relation"
        # connection_named is used as a context manager — MagicMock supports this natively
        return adapter

    @staticmethod
    def _make_execute_side_effect(modified_has_changes=True):
        """
        Return a side_effect callable for adapter.execute(query, fetch=True).

        Dispatches on query content (model name in SQL) rather than call order,
        because impacted_models iteration order depends on dict/set ordering.

        Row layout per model:
        - modified_model (non-pk col: amount): [rows_added, rows_removed, rows_changed, amount__changed, amount__base_mean, amount__curr_mean]
        - downstream_model (non-pk col: total): [rows_added, rows_removed, rows_changed, total__changed, total__base_mean, total__curr_mean]
        """

        def side_effect(query, fetch=False):
            # Dispatch on column names in the SQL (create_relation returns a
            # generic mock, so model name won't appear in query).
            # modified_model has column "amount"; downstream_model has "total".
            q = str(query)
            if '"amount"' in q:
                # modified_model
                if modified_has_changes:
                    row = [0, 0, 5, 5, 10.0, 15.0]  # 5 rows changed
                else:
                    row = [0, 0, 0, 0, 10.0, 10.0]
            else:
                # downstream_model (column "total") — zero changes
                row = [0, 0, 0, 0, 5.0, 5.0]
            table = MagicMock()
            table.__len__ = MagicMock(return_value=1)
            table.__getitem__ = MagicMock(side_effect=lambda i: row if i == 0 else None)
            return (None, table)

        return side_effect

    @pytest.fixture
    def setup_impact_mocks(self, mcp_server):
        """Fixture that yields (server, mock_context) with all impact_analysis mocks wired."""
        server, mock_context = mcp_server

        mock_context.get_lineage_diff.return_value = MagicMock(
            model_dump=MagicMock(return_value=self.LINEAGE_DIFF_DATA)
        )

        adapter = self._make_mock_adapter()
        adapter.execute.side_effect = self._make_execute_side_effect(modified_has_changes=True)
        mock_context.adapter = adapter

        return server, mock_context

    @staticmethod
    async def _call_impact_analysis(server, **extra_args):
        """Invoke impact_analysis via the MCP call_tool handler."""
        handler = server.server.request_handlers[CallToolRequest]
        req = CallToolRequest(
            method="tools/call",
            params=CallToolRequestParams(name="impact_analysis", arguments=extra_args),
        )
        result = await handler(req)
        import json

        return json.loads(result.root.content[0].text)

    # ---------------------------------------------------------------------------
    # Tests
    # ---------------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_all_models_have_data_impact(self, setup_impact_mocks):
        """Every model in confirmed_impacted_models must have a data_impact field."""
        server, mock_context = setup_impact_mocks
        valid_values = {"confirmed", "none", "potential"}

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        assert "confirmed_impacted_models" in result
        assert len(result["confirmed_impacted_models"]) > 0
        for model in result["confirmed_impacted_models"]:
            assert "data_impact" in model, f"model {model['name']} missing data_impact"
            assert (
                model["data_impact"] in valid_values
            ), f"model {model['name']} has invalid data_impact: {model['data_impact']}"

    @pytest.mark.asyncio
    async def test_data_impact_confirmed_when_value_changes_exist(self, setup_impact_mocks):
        """Modified model with rows_changed > 0 → data_impact='confirmed'."""
        server, mock_context = setup_impact_mocks
        # adapter.execute already set to return 5 rows_changed for modified_model

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        models_by_name = {m["name"]: m for m in result["confirmed_impacted_models"]}
        assert "modified_model" in models_by_name
        modified = models_by_name["modified_model"]
        assert modified["data_impact"] == "confirmed"
        assert modified["value_diff"] is not None
        assert modified["value_diff"]["affected_row_count"] == 5
        # confirmed models with low change ratio → next_action is None
        # (next_action only set for potential, or confirmed with high change ratio)

    @pytest.mark.asyncio
    async def test_data_impact_none_when_zero_changes(self, setup_impact_mocks):
        """Downstream model with all-zero value_diff → data_impact='none'."""
        server, mock_context = setup_impact_mocks

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        models_by_name = {m["name"]: m for m in result["confirmed_impacted_models"]}
        assert "downstream_model" in models_by_name
        downstream = models_by_name["downstream_model"]
        assert downstream["data_impact"] == "none"
        assert downstream["value_diff"] is not None
        assert downstream["value_diff"]["affected_row_count"] == 0

    @pytest.mark.asyncio
    async def test_potential_has_null_affected_row_count(self, setup_impact_mocks):
        """Views (no value_diff) → data_impact='potential', affected_row_count=None.

        Even if row_count.delta exists, affected_row_count should remain None for
        potential models to avoid misleading callers.
        """
        server, mock_context = setup_impact_mocks
        # Give view_model a non-zero row_count delta to confirm the override to null
        row_count_data = {
            "view_model": {"base": 100, "curr": 110},
            "modified_model": {"base": 50, "curr": 50},
            "downstream_model": {"base": 50, "curr": 50},
        }

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value=row_count_data),
        ):
            result = await self._call_impact_analysis(server)

        models_by_name = {m["name"]: m for m in result["confirmed_impacted_models"]}
        assert "view_model" in models_by_name
        view = models_by_name["view_model"]
        assert view["data_impact"] == "potential"
        assert view["affected_row_count"] is None
        # Potential models always get next_action
        assert view["next_action"] is not None
        assert view["next_action"]["tool"] == "profile_diff"

    @pytest.mark.asyncio
    async def test_guidance_is_descriptive(self, setup_impact_mocks):
        """_guidance must describe data_impact without containing forbidden control text."""
        server, mock_context = setup_impact_mocks

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        assert "_guidance" in result
        guidance = result["_guidance"]
        assert "data_impact" in guidance
        assert "next_action" in guidance
        assert "DO NOT OVERRIDE" not in guidance

    @pytest.mark.asyncio
    async def test_skip_downstream_value_diff(self, mcp_server):
        """skip_downstream_value_diff=True: downstream tables get value_diff=None, data_impact='potential'."""
        server, mock_context = mcp_server

        mock_context.get_lineage_diff.return_value = MagicMock(
            model_dump=MagicMock(return_value=self.LINEAGE_DIFF_DATA)
        )

        adapter = self._make_mock_adapter()
        # Only ONE call expected — for modified_model only
        execute_side_effect = self._make_execute_side_effect(modified_has_changes=True)
        adapter.execute.side_effect = execute_side_effect
        mock_context.adapter = adapter

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server, skip_downstream_value_diff=True)

        models_by_name = {m["name"]: m for m in result["confirmed_impacted_models"]}

        # Modified model still gets value_diff
        assert models_by_name["modified_model"]["value_diff"] is not None
        assert models_by_name["modified_model"]["data_impact"] == "confirmed"

        # Downstream table: skipped → potential with next_action
        assert models_by_name["downstream_model"]["value_diff"] is None
        assert models_by_name["downstream_model"]["data_impact"] == "potential"
        assert models_by_name["downstream_model"]["next_action"] is not None
        assert models_by_name["downstream_model"]["next_action"]["priority"] == "medium"

    @pytest.mark.asyncio
    async def test_skip_value_diff_takes_precedence(self, mcp_server):
        """skip_value_diff=True: ALL models get value_diff=None, data_impact='potential'."""
        server, mock_context = mcp_server

        mock_context.get_lineage_diff.return_value = MagicMock(
            model_dump=MagicMock(return_value=self.LINEAGE_DIFF_DATA)
        )

        adapter = self._make_mock_adapter()
        mock_context.adapter = adapter

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server, skip_value_diff=True, skip_downstream_value_diff=False)

        # adapter.execute should NOT have been called at all
        adapter.execute.assert_not_called()

        for model in result["confirmed_impacted_models"]:
            assert (
                model["value_diff"] is None
            ), f"model {model['name']} should have value_diff=None when skip_value_diff=True"
            assert (
                model["data_impact"] == "potential"
            ), f"model {model['name']} should have data_impact='potential' when skip_value_diff=True"

    @pytest.mark.asyncio
    async def test_confirmed_low_change_ratio_has_null_next_action(self, setup_impact_mocks):
        """Confirmed model with low change ratio → next_action=None."""
        server, mock_context = setup_impact_mocks

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        models_by_name = {m["name"]: m for m in result["confirmed_impacted_models"]}
        modified = models_by_name["modified_model"]
        assert modified["data_impact"] == "confirmed"
        # Mock has 5 rows_changed out of many — not high ratio → null next_action
        assert modified["next_action"] is None

    @pytest.mark.asyncio
    async def test_none_data_impact_has_null_next_action(self, setup_impact_mocks):
        """data_impact='none' (zero changes) → next_action=None."""
        server, mock_context = setup_impact_mocks

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        models_by_name = {m["name"]: m for m in result["confirmed_impacted_models"]}
        downstream = models_by_name["downstream_model"]
        assert downstream["data_impact"] == "none"
        assert downstream["next_action"] is None

    @pytest.mark.asyncio
    async def test_next_action_has_all_required_fields(self, setup_impact_mocks):
        """next_action when present must have tool, columns, reason, priority."""
        server, mock_context = setup_impact_mocks

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        for model in result["confirmed_impacted_models"]:
            if model["next_action"] is not None:
                na = model["next_action"]
                assert "tool" in na, f"{model['name']}: missing tool"
                assert "reason" in na, f"{model['name']}: missing reason"
                assert "priority" in na, f"{model['name']}: missing priority"
                assert na["priority"] in ("high", "medium", "low"), f"{model['name']}: invalid priority"
                assert "columns" in na, f"{model['name']}: missing columns key"

    @pytest.mark.asyncio
    async def test_response_uses_new_field_names(self, setup_impact_mocks):
        """Response must use max_affected_row_count, not total_affected or suggested_deep_dives."""
        server, mock_context = setup_impact_mocks

        with (
            patch("recce.mcp_server.sentry_metrics", None),
            patch.object(RowCountDiffTask, "execute", return_value={}),
        ):
            result = await self._call_impact_analysis(server)

        assert "max_affected_row_count" in result
        assert "total_affected_row_count" not in result
        assert "suggested_deep_dives" not in result
