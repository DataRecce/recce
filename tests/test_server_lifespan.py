"""Tests for the FastAPI lifespan context manager in recce/server.py"""

from unittest.mock import MagicMock, patch

import pytest

from recce.server import AppState, app, lifespan


@pytest.fixture
def mock_app_state():
    """Create a mock AppState for testing."""
    state = AppState()
    state.command = "server"
    state.state_loader = MagicMock()
    state.kwargs = {"debug": False}
    state.flag = {}
    state.lifetime = None
    state.idle_timeout = None
    return state


@pytest.fixture
def setup_app_state(mock_app_state):
    """Set up app.state for lifespan tests."""
    original_state = getattr(app, "state", None)
    app.state = mock_app_state
    yield mock_app_state
    app.state = original_state


class TestLifespan:
    """Tests for lifespan setup and teardown."""

    @pytest.mark.parametrize(
        "command,setup_fn,teardown_fn",
        [
            ("server", "setup_server", "teardown_server"),
            ("preview", "setup_preview", "teardown_preview"),
            ("read-only", "setup_ready_only", "teardown_ready_only"),
        ],
    )
    @pytest.mark.asyncio
    async def test_setup_and_teardown_called_for_command(
        self,
        setup_app_state,
        command,
        setup_fn,
        teardown_fn,
    ):
        """Test that correct setup and teardown are called for each command."""
        setup_app_state.command = command

        with patch(f"recce.server.{setup_fn}") as mock_setup, patch(f"recce.server.{teardown_fn}") as mock_teardown:
            mock_ctx = MagicMock()
            mock_setup.return_value = mock_ctx

            async with lifespan(app):
                # Wait for background loading to complete before asserting
                await setup_app_state.ready_event.wait()
                mock_setup.assert_called_once_with(setup_app_state)

            mock_teardown.assert_called_once_with(setup_app_state, mock_ctx)

    @pytest.mark.parametrize(
        "lifetime,idle_timeout,expect_lifetime,expect_idle",
        [
            (3600, 300, True, True),  # both set
            (None, None, False, False),  # neither set
            (0, 0, False, False),  # zero = disabled
        ],
    )
    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    @patch("recce.server.schedule_lifetime_termination")
    @patch("recce.server.schedule_idle_timeout_check")
    async def test_timeout_scheduling(
        self,
        mock_idle_check,
        mock_lifetime,
        mock_teardown,
        mock_setup,
        setup_app_state,
        lifetime,
        idle_timeout,
        expect_lifetime,
        expect_idle,
    ):
        """Test lifetime and idle_timeout scheduling."""
        setup_app_state.command = "server"
        setup_app_state.lifetime = lifetime
        setup_app_state.idle_timeout = idle_timeout

        async with lifespan(app):
            pass

        assert mock_lifetime.called == expect_lifetime
        assert mock_idle_check.called == expect_idle

    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    async def test_debug_logging_enabled(
        self,
        mock_teardown,
        mock_setup,
        setup_app_state,
    ):
        """Test logger set to DEBUG when debug=True."""
        import logging

        setup_app_state.kwargs = {"debug": True}

        uvicorn_logger = logging.getLogger("uvicorn")
        original_level = uvicorn_logger.level

        try:
            async with lifespan(app):
                assert uvicorn_logger.level == logging.DEBUG
        finally:
            uvicorn_logger.setLevel(original_level)

    @pytest.mark.asyncio
    @patch("recce.server.setup_server")
    @patch("recce.server.teardown_server")
    async def test_kwargs_none_handled(
        self,
        mock_teardown,
        mock_setup,
        setup_app_state,
    ):
        """Test kwargs=None doesn't crash."""
        setup_app_state.kwargs = None

        async with lifespan(app):
            pass  # Should not raise
