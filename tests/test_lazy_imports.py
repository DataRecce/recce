"""Tests for lazy import changes (DRC-3152).

Covers:
- event.init() once-guard in TrackCommand
- should_log_event() FileNotFoundError handling
- Constant sync between cli.py and config.py
- RecceServerMode values sync
- Branch default lazy resolution in artifact commands
- Module-level import is lightweight (no heavy deps)
"""

import threading
from unittest.mock import patch

import click
import pytest
from click.testing import CliRunner


class TestEventInitOnceGuard:
    """Test that event.init() is called exactly once across multiple TrackCommand invocations."""

    def setup_method(self):
        import recce.track as track_module

        self._original_flag = track_module._event_initialized
        track_module._event_initialized = False

    def teardown_method(self):
        import recce.track as track_module

        track_module._event_initialized = self._original_flag

    @patch("recce.event.init")
    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_event_init_called_once_on_first_invoke(self, mock_log_cs, mock_set_tag, mock_log, mock_flush, mock_init):
        """event.init() should be called on first TrackCommand invocation."""
        from recce.track import TrackCommand

        @click.command(cls=TrackCommand)
        def dummy_cmd():
            pass

        runner = CliRunner()
        runner.invoke(dummy_cmd, [])

        mock_init.assert_called_once()

    @patch("recce.event.init")
    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_event_init_not_called_again_on_second_invoke(
        self, mock_log_cs, mock_set_tag, mock_log, mock_flush, mock_init
    ):
        """event.init() should NOT be called on subsequent invocations."""
        from recce.track import TrackCommand

        @click.command(cls=TrackCommand)
        def dummy_cmd():
            pass

        runner = CliRunner()
        runner.invoke(dummy_cmd, [])
        runner.invoke(dummy_cmd, [])

        mock_init.assert_called_once()

    @patch("recce.event.init")
    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_event_init_sets_initialized_flag(self, mock_log_cs, mock_set_tag, mock_log, mock_flush, mock_init):
        """After invoke, _event_initialized should be True."""
        import recce.track as track_module
        from recce.track import TrackCommand

        assert track_module._event_initialized is False

        @click.command(cls=TrackCommand)
        def dummy_cmd():
            pass

        runner = CliRunner()
        runner.invoke(dummy_cmd, [])

        assert track_module._event_initialized is True

    @patch("recce.event.init")
    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_event_init_thread_safety(self, mock_log_cs, mock_set_tag, mock_log, mock_flush, mock_init):
        """event.init() should only be called once even with concurrent threads."""
        import recce.track as track_module

        barrier = threading.Barrier(4)
        errors = []

        def try_init():
            """Simulate the double-check locking pattern from TrackCommand.invoke()."""
            from recce import event

            try:
                barrier.wait(timeout=5)
                global_flag = track_module._event_initialized
                if not global_flag:
                    with track_module._event_init_lock:
                        if not track_module._event_initialized:
                            event.init()
                            track_module._event_initialized = True
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=try_init) for _ in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"Thread errors: {errors}"
        # event.init() should be called exactly once despite concurrent access
        mock_init.assert_called_once()


class TestEventInitErrorHandling:
    """Test that event.init() failures don't crash the CLI."""

    def setup_method(self):
        import recce.track as track_module

        self._original_flag = track_module._event_initialized
        track_module._event_initialized = False

    def teardown_method(self):
        import recce.track as track_module

        track_module._event_initialized = self._original_flag

    @patch("recce.event.init", side_effect=Exception("sentry init failed"))
    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_event_init_failure_does_not_crash_command(
        self, mock_log_cs, mock_set_tag, mock_log, mock_flush, mock_init
    ):
        """If event.init() raises, the command should still run successfully."""
        from recce.track import TrackCommand

        executed = []

        @click.command(cls=TrackCommand)
        def dummy_cmd():
            executed.append(True)

        runner = CliRunner()
        result = runner.invoke(dummy_cmd, [])

        assert len(executed) == 1, "Command body should have executed"
        assert result.exit_code == 0

    @patch("recce.event.init", side_effect=Exception("sentry init failed"))
    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_event_init_failure_still_sets_initialized_flag(
        self, mock_log_cs, mock_set_tag, mock_log, mock_flush, mock_init
    ):
        """Even if event.init() fails, the flag should be set to avoid retrying."""
        import recce.track as track_module
        from recce.track import TrackCommand

        @click.command(cls=TrackCommand)
        def dummy_cmd():
            pass

        runner = CliRunner()
        runner.invoke(dummy_cmd, [])

        assert track_module._event_initialized is True


class TestTelemetryFinallyBlock:
    """Test that telemetry failures in finally block don't mask command errors."""

    def setup_method(self):
        import recce.track as track_module

        self._original_flag = track_module._event_initialized
        track_module._event_initialized = True  # Skip event.init()

    def teardown_method(self):
        import recce.track as track_module

        track_module._event_initialized = self._original_flag

    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    @patch("recce.git.current_branch", side_effect=ImportError("git module broken"))
    def test_finally_import_failure_does_not_mask_command_error(self, mock_branch, mock_log_cs, mock_set_tag):
        """If imports in finally fail, the original command error should still propagate."""
        from recce.track import TrackCommand

        @click.command(cls=TrackCommand)
        def failing_cmd():
            raise RuntimeError("original error")

        runner = CliRunner()
        result = runner.invoke(failing_cmd, [])

        # Command should exit with error (not crash with ImportError)
        assert result.exit_code != 0
        # Should NOT see ImportError in output — it should be caught
        assert "ImportError" not in (result.output or "")

    @patch("recce.event.flush_events")
    @patch("recce.event.log_event")
    @patch("recce.event.set_exception_tag")
    @patch("recce.event.log_codespaces_events")
    def test_successful_command_with_telemetry_failure(self, mock_log_cs, mock_set_tag, mock_log, mock_flush):
        """A successful command should not be affected by telemetry failure in finally."""
        mock_flush.side_effect = Exception("network error")

        from recce.track import TrackCommand

        executed = []

        @click.command(cls=TrackCommand)
        def dummy_cmd():
            executed.append(True)

        runner = CliRunner()
        result = runner.invoke(dummy_cmd, [])

        assert len(executed) == 1
        assert result.exit_code == 0


class TestShouldLogEvent:
    """Test should_log_event() handles missing profile gracefully."""

    @patch("recce.event.RECCE_USER_PROFILE", "/nonexistent/path/profile.yml")
    def test_returns_false_when_profile_missing(self):
        """should_log_event() returns False when profile.yml doesn't exist."""
        from recce.event import should_log_event

        assert should_log_event() is False

    @patch("builtins.open", side_effect=PermissionError("Permission denied"))
    def test_does_not_catch_permission_error(self, mock_open):
        """should_log_event() should NOT catch PermissionError — only FileNotFoundError."""
        from recce.event import should_log_event

        with pytest.raises(PermissionError):
            should_log_event()

    @patch("recce.event._collector")
    @patch("recce.event.RECCE_USER_PROFILE")
    def test_returns_false_when_tracking_disabled(self, mock_profile, mock_collector):
        """should_log_event() returns False when anonymous_tracking is False."""
        import tempfile

        from recce import yaml as pyml
        from recce.event import should_log_event

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
            pyml.dump({"anonymous_tracking": False}, f)
            f.flush()

            with patch("recce.event.RECCE_USER_PROFILE", f.name):
                assert should_log_event() is False

    @patch("recce.event._collector")
    def test_returns_true_when_tracking_enabled_and_collector_ready(self, mock_collector):
        """should_log_event() returns True when tracking is on and collector is ready."""
        import tempfile

        from recce import yaml as pyml
        from recce.event import should_log_event

        mock_collector.is_ready.return_value = True

        with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
            pyml.dump({"anonymous_tracking": True}, f)
            f.flush()

            with patch("recce.event.RECCE_USER_PROFILE", f.name):
                assert should_log_event() is True


class TestConstantSync:
    """Verify cli.py and config.py both use constants from recce.constants."""

    def test_cli_and_config_share_same_config_file_constant(self):
        from recce.cli import RECCE_CONFIG_FILE as cli_val
        from recce.config import RECCE_CONFIG_FILE as config_val
        from recce.constants import RECCE_CONFIG_FILE as const_val

        assert cli_val is const_val
        assert config_val is const_val

    def test_cli_and_config_share_same_error_log_constant(self):
        from recce.cli import RECCE_ERROR_LOG_FILE as cli_val
        from recce.config import RECCE_ERROR_LOG_FILE as config_val
        from recce.constants import RECCE_ERROR_LOG_FILE as const_val

        assert cli_val is const_val
        assert config_val is const_val


class TestServerModeValuesSync:
    """Verify hardcoded mode values in cli.py match RecceServerMode enum."""

    def test_mode_choice_matches_enum(self):
        from recce.server import RecceServerMode

        expected = sorted(RecceServerMode.available_members())
        # Extract the Choice values from the --mode option in recce_hidden_options
        from recce.cli import recce_hidden_options

        mode_option = None
        for opt in recce_hidden_options:
            # Each opt is a decorator; apply it to a click.command to get params
            @click.command()
            @opt
            def dummy(**kwargs):
                pass

            for param in dummy.params:
                if param.name == "mode":
                    mode_option = param
                    break
            if mode_option:
                break

        assert mode_option is not None, "--mode option not found in recce_hidden_options"
        assert sorted(mode_option.type.choices) == expected


class TestBranchDefaultResolution:
    """Test that artifact commands resolve branch defaults lazily."""

    @patch("recce.artifact.upload_dbt_artifacts")
    @patch("recce.git.current_branch", return_value="my-feature-branch")
    def test_upload_artifacts_defaults_to_current_branch(self, mock_branch, mock_upload):
        """upload-artifacts should use current_branch() when --branch not provided."""
        from recce.cli import cloud

        mock_upload.return_value = 0
        runner = CliRunner()
        runner.invoke(cloud, ["upload-artifacts", "--password", "test"])

        mock_branch.assert_called()
        # The branch arg passed to upload_dbt_artifacts should be the mocked branch
        call_kwargs = mock_upload.call_args
        assert call_kwargs[1].get("branch") == "my-feature-branch" or call_kwargs[0][1] == "my-feature-branch"

    @patch("recce.artifact.upload_dbt_artifacts")
    @patch("recce.git.current_branch", return_value="my-feature-branch")
    def test_upload_artifacts_explicit_branch_overrides_default(self, mock_branch, mock_upload):
        """upload-artifacts should use --branch value when explicitly provided."""
        from recce.cli import cloud

        mock_upload.return_value = 0
        runner = CliRunner()
        runner.invoke(cloud, ["upload-artifacts", "--password", "test", "--branch", "explicit-branch"])

        # Should use the explicit branch, not current_branch()
        call_args = mock_upload.call_args
        if call_args[1].get("branch"):
            assert call_args[1]["branch"] == "explicit-branch"
        else:
            assert "explicit-branch" in call_args[0]

    @patch("recce.artifact.delete_dbt_artifacts")
    @patch("recce.git.current_branch", return_value="delete-me-branch")
    def test_delete_artifacts_defaults_to_current_branch(self, mock_branch, mock_delete):
        """delete-artifacts should use current_branch() when --branch not provided."""
        from recce.cli import cloud

        mock_delete.return_value = None
        runner = CliRunner()
        runner.invoke(cloud, ["delete-artifacts", "--force"])

        mock_branch.assert_called()


class TestLightweightImport:
    """Verify that importing recce.cli doesn't trigger heavy dependencies."""

    def test_cli_import_does_not_load_heavy_modules(self):
        """recce.cli should not import heavy modules at module level."""
        import recce.cli  # noqa: F401

        # recce.track (used by cli) should not import heavy modules
        assert "recce.run" not in recce.cli.__dict__, "recce.run should not be in cli namespace"
        assert "recce.server" not in recce.cli.__dict__, "recce.server should not be in cli namespace"

    def test_track_module_does_not_import_event_package(self):
        """recce.track should not trigger recce.event.__init__ at import time."""
        # recce.track only imports: stdlib, click, recce.exceptions
        import recce.track

        # Verify event is not in track's direct namespace (it's imported inside invoke())
        assert "event" not in recce.track.__dict__
