import asyncio
from unittest.mock import MagicMock, patch

import pytest

# Skip all tests in this module if mcp is not available
pytest.importorskip("mcp")

from recce.core import RecceContext  # noqa: E402
from recce.mcp_server import RecceMCPServer, run_mcp_server  # noqa: E402
from recce.models.types import LineageDiff  # noqa: E402
from recce.server import RecceServerMode  # noqa: E402
from recce.tasks.profile import ProfileDiffTask  # noqa: E402
from recce.tasks.query import QueryDiffTask, QueryTask  # noqa: E402
from recce.tasks.rowcount import RowCountDiffTask  # noqa: E402


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

        # Mock CheckDAO
        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            result = await server._tool_run_check({"check_id": str(check_id)})

        # Verify the result is from lineage_diff tool (has nodes and edges)
        assert "nodes" in result
        assert "edges" in result

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

        # Mock CheckDAO
        mock_check_dao = MagicMock()
        mock_check_dao.find_check_by_id.return_value = mock_check

        with patch("recce.models.CheckDAO", return_value=mock_check_dao):
            result = await server._tool_run_check({"check_id": str(check_id)})

        # Verify the result is from schema_diff tool (has columns, data, limit, more)
        assert "columns" in result
        assert "data" in result
        assert "limit" in result
        assert "more" in result

    @pytest.mark.asyncio
    async def test_error_handling(self, mcp_server):
        """Test error handling in tool execution"""
        server, mock_context = mcp_server
        # Make get_lineage_diff raise an exception
        mock_context.get_lineage_diff.side_effect = Exception("Test error")

        # The method should raise the exception
        with pytest.raises(Exception, match="Test error"):
            await server._tool_lineage_diff({})


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
