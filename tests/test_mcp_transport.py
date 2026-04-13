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


def test_run_mcp_sse_legacy_starlette_routes_present():
    """The legacy SSE app exposes /sse, /messages/*, and /health."""
    from recce.mcp_transport import _build_legacy_sse_app

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.context = None
    mock_rmcp.state_loader = None
    mock_rmcp.mcp_logger = MagicMock()
    mock_rmcp.mcp_logger.debug = False

    app = _build_legacy_sse_app(mock_rmcp)

    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/sse" in paths
    assert "/health" in paths
    # Starlette normalizes Mount("/messages/", ...) to .path == "/messages"
    mount_paths = {getattr(r, "path", None) for r in app.routes if getattr(r, "name", None) is None}
    assert "/messages" in mount_paths


def test_attach_mcp_to_fastapi_mounts_prefix_and_returns_session_manager():
    """attach_mcp_to_fastapi mounts /mcp and returns the session manager."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.context = None
    mock_rmcp.state_loader = None
    mock_rmcp.mcp_logger = MagicMock()
    mock_rmcp.mcp_logger.debug = False

    app = FastAPI()
    session_manager = attach_mcp_to_fastapi(app, mock_rmcp, prefix="/mcp")

    # The session manager comes back so the caller can drive its lifecycle.
    assert session_manager is not None
    assert hasattr(session_manager, "run")  # async context manager method

    # /mcp Mount is wired
    paths = {getattr(r, "path", None) for r in app.routes}
    assert "/mcp" in paths


def test_attach_mcp_to_fastapi_inner_routes_present():
    """Inside the /mcp mount, the streamable, sse, and messages routes exist."""
    from fastapi import FastAPI

    from recce.mcp_transport import attach_mcp_to_fastapi

    mock_rmcp = MagicMock()
    mock_rmcp.server = MagicMock()
    mock_rmcp.context = None
    mock_rmcp.state_loader = None
    mock_rmcp.mcp_logger = MagicMock()
    mock_rmcp.mcp_logger.debug = False

    app = FastAPI()
    attach_mcp_to_fastapi(app, mock_rmcp, prefix="/mcp")

    # Find the /mcp Mount and inspect inner routes
    mcp_mount = next(r for r in app.routes if getattr(r, "path", None) == "/mcp")
    inner_paths = [getattr(r, "path", None) for r in mcp_mount.app.routes]
    # All three transports must be present:
    #   /sse       — legacy SSE stream (Route)
    #   /messages  — legacy SSE message channel (Mount; Starlette strips the trailing slash)
    #   ""         — Streamable HTTP catch-all (Mount("/") normalizes to "")
    assert "/sse" in inner_paths
    assert "/messages" in inner_paths
    assert "" in inner_paths, "Streamable HTTP catch-all Mount('/') is missing"
    # Order matters for first-match routing: specific paths BEFORE the catch-all.
    assert inner_paths.index("/sse") < inner_paths.index("")
    assert inner_paths.index("/messages") < inner_paths.index("")
