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

        diff_tool_names = {"row_count_diff", "query_diff", "profile_diff"}
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
        assert server._classify_db_error("Catalog Error: table foo not found") == "table_not_found"

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
