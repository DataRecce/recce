from unittest import TestCase
from unittest.mock import MagicMock, patch

import pytest

from recce.core import RecceContext
from recce.mcp_server import RecceMCPServer, run_mcp_server
from recce.models.types import LineageDiff
from recce.tasks.profile import ProfileDiffTask
from recce.tasks.query import QueryDiffTask, QueryTask
from recce.tasks.rowcount import RowCountDiffTask


class TestRecceMCPServer(TestCase):
    """Test cases for the RecceMCPServer class"""

    def setUp(self):
        """Set up test fixtures"""
        # Create a mock RecceContext
        self.mock_context = MagicMock(spec=RecceContext)
        self.mcp_server = RecceMCPServer(self.mock_context)

    def test_server_initialization(self):
        """Test that the MCP server initializes correctly"""
        assert self.mcp_server.context == self.mock_context
        assert self.mcp_server.server is not None
        assert self.mcp_server.server.name == "recce"

    @pytest.mark.asyncio
    async def test_get_lineage_diff(self):
        """Test the get_lineage_diff tool"""
        # Mock the lineage diff response
        mock_lineage_diff = MagicMock(spec=LineageDiff)
        mock_lineage_diff.model_dump.return_value = {
            "added": ["model.project.new_model"],
            "removed": ["model.project.old_model"],
            "modified": ["model.project.changed_model"],
        }
        self.mock_context.get_lineage_diff.return_value = mock_lineage_diff

        # Execute the method
        result = await self.mcp_server._get_lineage_diff({})

        # Verify the result
        assert "added" in result
        assert "removed" in result
        assert "modified" in result
        self.mock_context.get_lineage_diff.assert_called_once()
        mock_lineage_diff.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_row_count_diff(self):
        """Test the row_count_diff tool"""
        # Mock the task execution
        mock_result = {"results": [{"node_id": "model.project.my_model", "base": 100, "current": 105, "diff": 5}]}

        with patch.object(RowCountDiffTask, "execute", return_value=mock_result):
            result = await self.mcp_server._row_count_diff({"node_names": ["my_model"]})

        # Verify the result
        assert result == mock_result
        assert "results" in result

    @pytest.mark.asyncio
    async def test_query(self):
        """Test the query tool"""
        # Mock the task execution
        mock_result = MagicMock()
        mock_result.model_dump.return_value = {
            "columns": ["id", "name"],
            "data": [[1, "Alice"], [2, "Bob"]],
        }

        with patch.object(QueryTask, "execute", return_value=mock_result):
            result = await self.mcp_server._query(
                {"sql_template": "SELECT * FROM {{ ref('my_model') }}", "base": False}
            )

        # Verify the result
        assert "columns" in result
        assert "data" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_query_with_base_flag(self):
        """Test the query tool with base environment flag"""
        mock_result = {"columns": ["id"], "data": [[1]]}

        with patch.object(QueryTask, "execute", return_value=mock_result) as mock_execute:
            with patch.object(QueryTask, "__init__", return_value=None):
                task = QueryTask(params={"sql_template": "SELECT 1"})
                task.is_base = True
                task.execute = mock_execute

                result = await self.mcp_server._query({"sql_template": "SELECT 1", "base": True})

                # Verify base flag was set (would need to inspect task creation)
                assert result == mock_result

    @pytest.mark.asyncio
    async def test_query_diff(self):
        """Test the query_diff tool"""
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
            result = await self.mcp_server._query_diff(
                {
                    "sql_template": "SELECT * FROM {{ ref('my_model') }}",
                    "primary_keys": ["id"],
                }
            )

        # Verify the result
        assert "diff" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_profile_diff(self):
        """Test the profile_diff tool"""
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
            result = await self.mcp_server._profile_diff({"model": "my_model", "columns": ["id"]})

        # Verify the result
        assert "columns" in result
        mock_result.model_dump.assert_called_once_with(mode="json")

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Test error handling in tool execution"""
        # Make get_lineage_diff raise an exception
        self.mock_context.get_lineage_diff.side_effect = Exception("Test error")

        # The method should raise the exception
        with pytest.raises(Exception, match="Test error"):
            await self.mcp_server._get_lineage_diff({})


class TestRunMCPServer(TestCase):
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
