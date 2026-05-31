"""Opt-out parity, flush, and person-profile tests for the dual-write path.

TESTS-FIRST (red): wrappers do not yet fan out to PostHog and
recce.event.posthog_telemetry does not exist.

- OPT-OUT parity (D5): with anonymous_tracking off, NEITHER Amplitude NOR PostHog
  fire through any wrapper. With it on (default), both fire. The two
  non-log_event-gated paths (log_codespaces_events, log_performance) add their own
  should_log_event() guard and are covered explicitly.
- FLUSH: flush_events() calls posthog_telemetry.shutdown() in addition to
  _collector.send_events().
- PERSON PROFILE (D6): captured events carry $process_person_profile=False and
  distinct_id == _get_distinct_id() (no PostHog person rows).
"""

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from recce import yaml as pyml


def _profile(anonymous_tracking):
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False)
    pyml.dump({"user_id": "uid-test", "anonymous_tracking": anonymous_tracking}, f)
    f.flush()
    f.close()
    return f.name


@pytest.fixture
def collector():
    with patch("recce.event._collector") as mock_collector:
        mock_collector.is_ready.return_value = True
        yield mock_collector


@pytest.fixture
def ph_track():
    with patch("recce.event.posthog_telemetry.track") as mock_track:
        yield mock_track


class TestOptOutParity:
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_opted_out_suppresses_both_paths(self, mock_runner, mock_repo, mock_branch, collector, ph_track):
        path = _profile(anonymous_tracking=False)
        try:
            with patch("recce.event.RECCE_USER_PROFILE", path):
                from recce.event import log_event

                log_event({"command": "run"}, "command")

            # Opt-out gate suppresses Amplitude AND PostHog identically.
            collector.log_event.assert_not_called()
            ph_track.assert_not_called()
        finally:
            os.unlink(path)

    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_opted_in_fires_both_paths(self, mock_runner, mock_repo, mock_branch, collector, ph_track):
        path = _profile(anonymous_tracking=True)
        try:
            with patch("recce.event.RECCE_USER_PROFILE", path):
                from recce.event import log_event

                log_event({"command": "run"}, "command")

            collector.log_event.assert_called_once()
            ph_track.assert_called_once()
        finally:
            os.unlink(path)

    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_performance_path_respects_optout(self, mock_runner, mock_repo, mock_branch, collector, ph_track):
        # log_performance routes through log_event, but the PostHog call adds its own
        # should_log_event() guard -- when opted out, nothing emits to PostHog.
        path = _profile(anonymous_tracking=False)
        try:
            with patch("recce.event.RECCE_USER_PROFILE", path):
                from recce.event import log_performance

                log_performance("server_startup", {"duration_ms": 1})

            ph_track.assert_not_called()
        finally:
            os.unlink(path)

    @patch("recce.event.get_github_codespace_available_at", return_value=None)
    @patch("recce.event.get_github_codespace_name", return_value="cs")
    @patch("recce.event.get_github_codespace_info")
    def test_codespaces_path_respects_optout(self, mock_info, mock_name, mock_avail, collector, ph_track):
        # log_codespaces_events calls _collector.log_event directly (bypasses the
        # log_event gate), so it must add its own should_log_event() guard for PostHog.
        mock_info.return_value = {
            "location": "EastUs",
            "prebuild": False,
            "machine": {"display_name": "2-core"},
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        path = _profile(anonymous_tracking=False)
        try:
            with patch("recce.event.RECCE_USER_PROFILE", path):
                from recce.event import log_codespaces_events

                log_codespaces_events("server")

            ph_track.assert_not_called()
        finally:
            os.unlink(path)


class TestFlush:
    def test_flush_events_calls_posthog_shutdown(self, collector):
        with patch("recce.event.posthog_telemetry.shutdown") as mock_shutdown:
            from recce.event import flush_events

            flush_events()

            # Amplitude flush unchanged + PostHog shutdown invoked.
            collector.send_events.assert_called_once()
            mock_shutdown.assert_called_once()


class TestPersonProfileIdentity:
    @patch("recce.event.posthog_telemetry.get_common_properties", return_value={})
    @patch("recce.event.posthog_telemetry._get_distinct_id", return_value="uid-identity")
    @patch("recce.event.posthog_telemetry._get_client")
    def test_capture_carries_anonymous_identity(self, mock_get_client, mock_id, mock_props):
        import recce.event.posthog_telemetry as ph

        ph._client = None
        ph._initialized = False
        client = MagicMock()
        mock_get_client.return_value = client

        ph.track("command", {"status": True})

        kwargs = client.capture.call_args.kwargs
        assert kwargs["distinct_id"] == "uid-identity"
        assert kwargs["properties"]["$process_person_profile"] is False
