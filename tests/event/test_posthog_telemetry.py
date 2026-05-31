"""Tests for the OSS PostHog telemetry module (recce/event/posthog_telemetry.py).

TESTS-FIRST (red): the module does not exist yet. These mirror the structure of
recce_cloud/tests/test_telemetry.py but are rewired to the OSS identity / opt-out /
common-props contract from the P4 design:

- event_source="oss-cli" on every event (D4)
- _get_distinct_id() reads recce.event.load_user_profile()["user_id"] with _CI suffix
  when recce.is_ci_env() (D6) -- the SAME profile.yml identity Amplitude uses
- $process_person_profile=False on every capture (D6, no PostHog person rows)
- opt-out gate reuses the OSS should_log_event() / is_tracking_opted_in() (D5)
- RECCE_DISABLE_TELEMETRY kill switch (D12)
- _get_api_key() returns the hardcoded prod key, RECCE_POSTHOG_API_KEY overrides
"""

import hashlib
import os
import sys
from unittest.mock import MagicMock, patch

import pytest


def _reset(mod):
    """Reset the lazy-singleton module state between cases."""
    mod._client = None
    mod._initialized = False


@pytest.fixture
def ph():
    """Import the (not-yet-implemented) module fresh and reset its singleton."""
    import recce.event.posthog_telemetry as mod

    _reset(mod)
    yield mod
    _reset(mod)


class TestConstants:
    def test_host_matches_recce_cloud(self, ph):
        assert ph.POSTHOG_HOST == "https://us.i.posthog.com"

    def test_prod_key_copied_verbatim(self, ph):
        # EXACT prod write-only key copied from recce_cloud/telemetry.py (D4).
        assert ph._POSTHOG_KEY_PROD == "phc_WDJMPIYB2WTasN3sVxwIasBOSTjZ9rVTkpqf5lVKeRL"

    def test_event_source_constant(self, ph):
        assert ph.EVENT_SOURCE == "oss-cli"


class TestGetApiKey:
    @patch.dict(os.environ, {}, clear=True)
    def test_defaults_to_prod_key(self, ph):
        # OSS has no prod-host concept: always have the prod key available (D5 opt-out on).
        assert ph._get_api_key() == ph._POSTHOG_KEY_PROD
        assert ph._get_api_key() != ""

    @patch.dict(os.environ, {"RECCE_POSTHOG_API_KEY": "staging-key"})
    def test_env_var_overrides_prod_key(self, ph):
        # RECCE_POSTHOG_API_KEY redirects dev/test runs to the staging project.
        assert ph._get_api_key() == "staging-key"


class TestKillSwitch:
    @patch.dict(os.environ, {}, clear=True)
    def test_not_kill_switched_by_default(self, ph):
        assert ph._is_kill_switched() is False

    @patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": "1"})
    def test_kill_switched_when_set(self, ph):
        assert ph._is_kill_switched() is True

    @patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": "true"})
    def test_kill_switched_truthy_string(self, ph):
        assert ph._is_kill_switched() is True

    @patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": "1"})
    def test_get_client_returns_none_when_kill_switched(self, ph):
        # Kill switch is checked FIRST in _get_client -> no client, no posthog import.
        assert ph._get_client() is None

    @patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": "1"})
    def test_track_noop_when_kill_switched(self, ph):
        # Even if a client somehow existed, track must short-circuit and never capture.
        client = MagicMock()
        ph._client = client
        ph._initialized = True
        ph.track("command", {"k": "v"})
        client.capture.assert_not_called()


class TestShouldTrack:
    def test_true_when_opted_in(self, ph):
        # Single source of truth = OSS opt-out gate. Accept either entry point the
        # design may wire (should_log_event reused, or the extracted is_tracking_opted_in).
        with patch("recce.event.should_log_event", return_value=True):
            assert ph._should_track() is True

    def test_false_when_opted_out(self, ph):
        with patch("recce.event.should_log_event", return_value=False):
            assert ph._should_track() is False

    def test_false_on_exception(self, ph):
        with patch("recce.event.should_log_event", side_effect=Exception("boom")):
            assert ph._should_track() is False


class TestGetDistinctId:
    @patch("recce.is_ci_env", return_value=False)
    @patch("recce.event.load_user_profile", return_value={"user_id": "uid-abc"})
    def test_returns_profile_user_id(self, mock_profile, mock_ci, ph):
        assert ph._get_distinct_id() == "uid-abc"

    @patch("recce.is_ci_env", return_value=True)
    @patch("recce.event.load_user_profile", return_value={"user_id": "uid-abc"})
    def test_appends_ci_suffix(self, mock_profile, mock_ci, ph):
        # Mirrors collector._get_user_id() + capture_exception()'s _CI handling.
        assert ph._get_distinct_id() == "uid-abc_CI"

    @patch("recce.event.load_user_profile", side_effect=Exception("no profile"))
    def test_returns_unknown_on_exception(self, mock_profile, ph):
        assert ph._get_distinct_id() == "unknown"


class TestAnonymize:
    def test_consistent_and_16_chars(self, ph):
        # anonymize is provided for net-new hashing only (16-char prefix, mirrors recce_cloud).
        out = ph.anonymize("hello")
        assert out == hashlib.sha256(b"hello").hexdigest()[:16]
        assert len(out) == 16


class TestGetCommonProperties:
    @patch("recce.github.is_github_codespace", return_value=False)
    @patch("recce.is_recce_cloud_instance", return_value=False)
    @patch("recce.is_ci_env", return_value=False)
    @patch("recce.get_version", return_value="9.9.9")
    @patch("recce.event.load_user_profile", return_value={"user_id": "uid-xyz"})
    def test_includes_oss_common_props(self, mock_profile, mock_version, mock_ci, mock_cloud, mock_cs, ph):
        props = ph.get_common_properties()
        assert props["event_source"] == "oss-cli"
        assert props["version"] == "9.9.9"
        assert props["python_version"] == f"{sys.version_info.major}.{sys.version_info.minor}"
        assert props["is_ci"] is False
        assert props["is_github_codespace"] is False
        assert props["is_recce_cloud_instance"] is False
        assert props["os_platform"] == sys.platform
        assert "os_version" in props
        # recce-insight 7.3 needs user_id carried as a property too (D6 join key).
        assert props["user_id"] == "uid-xyz"


class TestTrack:
    @patch("recce.event.posthog_telemetry._get_client", return_value=None)
    def test_noop_when_no_client(self, mock_client, ph):
        # Should not raise when client is None (graceful no-op / dual-write safe).
        ph.track("command", {"k": "v"})

    @patch("recce.event.posthog_telemetry.get_common_properties", return_value={"event_source": "oss-cli"})
    @patch("recce.event.posthog_telemetry._get_distinct_id", return_value="uid-123")
    @patch("recce.event.posthog_telemetry._get_client")
    def test_captures_event_with_flat_props(self, mock_get_client, mock_id, mock_props, ph):
        client = MagicMock()
        mock_get_client.return_value = client

        ph.track("command", {"status": True})

        client.capture.assert_called_once_with(
            distinct_id="uid-123",
            event="command",
            properties={
                "event_source": "oss-cli",
                "status": True,
                "$process_person_profile": False,
            },
        )

    @patch("recce.event.posthog_telemetry.get_common_properties", return_value={})
    @patch("recce.event.posthog_telemetry._get_distinct_id", return_value="uid-123")
    @patch("recce.event.posthog_telemetry._get_client")
    def test_sets_process_person_profile_false(self, mock_get_client, mock_id, mock_props, ph):
        client = MagicMock()
        mock_get_client.return_value = client

        ph.track("command")

        call_props = client.capture.call_args[1]["properties"]
        assert call_props["$process_person_profile"] is False

    @patch("recce.event.posthog_telemetry.get_common_properties", return_value={})
    @patch("recce.event.posthog_telemetry._get_distinct_id", return_value="uid-123")
    @patch("recce.event.posthog_telemetry._get_client")
    def test_swallows_capture_exception(self, mock_get_client, mock_id, mock_props, ph):
        client = MagicMock()
        client.capture.side_effect = Exception("network down")
        mock_get_client.return_value = client

        # Must never raise -- telemetry can't break the CLI.
        ph.track("command")


class TestGetClient:
    def test_none_when_opted_out(self, ph):
        with patch.object(ph, "_should_track", return_value=False):
            assert ph._get_client() is None

    def test_none_when_no_api_key(self, ph):
        with (
            patch.object(ph, "_should_track", return_value=True),
            patch.object(ph, "_get_api_key", return_value=""),
        ):
            assert ph._get_client() is None

    def test_builds_client_and_registers_atexit(self, ph):
        # When opted in + key present + not kill-switched, lazily build the Posthog
        # client (patched) and register the atexit flush safety-net.
        fake_posthog_module = MagicMock()
        fake_client = MagicMock()
        fake_posthog_module.Posthog.return_value = fake_client

        with (
            patch.object(ph, "_should_track", return_value=True),
            patch.object(ph, "_get_api_key", return_value="phc_test"),
            patch.dict(os.environ, {}, clear=True),
            patch.dict(sys.modules, {"posthog": fake_posthog_module}),
            patch("atexit.register") as mock_atexit,
        ):
            client = ph._get_client()

        assert client is fake_client
        # Constructed with the documented PostHog options.
        _, kwargs = fake_posthog_module.Posthog.call_args
        assert kwargs.get("host") == "https://us.i.posthog.com"
        # geoip ENABLED for the OSS CLI so `country` resolves from the user's IP.
        assert kwargs.get("disable_geoip") is False
        # atexit flush hook registered (safety net for the short-lived CLI).
        mock_atexit.assert_called_once_with(ph.shutdown)

    def test_get_client_swallows_init_error(self, ph):
        # A broken/absent posthog install must yield None, never raise.
        broken = MagicMock()
        broken.Posthog.side_effect = Exception("no posthog")
        with (
            patch.object(ph, "_should_track", return_value=True),
            patch.object(ph, "_get_api_key", return_value="phc_test"),
            patch.dict(sys.modules, {"posthog": broken}),
        ):
            assert ph._get_client() is None


class TestShutdown:
    def test_shutdown_flushes_and_clears_client(self, ph):
        client = MagicMock()
        ph._client = client
        ph.shutdown()
        client.shutdown.assert_called_once()
        assert ph._client is None

    def test_shutdown_noop_when_no_client(self, ph):
        ph._client = None
        # Must not raise.
        ph.shutdown()
