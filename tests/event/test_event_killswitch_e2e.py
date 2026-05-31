"""Kill-switch E2E + recce-insight 7.3 contract guard.

TESTS-FIRST (red): the PostHog fan-out and recce.event.posthog_telemetry do not
exist yet.

- KILL SWITCH (D12): with RECCE_DISABLE_TELEMETRY set, drive a full TrackCommand
  invoke (CliRunner, like recce_cloud's TestTrackedCommand) and assert the PostHog
  client.capture is never called, while the Amplitude path is UNTOUCHED by the
  kill switch (kill switch is PostHog-scoped during the dual-run window).
- recce-insight 7.3 CONTRACT: the property dicts PostHog emits for command /
  api_event / load_state carry the exact keys recce-insight int models extract,
  so the mart does not silently null out.
"""

import os
import tempfile
from unittest.mock import MagicMock, patch

import click
from click.testing import CliRunner

from recce import yaml as pyml


def _opted_in_profile():
    f = tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False)
    pyml.dump({"user_id": "uid-test", "anonymous_tracking": True}, f)
    f.flush()
    f.close()
    return f.name


class TestKillSwitchE2E:
    @patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": "1"})
    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_kill_switch_blocks_posthog_capture_keeps_amplitude(self, mock_runner, mock_repo, mock_branch):
        from recce.track import TrackCommand

        @click.command(cls=TrackCommand)
        def hello():
            click.echo("hi")

        path = _opted_in_profile()
        try:
            with (
                patch("recce.event.RECCE_USER_PROFILE", path),
                patch("recce.event._collector") as mock_collector,
                # Patch the lazily-built PostHog client so we can observe capture.
                patch("recce.event.posthog_telemetry._get_client") as mock_get_client,
            ):
                mock_collector.is_ready.return_value = True
                ph_client = MagicMock()
                mock_get_client.return_value = ph_client

                runner = CliRunner()
                result = runner.invoke(hello)
                assert result.exit_code == 0

                # Kill switch is PostHog-scoped: Amplitude still records the command.
                assert mock_collector.log_event.called
                # No PostHog capture under the kill switch.
                ph_client.capture.assert_not_called()
        finally:
            os.unlink(path)

    def test_kill_switch_blocks_track_directly(self):
        import recce.event.posthog_telemetry as ph

        ph._client = None
        ph._initialized = False
        client = MagicMock()
        with (
            patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": "1"}),
            patch.object(ph, "_get_client", return_value=client),
        ):
            ph.track("command", {"status": True})
        client.capture.assert_not_called()


class TestRecceInsightContract:
    """Regression guard: PostHog property dicts keep the keys recce-insight 7.3 joins on."""

    @patch("recce.git.current_branch", return_value="b")
    @patch("recce.git.hosting_repo", return_value="r")
    @patch("recce.get_runner", return_value="github actions")
    def test_command_props_contract(self, mock_runner, mock_repo, mock_branch):
        from recce.event import log_event

        path = _opted_in_profile()
        try:
            with (
                patch("recce.event.RECCE_USER_PROFILE", path),
                patch("recce.event._collector") as mock_collector,
                patch("recce.event.posthog_telemetry.track") as ph_track,
            ):
                mock_collector.is_ready.return_value = True
                log_event(
                    {
                        "command": "run",
                        "status": True,
                        "cloud": False,
                        "adapter_type": "DBT",
                    },
                    "command",
                )

                event = ph_track.call_args.args[0]
                props = ph_track.call_args.args[1]
                assert event == "command"
                for key in ("command", "status", "repository", "branch", "runner_type", "adapter_type", "cloud"):
                    assert key in props, f"recce-insight command contract missing {key}"
        finally:
            os.unlink(path)

    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    def test_api_event_props_contract(self, mock_runner, mock_repo, mock_branch):
        from recce.event import log_api_event

        path = _opted_in_profile()
        try:
            with (
                patch("recce.event.RECCE_USER_PROFILE", path),
                patch("recce.event._collector") as mock_collector,
                patch("recce.event.posthog_telemetry.track") as ph_track,
            ):
                mock_collector.is_ready.return_value = True
                log_api_event("create_run", {"type": "query"})

                event = ph_track.call_args.args[0]
                props = ph_track.call_args.args[1]
                assert event == "api_event"
                assert props["endpoint_name"] == "create_run"
                assert props["type"] == "query"
        finally:
            os.unlink(path)

    @patch("recce.git.current_branch", return_value=None)
    @patch("recce.git.hosting_repo", return_value=None)
    @patch("recce.get_runner", return_value=None)
    @patch("recce.models.CheckDAO")
    def test_load_state_props_contract(self, mock_dao, mock_runner, mock_repo, mock_branch):
        mock_dao.return_value.list.return_value = []
        from recce.event import log_load_state

        path = _opted_in_profile()
        try:
            with (
                patch("recce.event.RECCE_USER_PROFILE", path),
                patch("recce.event._collector") as mock_collector,
                patch("recce.event.posthog_telemetry.track") as ph_track,
            ):
                mock_collector.is_ready.return_value = True
                log_load_state(command="run")

                event = ph_track.call_args.args[0]
                props = ph_track.call_args.args[1]
                assert event == "load_state"
                for key in ("command", "checks", "preset_checks"):
                    assert key in props, f"recce-insight load_state contract missing {key}"
        finally:
            os.unlink(path)
