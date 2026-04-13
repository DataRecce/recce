"""Tests for the MCP server lifecycle merge into recce server.

Covers scenarios from the design's Test Coverage Strategy table:
1. MCP routes mounted when mcp installed and mcp_enabled=True
2. MCP routes NOT mounted when mcp_enabled=False
3. MCP routes NOT mounted when mcp package not installed (mock ImportError)
4. /mcp/sse endpoint gated by readiness
5. /mcp/messages endpoint accepts POST
6. MCP init failure logged as warning, does not set startup_error
"""

import asyncio
import sys
from unittest.mock import MagicMock, patch

import pytest

from recce.server import AppState, app, lifespan


@pytest.fixture
def mock_app_state():
    """Create a minimal AppState for testing MCP lifecycle."""
    state = AppState()
    state.command = "server"
    state.state_loader = MagicMock()
    state.kwargs = {"debug": False}
    state.flag = {}
    state.lifetime = None
    state.idle_timeout = None
    state.mcp_enabled = True
    return state


@pytest.fixture
def setup_app_state(mock_app_state):
    """Inject mock AppState into the FastAPI app for lifespan tests."""
    original_state = getattr(app, "state", None)
    app.state = mock_app_state
    yield mock_app_state
    # Restore original state and remove any MCP routes we may have added
    app.state = original_state
    app.routes[:] = [r for r in app.routes if not _is_mcp_route(r)]


def _is_mcp_route(route):
    """Check if a route is an MCP route we added during testing."""
    path = getattr(route, "path", "")
    return path.startswith("/mcp/")


class TestMCPRouteMounting:
    """Test that MCP routes are correctly mounted/not-mounted during lifespan."""

    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    async def test_mcp_routes_mounted_when_enabled(
        self,
        mock_teardown,
        mock_setup,
        setup_app_state,
    ):
        """Scenario 1: MCP routes are mounted when mcp is installed and mcp_enabled=True."""
        mock_ctx = MagicMock()
        mock_setup.return_value = mock_ctx

        setup_app_state.mcp_enabled = True

        async with lifespan(app):
            await setup_app_state.ready_event.wait()

        # Verify MCP server was created and stored
        assert setup_app_state.mcp_server is not None
        assert setup_app_state.mcp_sse_transport is not None

        # Verify routes were added
        route_paths = [getattr(r, "path", "") for r in app.routes]
        assert "/mcp/sse" in route_paths
        assert "/mcp/messages" in route_paths

    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    async def test_mcp_routes_not_mounted_when_disabled(
        self,
        mock_teardown,
        mock_setup,
        setup_app_state,
    ):
        """Scenario 2: MCP routes are NOT mounted when mcp_enabled=False."""
        mock_ctx = MagicMock()
        mock_setup.return_value = mock_ctx

        setup_app_state.mcp_enabled = False

        async with lifespan(app):
            await setup_app_state.ready_event.wait()

        # Verify no MCP server was created
        assert setup_app_state.mcp_server is None
        assert setup_app_state.mcp_sse_transport is None

        # Verify no MCP routes were added
        route_paths = [getattr(r, "path", "") for r in app.routes]
        assert "/mcp/sse" not in route_paths
        assert "/mcp/messages" not in route_paths

    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    async def test_mcp_routes_not_mounted_when_import_fails(
        self,
        mock_teardown,
        mock_setup,
        setup_app_state,
    ):
        """Scenario 3: MCP routes are NOT mounted when mcp package is not installed."""
        mock_ctx = MagicMock()
        mock_setup.return_value = mock_ctx

        setup_app_state.mcp_enabled = True

        # Mock the import to fail
        with patch.dict(
            sys.modules,
            {"recce.mcp_server": None},
        ):
            # Force ImportError by patching the import inside background_load
            original_import = __builtins__.__import__ if hasattr(__builtins__, "__import__") else __import__

            def mock_import(name, *args, **kwargs):
                if name == "recce.mcp_server":
                    raise ImportError("No module named 'mcp'")
                return original_import(name, *args, **kwargs)

            with patch("builtins.__import__", side_effect=mock_import):
                async with lifespan(app):
                    await setup_app_state.ready_event.wait()

        # MCP should not be set up
        assert setup_app_state.mcp_server is None
        # Crucially, startup_error should NOT be set (HTTP server continues)
        assert setup_app_state.startup_error is None

    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    async def test_mcp_init_failure_does_not_set_startup_error(
        self,
        mock_teardown,
        mock_setup,
        setup_app_state,
    ):
        """Scenario 6: MCP init errors are logged as warnings, not fatal."""
        mock_ctx = MagicMock()
        mock_setup.return_value = mock_ctx

        setup_app_state.mcp_enabled = True

        # Make RecceMCPServer.__init__ raise a non-ImportError exception
        with patch(
            "recce.mcp_server.RecceMCPServer.__init__",
            side_effect=RuntimeError("MCP init failed"),
        ):
            async with lifespan(app):
                await setup_app_state.ready_event.wait()

        # startup_error must NOT be set -- only context loading failures are fatal
        assert setup_app_state.startup_error is None
        # MCP server should not be stored
        assert setup_app_state.mcp_server is None


class TestMCPReadinessGate:
    """Test that MCP routes are gated by the readiness middleware."""

    @pytest.mark.asyncio
    async def test_mcp_sse_gated_by_readiness(self):
        """Scenario 4: /mcp/sse is gated by the readiness middleware."""
        from httpx import ASGITransport, AsyncClient

        state = AppState()
        state.command = "server"
        state.state_loader = MagicMock()
        state.kwargs = {"debug": False}
        state.flag = {}
        state.lifetime = None
        state.idle_timeout = None
        state.mcp_enabled = False  # Don't actually mount MCP
        state.ready_event = asyncio.Event()
        state.startup_error = None
        state.startup_ctx = None

        original_state = getattr(app, "state", None)
        app.state = state

        try:
            # readiness_gate middleware should block /mcp/ paths until ready
            # We set a very short timeout via env var to avoid hanging
            import os

            old_timeout = os.environ.get("RECCE_STARTUP_TIMEOUT")
            os.environ["RECCE_STARTUP_TIMEOUT"] = "0.1"

            try:
                transport = ASGITransport(app=app, raise_app_exceptions=False)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    # Should timeout waiting for readiness since ready_event is never set
                    response = await client.get("/mcp/sse")
                    assert response.status_code == 503
            finally:
                if old_timeout is None:
                    os.environ.pop("RECCE_STARTUP_TIMEOUT", None)
                else:
                    os.environ["RECCE_STARTUP_TIMEOUT"] = old_timeout
        finally:
            app.state = original_state

    @pytest.mark.asyncio
    async def test_mcp_messages_gated_by_readiness(self):
        """Scenario 5: /mcp/messages is gated by the readiness middleware."""
        from httpx import ASGITransport, AsyncClient

        state = AppState()
        state.command = "server"
        state.state_loader = MagicMock()
        state.kwargs = {"debug": False}
        state.flag = {}
        state.lifetime = None
        state.idle_timeout = None
        state.mcp_enabled = False
        state.ready_event = asyncio.Event()
        state.startup_error = None
        state.startup_ctx = None

        original_state = getattr(app, "state", None)
        app.state = state

        try:
            import os

            old_timeout = os.environ.get("RECCE_STARTUP_TIMEOUT")
            os.environ["RECCE_STARTUP_TIMEOUT"] = "0.1"

            try:
                transport = ASGITransport(app=app, raise_app_exceptions=False)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    response = await client.post("/mcp/messages", content="{}")
                    assert response.status_code == 503
            finally:
                if old_timeout is None:
                    os.environ.pop("RECCE_STARTUP_TIMEOUT", None)
                else:
                    os.environ["RECCE_STARTUP_TIMEOUT"] = old_timeout
        finally:
            app.state = original_state
