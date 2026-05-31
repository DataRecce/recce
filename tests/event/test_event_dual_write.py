"""Dual-write parity tests for the OSS event wrappers (recce/event/__init__.py).

TESTS-FIRST (red): the PostHog fan-out is not wired into the wrappers yet, and
recce.event.posthog_telemetry does not exist. These assert that every emit wrapper
fans out to BOTH the existing Amplitude collector AND the new PostHog track(),
with the event-name mapping and flattened props from the P4 design's event_map.

Strategy (mirrors how tests/test_lazy_imports.py exercises the gate):
- write a tmp profile.yml with anonymous_tracking: True and point
  recce.event.RECCE_USER_PROFILE at it so should_log_event() passes
- mock recce.event._collector so is_ready() is True and log_event is observable
- patch recce.event.posthog_telemetry.track to observe the PostHog fan-out

The PostHog mirror is expected to be added AFTER the existing _collector calls,
reusing the SAME hashed repository/branch values already in payload.
"""

import os
import tempfile
from unittest.mock import patch

import pytest

from recce import yaml as pyml


@pytest.fixture
def opted_in_profile():
    """A profile.yml with anonymous_tracking on, wired into recce.event."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False) as f:
        pyml.dump({"user_id": "uid-test", "anonymous_tracking": True}, f)
        f.flush()
        path = f.name
    with patch("recce.event.RECCE_USER_PROFILE", path):
        yield path
    os.unlink(path)


@pytest.fixture
def collector():
    """Mock the Amplitude collector; is_ready() True so should_log_event() passes."""
    with patch("recce.event._collector") as mock_collector:
        mock_collector.is_ready.return_value = True
        yield mock_collector


@pytest.fixture
def ph_track():
    """Observe the PostHog fan-out call inside the wrappers."""
    with patch("recce.event.posthog_telemetry.track") as mock_track:
        yield mock_track


def _ph_calls(ph_track):
    """List of (event_name, props_dict) tuples PostHog was called with."""
    out = []
    for c in ph_track.call_args_list:
        event = c.args[0] if c.args else c.kwargs.get("event")
        if len(c.args) > 1:
            props = c.args[1]
        else:
            props = c.kwargs.get("properties") or c.kwargs.get("props") or {}
        out.append((event, props))
    return out


class TestLogEventCommandDualWrite:
    @patch("recce.git.current_branch", return_value="my-branch")
    @patch("recce.git.hosting_repo", return_value="my-repo")
    @patch("recce.get_runner", return_value=None)
    def test_command_event_dual_writes_with_same_hashes(
        self, mock_runner, mock_repo, mock_branch, opted_in_profile, collector, ph_track
    ):
        from hashlib import sha256

        from recce.event import log_event

        log_event({"command": "run", "status": True}, "command")

        # Amplitude path unchanged.
        collector.log_event.assert_called_once()
        amp_payload = collector.log_event.call_args.args[0]
        amp_event_type = collector.log_event.call_args.args[1]
        assert amp_event_type == "command"

        # PostHog path fired exactly once with the same hashed identity values.
        ph = _ph_calls(ph_track)
        assert len(ph) == 1
        event, props = ph[0]
        assert event == "command"
        assert props["repository"] == sha256(b"my-repo").hexdigest()
        assert props["branch"] == sha256(b"my-branch").hexdigest()
        # Parity: PostHog gets the SAME repository/branch values Amplitude got.
        assert props["repository"] == amp_payload["repository"]
        assert props["branch"] == amp_payload["branch"]


class TestApiEventDualWrite:
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_api_event_single_event_with_endpoint_name(
        self, mock_runner, mock_repo, mock_branch, opted_in_profile, collector, ph_track
    ):
        from recce.event import log_api_event

        log_api_event("save", {"type": "check"})

        # D8: a SINGLE 'api_event' PostHog event carrying endpoint_name (not split).
        ph = _ph_calls(ph_track)
        assert len(ph) == 1
        event, props = ph[0]
        assert event == "api_event"
        assert props["endpoint_name"] == "save"
        assert props["type"] == "check"


class TestLoadStateDualWrite:
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    @patch("recce.models.CheckDAO")
    def test_load_state_dual_writes(
        self, mock_dao, mock_runner, mock_repo, mock_branch, opted_in_profile, collector, ph_track
    ):
        mock_dao.return_value.list.return_value = []
        from recce.event import log_load_state

        log_load_state(command="run")

        ph = _ph_calls(ph_track)
        assert len(ph) == 1
        event, props = ph[0]
        assert event == "load_state"
        assert props["command"] == "run"
        assert props["checks"] == 0
        assert props["preset_checks"] == 0


class TestSingleEnvDualWrite:
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_single_env_event_renamed(self, mock_runner, mock_repo, mock_branch, opted_in_profile, collector, ph_track):
        from recce.event import log_single_env_event

        log_single_env_event()

        # Amplitude keeps the bracketed name; PostHog renames to 'single_environment_cli'.
        amp_event_type = collector.log_event.call_args.args[1]
        assert amp_event_type == "[Experiment] single_environment"

        ph = _ph_calls(ph_track)
        assert len(ph) == 1
        event, props = ph[0]
        assert event == "single_environment_cli"
        assert props["action"] == "launch_server"


class TestConnectedToCloudDualWrite:
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_connected_to_cloud_renamed(
        self, mock_runner, mock_repo, mock_branch, opted_in_profile, collector, ph_track
    ):
        from recce.event import log_connected_to_cloud

        log_connected_to_cloud()

        amp_event_type = collector.log_event.call_args.args[1]
        assert amp_event_type == "Connect OSS to Cloud"

        ph = _ph_calls(ph_track)
        assert len(ph) == 1
        event, props = ph[0]
        assert event == "oss_connect_to_cloud_cli"
        assert props["action"] == "connected_to_cloud"


class TestPerformanceDualWrite:
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_performance_single_event_with_feature(
        self, mock_runner, mock_repo, mock_branch, opted_in_profile, collector, ph_track
    ):
        from recce.event import log_performance

        log_performance("server_startup", {"duration_ms": 1234})

        # Amplitude builds a dynamic '[Performance] server_startup' event type.
        amp_event_type = collector.log_event.call_args.args[1]
        assert amp_event_type == "[Performance] server_startup"

        # D9: PostHog emits a SINGLE 'performance' event with feature + flat metrics.
        ph = _ph_calls(ph_track)
        assert len(ph) == 1
        event, props = ph[0]
        assert event == "performance"
        assert props["feature"] == "server_startup"
        assert props["duration_ms"] == 1234


class TestCodespacesDualWrite:
    @patch("recce.event.get_github_codespace_available_at")
    @patch("recce.event.get_github_codespace_name", return_value="cs-name")
    @patch("recce.event.get_github_codespace_info")
    def test_codespace_instance_flattened(
        self,
        mock_info,
        mock_name,
        mock_available_at,
        opted_in_profile,
        collector,
        ph_track,
    ):
        from datetime import datetime

        mock_info.return_value = {
            "location": "EastUs",
            "prebuild": True,
            "machine": {"display_name": "4-core"},
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        mock_available_at.return_value = datetime(2026, 1, 1, 1, 0, 0)

        from recce.event import log_codespaces_events

        log_codespaces_events("server")

        # Both Amplitude direct log_event calls still fire (created + available).
        assert collector.log_event.call_count >= 1

        # PostHog gets 'codespace_instance' with user_prop flattened onto props.
        ph = _ph_calls(ph_track)
        assert len(ph) >= 1
        event, props = ph[0]
        assert event == "codespace_instance"
        assert props["location"] == "EastUs"
        assert props["is_prebuild"] is True
        assert "event_triggered_at" in props
        assert "state" in props
