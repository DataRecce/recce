"""Tests for recce.mcp_transport — transport adapters for the MCP server."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

pytest.importorskip("mcp")


@pytest.mark.asyncio
async def test_run_mcp_stdio_calls_server_run_with_stdio_streams():
    """run_mcp_stdio wires stdio_server() streams into mcp.Server.run()."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={"opt": True})
    mock_rmcp.state_loader = None
    mock_rmcp.context = None

    fake_read = MagicMock()
    fake_write = MagicMock()

    class FakeStdioCM:
        async def __aenter__(self):
            return (fake_read, fake_write)

        async def __aexit__(self, *args):
            return False

    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)

    mock_rmcp.server.run.assert_awaited_once_with(fake_read, fake_write, {"opt": True})


@pytest.mark.asyncio
async def test_run_mcp_stdio_exports_state_on_shutdown():
    """When state_loader and context are present, state is exported in finally."""
    from recce.mcp_transport import run_mcp_stdio

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.server.run = AsyncMock()
    mock_rmcp.server.create_initialization_options = MagicMock(return_value={})
    mock_state_loader = MagicMock()
    mock_state_loader.export.return_value = None
    mock_state_loader.state_file = None
    mock_context = MagicMock()
    mock_context.export_state.return_value = {"state": "data"}
    mock_rmcp.state_loader = mock_state_loader
    mock_rmcp.context = mock_context

    class FakeStdioCM:
        async def __aenter__(self):
            return (MagicMock(), MagicMock())

        async def __aexit__(self, *args):
            return False

    with patch("recce.mcp_transport.stdio_server", return_value=FakeStdioCM()):
        await run_mcp_stdio(mock_rmcp)

    mock_state_loader.export.assert_called_once_with({"state": "data"})
