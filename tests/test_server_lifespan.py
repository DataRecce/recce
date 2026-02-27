"""Tests for the FastAPI lifespan context manager in recce/server.py"""

from unittest.mock import MagicMock, patch

import pytest

from recce.core import RecceContext
from recce.server import AppState, _do_lifespan_setup, app, lifespan


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


class TestDoLifespanSetup:
    """Tests for _do_lifespan_setup onboarding state update logic."""

    @patch("recce.server.setup_server")
    @patch("recce.util.onboarding_state.update_onboarding_state")
    def test_onboarding_state_called_with_api_token(self, mock_update, mock_setup):
        """When api_token is present, update_onboarding_state should be called."""
        app_state = AppState()
        app_state.command = "server"
        app_state.auth_options = {"api_token": "test_token"}
        app_state.flag = {"single_env_onboarding": True}
        app_state.kwargs = {}

        _do_lifespan_setup(app_state)

        mock_update.assert_called_once_with("test_token", True)
        mock_setup.assert_called_once_with(app_state)

    @patch("recce.server.setup_server")
    @patch("recce.util.onboarding_state.update_onboarding_state")
    def test_onboarding_state_not_called_without_api_token(self, mock_update, mock_setup):
        """When api_token is None, update_onboarding_state should not be called."""
        app_state = AppState()
        app_state.command = "server"
        app_state.auth_options = {"api_token": None}
        app_state.flag = {}
        app_state.kwargs = {}

        _do_lifespan_setup(app_state)

        mock_update.assert_not_called()
        mock_setup.assert_called_once()

    @patch("recce.server.setup_server")
    @patch("recce.util.onboarding_state.update_onboarding_state")
    def test_onboarding_state_not_called_without_auth_options(self, mock_update, mock_setup):
        """When auth_options is None, update_onboarding_state should not be called."""
        app_state = AppState()
        app_state.command = "server"
        app_state.auth_options = None
        app_state.flag = None
        app_state.kwargs = {}

        _do_lifespan_setup(app_state)

        mock_update.assert_not_called()
        mock_setup.assert_called_once()

    @patch("recce.server.setup_server")
    @patch("recce.util.onboarding_state.update_onboarding_state", side_effect=Exception("API error"))
    def test_onboarding_state_failure_is_nonfatal(self, mock_update, mock_setup):
        """update_onboarding_state failure should be swallowed and not block setup."""
        app_state = AppState()
        app_state.command = "server"
        app_state.auth_options = {"api_token": "test_token"}
        app_state.flag = {}
        app_state.kwargs = {}

        # Should not raise
        _do_lifespan_setup(app_state)

        mock_update.assert_called_once()
        # setup_server should still be called despite onboarding failure
        mock_setup.assert_called_once_with(app_state)

    @patch("recce.core.set_default_context")
    @patch.object(RecceContext, "load")
    def test_setup_ready_only_calls_load_and_set_context(self, mock_load, mock_set_ctx):
        """setup_ready_only should call RecceContext.load() and set_default_context()."""
        from recce.server import setup_ready_only

        mock_ctx = MagicMock()
        mock_load.return_value = mock_ctx

        app_state = AppState()
        app_state.kwargs = {"target_path": "/some/path"}
        app_state.state_loader = MagicMock()

        result = setup_ready_only(app_state)

        mock_load.assert_called_once_with(target_path="/some/path", state_loader=app_state.state_loader)
        mock_set_ctx.assert_called_once_with(mock_ctx)
        assert result is mock_ctx

    @patch("recce.server.setup_ready_only")
    def test_do_lifespan_setup_read_only_mode(self, mock_setup_ro):
        """_do_lifespan_setup should call setup_ready_only for read-only command."""
        mock_ctx = MagicMock()
        mock_setup_ro.return_value = mock_ctx

        app_state = AppState()
        app_state.command = "read-only"
        app_state.auth_options = None
        app_state.flag = None
        app_state.kwargs = {}

        result = _do_lifespan_setup(app_state)

        mock_setup_ro.assert_called_once_with(app_state)
        assert result is mock_ctx
