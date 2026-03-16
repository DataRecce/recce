"""Tests for PostHog telemetry module."""

import hashlib
from unittest.mock import MagicMock, patch

from click.testing import CliRunner

from recce_cloud.telemetry import (
    TrackedCommand,
    anonymize,
    get_common_properties,
    get_distinct_id,
    track,
)


class TestAnonymize:
    def test_consistent_hash(self):
        assert anonymize("test") == anonymize("test")

    def test_different_inputs_different_hashes(self):
        assert anonymize("foo") != anonymize("bar")

    def test_returns_16_char_prefix(self):
        result = anonymize("anything")
        assert len(result) == 16

    def test_matches_sha256_prefix(self):
        expected = hashlib.sha256("hello".encode()).hexdigest()[:16]
        assert anonymize("hello") == expected


class TestGetDistinctId:
    @patch("recce_cloud.auth.profile.load_profile", return_value={"user_id": "abc123"})
    def test_returns_user_id(self, mock_profile):
        assert get_distinct_id() == "abc123"

    @patch("recce_cloud.auth.profile.load_profile", return_value={"user_id": None})
    def test_returns_unknown_when_no_user_id(self, mock_profile):
        assert get_distinct_id() == "unknown"

    @patch("recce_cloud.auth.profile.load_profile", side_effect=Exception("fail"))
    def test_returns_unknown_on_exception(self, mock_profile):
        assert get_distinct_id() == "unknown"


class TestGetCommonProperties:
    @patch("recce_cloud.ci_providers.CIDetector.detect", return_value=None)
    @patch("recce_cloud.__version__", "1.2.3")
    def test_includes_version_and_platform(self, mock_ci):
        props = get_common_properties()
        assert props["recce_cloud_version"] == "1.2.3"
        assert "python_version" in props
        assert "os_platform" in props
        assert props["is_ci"] is False

    @patch("recce_cloud.ci_providers.CIDetector.detect")
    @patch("recce_cloud.__version__", "1.2.3")
    def test_detects_ci_environment(self, mock_detect):
        ci_info = MagicMock()
        ci_info.platform = "github-actions"
        mock_detect.return_value = ci_info
        props = get_common_properties()
        assert props["is_ci"] is True
        assert props["ci_platform"] == "github-actions"


class TestTrack:
    @patch("recce_cloud.telemetry._get_client", return_value=None)
    def test_noop_when_no_client(self, mock_client):
        # Should not raise
        track("test_event", {"key": "value"})

    @patch("recce_cloud.telemetry.get_common_properties", return_value={"v": "1"})
    @patch("recce_cloud.telemetry.get_distinct_id", return_value="user123")
    @patch("recce_cloud.telemetry._get_client")
    def test_captures_event(self, mock_get_client, mock_id, mock_props):
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client

        track("test_event", {"extra": "data"})

        mock_client.capture.assert_called_once_with(
            distinct_id="user123",
            event="test_event",
            properties={"v": "1", "extra": "data"},
        )

    @patch("recce_cloud.telemetry.get_common_properties", return_value={})
    @patch("recce_cloud.telemetry.get_distinct_id", return_value="user123")
    @patch("recce_cloud.telemetry._get_client")
    def test_handles_capture_exception(self, mock_get_client, mock_id, mock_props):
        mock_client = MagicMock()
        mock_client.capture.side_effect = Exception("network error")
        mock_get_client.return_value = mock_client

        # Should not raise
        track("test_event")


class TestShouldTrack:
    @patch("recce_cloud.auth.profile.load_profile", return_value={"anonymous_tracking": False})
    def test_disabled_when_tracking_false(self, mock_profile):
        from recce_cloud.telemetry import _should_track
        assert _should_track() is False

    @patch("recce_cloud.auth.profile.load_profile", return_value={"anonymous_tracking": True})
    def test_enabled_when_tracking_true(self, mock_profile):
        from recce_cloud.telemetry import _should_track
        assert _should_track() is True

    @patch("recce_cloud.auth.profile.load_profile", return_value={})
    def test_disabled_when_field_missing(self, mock_profile):
        from recce_cloud.telemetry import _should_track
        assert _should_track() is False

    @patch("recce_cloud.auth.profile.load_profile", side_effect=Exception("no file"))
    def test_disabled_on_exception(self, mock_profile):
        from recce_cloud.telemetry import _should_track
        assert _should_track() is False


class TestGetClient:
    def test_noop_when_no_api_key(self):
        """Client should be None when no API key is configured."""
        import recce_cloud.telemetry as mod

        # Reset state
        mod._client = None
        mod._initialized = False

        with patch.object(mod, "_should_track", return_value=True), \
             patch.object(mod, "_get_api_key", return_value=None):
            client = mod._get_client()
            assert client is None

    def test_noop_when_tracking_disabled(self):
        """Client should be None when tracking is disabled."""
        import recce_cloud.telemetry as mod

        mod._client = None
        mod._initialized = False

        with patch.object(mod, "_should_track", return_value=False):
            client = mod._get_client()
            assert client is None


class TestTrackedCommand:
    def test_tracks_successful_command(self):
        import click

        @click.command(cls=TrackedCommand)
        def hello():
            click.echo("hello")

        with patch("recce_cloud.telemetry.track") as mock_track:
            runner = CliRunner()
            result = runner.invoke(hello)
            assert result.exit_code == 0

            # Should have cli_command_started and cli_command_completed
            calls = mock_track.call_args_list
            events = [c[0][0] for c in calls]
            assert "cli_command_started" in events
            assert "cli_command_completed" in events

            # Check completed event has success status
            completed_call = [c for c in calls if c[0][0] == "cli_command_completed"][0]
            assert completed_call[0][1]["status"] == "success"
            assert "duration_seconds" in completed_call[0][1]

    def test_tracks_failed_command_via_sys_exit(self):
        import click
        import sys

        @click.command(cls=TrackedCommand)
        def fail_cmd():
            sys.exit(1)

        with patch("recce_cloud.telemetry.track") as mock_track:
            runner = CliRunner()
            result = runner.invoke(fail_cmd)
            assert result.exit_code != 0

            calls = mock_track.call_args_list
            events = [c[0][0] for c in calls]
            assert "cli_command_started" in events
            assert "cli_command_completed" in events

            completed_call = [c for c in calls if c[0][0] == "cli_command_completed"][0]
            assert completed_call[0][1]["status"] == "error"

    def test_tracks_fatal_exception(self):
        import click

        @click.command(cls=TrackedCommand)
        def crash_cmd():
            raise RuntimeError("unexpected")

        with patch("recce_cloud.telemetry.track") as mock_track:
            runner = CliRunner()
            result = runner.invoke(crash_cmd)
            assert result.exit_code != 0

            calls = mock_track.call_args_list
            events = [c[0][0] for c in calls]
            assert "cli_command_started" in events
            assert "cli_command_completed" in events

            completed_call = [c for c in calls if c[0][0] == "cli_command_completed"][0]
            assert completed_call[0][1]["status"] == "fatal"
            assert completed_call[0][1]["error_type"] == "RuntimeError"
