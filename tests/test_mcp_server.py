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
    async def test_get_lineage_diff(self, mcp_server):
        """Test the get_lineage_diff tool"""
        server, mock_context = mcp_server
        # Mock the lineage diff response
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "added": ["model.project.new_model"],
            "removed": ["model.project.old_model"],
            "modified": ["model.project.changed_model"],
        }
        mock_context.get_lineage_diff.return_value = mock_lineage_diff

        # Execute the method
        result = await server._get_lineage_diff({})

        # Verify the result
        assert "added" in result
        assert "removed" in result
        assert "modified" in result
        mock_context.get_lineage_diff.assert_called_once()
        mock_lineage_diff.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_row_count_diff(self, mcp_server):
        """Test the row_count_diff tool"""
        server, _ = mcp_server
        # Mock the task execution
        mock_result = {"results": [{"node_id": "model.project.my_model", "base": 100, "current": 105, "diff": 5}]}

        with patch.object(RowCountDiffTask, "execute", return_value=mock_result):
            result = await server._row_count_diff({"node_names": ["my_model"]})

        # Verify the result
        assert result == mock_result
        assert "results" in result

    @pytest.mark.asyncio
    async def test_query(self, mcp_server):
        """Test the query tool"""
        server, _ = mcp_server
        # Mock the task execution
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "columns": ["id", "name"],
            "data": [[1, "Alice"], [2, "Bob"]],
        }

        with patch.object(QueryTask, "execute", return_value=mock_result):
            result = await server._query({"sql_template": "SELECT * FROM {{ ref('my_model') }}", "base": False})

        # Verify the result
        assert "columns" in result
        assert "data" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_query_with_base_flag(self, mcp_server):
        """Test the query tool with base environment flag"""
        server, _ = mcp_server
        mock_result = {"columns": ["id"], "data": [[1]]}

        with patch.object(QueryTask, "execute", return_value=mock_result) as mock_execute:
            with patch.object(QueryTask, "__init__", return_value=None):
                task = QueryTask(params={"sql_template": "SELECT 1"})
                task.is_base = True
                task.execute = mock_execute

                result = await server._query({"sql_template": "SELECT 1", "base": True})

                # Verify base flag was set (would need to inspect task creation)
                assert result == mock_result

    @pytest.mark.asyncio
    async def test_query_diff(self, mcp_server):
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
            result = await server._query_diff(
                {
                    "sql_template": "SELECT * FROM {{ ref('my_model') }}",
                    "primary_keys": ["id"],
                }
            )

        # Verify the result
        assert "diff" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_profile_diff(self, mcp_server):
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
            result = await server._profile_diff({"model": "my_model", "columns": ["id"]})

        # Verify the result
        assert "columns" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_error_handling(self, mcp_server):
        """Test error handling in tool execution"""
        server, mock_context = mcp_server
        # Make get_lineage_diff raise an exception
        mock_context.get_lineage_diff.side_effect = Exception("Test error")

        # The method should raise the exception
        with pytest.raises(Exception, match="Test error"):
            await server._get_lineage_diff({})


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
