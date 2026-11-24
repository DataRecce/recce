"""The anonymous_tracking opt-out and the kill switch cover every telemetry path.

Regression tests for an external report: with ``anonymous_tracking: false``
Recce still started Sentry (sending hostname, home paths and SQL-bearing error
text), POSTed an empty batch to Amplitude on every command, and set the
``recce_user_id`` cookie to the string "None", which the browser read as a user
id and used to start Amplitude, PostHog and session replay.
"""

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest
import sentry_sdk
from fastapi import FastAPI
from fastapi.testclient import TestClient

import recce.event as event
from recce import yaml as pyml
from recce.event.collector import Collector


@pytest.fixture
def profile_path():
    paths = []

    def _write(content):
        f = tempfile.NamedTemporaryFile(mode="w", suffix=".yml", delete=False)
        if isinstance(content, str):
            f.write(content)
        else:
            pyml.dump(content, f)
        f.close()
        paths.append(f.name)
        return f.name

    yield _write
    for p in paths:
        if os.path.exists(p):
            os.unlink(p)


@pytest.fixture(autouse=True)
def _no_kill_switch():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("RECCE_DISABLE_TELEMETRY", None)
        os.environ.pop("DO_NOT_TRACK", None)
        yield


class TestTelemetryEnabled:
    @pytest.mark.parametrize(
        "content,expected",
        [
            ("user_id: u\nanonymous_tracking: true\n", True),
            ("user_id: u\nanonymous_tracking: false\n", False),
            # YAML 1.2 loads these as strings, not booleans: they must mean off.
            ("user_id: u\nanonymous_tracking: no\n", False),
            ("user_id: u\nanonymous_tracking: off\n", False),
            ('user_id: u\nanonymous_tracking: "false"\n', False),
            ('user_id: u\nanonymous_tracking: "true"\n', False),
            ("user_id: u\n", False),
            ("", False),
        ],
    )
    def test_only_a_real_true_enables(self, profile_path, content, expected):
        with patch("recce.event.RECCE_USER_PROFILE", profile_path(content)):
            assert event.telemetry_enabled() is expected
            assert event.is_anonymous_tracking() is expected

    def test_missing_profile_is_off_and_not_created(self, tmp_path):
        missing = tmp_path / "profile.yml"
        with patch("recce.event.RECCE_USER_PROFILE", str(missing)):
            assert event.telemetry_enabled() is False
        assert not missing.exists()

    @pytest.mark.parametrize(
        "env",
        [
            {"RECCE_DISABLE_TELEMETRY": "1"},
            {"RECCE_DISABLE_TELEMETRY": "true"},
            {"RECCE_DISABLE_TELEMETRY": "YES"},
            {"DO_NOT_TRACK": "1"},
        ],
    )
    def test_kill_switch_overrides_an_opted_in_profile(self, profile_path, env):
        path = profile_path({"user_id": "u", "anonymous_tracking": True})
        with patch("recce.event.RECCE_USER_PROFILE", path), patch.dict(os.environ, env):
            assert event.telemetry_enabled() is False
            assert event.should_log_event() is False

    @pytest.mark.parametrize("value", ["0", "false", ""])
    def test_falsy_kill_switch_values_do_not_disable(self, profile_path, value):
        path = profile_path({"user_id": "u", "anonymous_tracking": True})
        with patch("recce.event.RECCE_USER_PROFILE", path), patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": value}):
            assert event.telemetry_enabled() is True


class TestProfileRegeneration:
    def test_regenerating_user_id_keeps_the_opt_out(self, profile_path):
        path = profile_path({"anonymous_tracking": False})
        with patch("recce.event.RECCE_USER_PROFILE", path):
            profile = event.load_user_profile()
            assert profile["user_id"]
            assert profile["anonymous_tracking"] is False
            assert event.telemetry_enabled() is False
        with open(path, encoding="utf-8") as f:
            assert pyml.load(f)["anonymous_tracking"] is False

    def test_new_profile_defaults_to_tracking_on(self, tmp_path):
        path = tmp_path / "profile.yml"
        with (
            patch("recce.event.RECCE_USER_PROFILE", str(path)),
            patch("recce.event.RECCE_USER_HOME", str(tmp_path)),
        ):
            profile = event.load_user_profile()
        assert profile["anonymous_tracking"] is True


class TestAmplitudeCollector:
    @pytest.fixture
    def collector(self, tmp_path):
        c = Collector()
        c.set_api_key("key")
        c.set_user_id("uid")
        c.set_unsend_events_file(str(tmp_path / "events.json"))
        return c

    def test_empty_queue_makes_no_request(self, collector):
        with patch("recce.event.collector.requests.post") as post:
            collector.send_events()
        post.assert_not_called()

    def test_queued_events_are_sent(self, collector):
        collector.log_event({"a": 1}, "command")
        with patch("recce.event.collector.requests.post") as post:
            collector.send_events()
        post.assert_called_once()
        assert len(post.call_args.kwargs["json"]["events"]) == 1

    def test_clear_events_drops_the_queue(self, collector):
        collector.log_event({"a": 1}, "command")
        collector.clear_events()
        with patch("recce.event.collector.requests.post") as post:
            collector.send_events()
        post.assert_not_called()

    def test_init_drops_events_queued_before_opting_out(self, profile_path, tmp_path):
        queue = tmp_path / "events.json"
        queued = Collector()
        queued.set_api_key("key")
        queued.set_user_id("uid")
        queued.set_unsend_events_file(str(queue))
        queued.log_event({"a": 1}, "command")

        fresh = Collector()
        path = profile_path({"user_id": "uid", "anonymous_tracking": False})
        with (
            patch("recce.event._collector", fresh),
            patch("recce.event.RECCE_USER_PROFILE", path),
            patch("recce.event.RECCE_USER_EVENT_PATH", str(queue)),
            patch("recce.event.sentry_sdk") as sentry,
            patch("recce.event.collector.requests.post") as post,
        ):
            event.init()
            event.flush_events()
            fresh.send_events()

        sentry.init.assert_not_called()
        post.assert_not_called()


class TestSentryScrubbing:
    def _exc_event(self, module, value, tags=None):
        return {
            "server_name": "my-laptop.local",
            "tags": tags or {},
            "exception": {
                "values": [
                    {
                        "type": "Err",
                        "module": module,
                        "value": value,
                        "stacktrace": {"frames": [{"abs_path": os.path.join(event.USER_HOME, "proj", "x.py")}]},
                    }
                ]
            },
        }

    @pytest.mark.parametrize(
        "module", ["dbt_common.exceptions", "dbt.adapters.exceptions", "_duckdb", "snowflake.connector.errors"]
    )
    def test_warehouse_error_text_is_redacted(self, module):
        sql = "SELECT secret_col FROM prod_db.finance.payments"
        out = event._scrub_sentry_event(self._exc_event(module, sql), {})
        assert out["exception"]["values"][0]["value"] == event.REDACTED_EXCEPTION_VALUE
        assert "secret_col" not in str(out)

    def test_other_errors_keep_their_message(self):
        out = event._scrub_sentry_event(self._exc_event(None, "list index out of range"), {})
        assert out["exception"]["values"][0]["value"] == "list index out of range"

    def test_redact_tag_redacts_any_exception(self):
        out = event._scrub_sentry_event(
            self._exc_event(None, "Binder Error: column secret_col not found", {event.SENTRY_REDACT_TAG: "true"}), {}
        )
        assert out["exception"]["values"][0]["value"] == event.REDACTED_EXCEPTION_VALUE

    def test_hostname_and_home_paths_are_removed(self):
        out = event._scrub_sentry_event(self._exc_event(None, "boom"), {})
        assert "server_name" not in out
        assert event.USER_HOME not in str(out)
        assert out["exception"]["values"][0]["stacktrace"]["frames"][0]["abs_path"].startswith("~")

    def test_run_func_redacts_task_errors_end_to_end(self):
        """The scope tag set in run_func reaches before_send and redacts."""
        sent = []

        class _Transport(sentry_sdk.transport.Transport):
            def capture_envelope(self, envelope):
                for item in envelope.items:
                    payload = item.get_event()
                    if payload:
                        sent.append(payload)

        with sentry_sdk.new_scope():
            client = sentry_sdk.Client(
                dsn="https://p@example.invalid/1",
                transport=_Transport,
                before_send=event._scrub_sentry_event,
                default_integrations=False,
                # Without this the SDK stores the hostname as a global span
                # attribute that outlives this client and leaks into later tests.
                server_name="",
                data_collection={"stack_frame_variables": False},
            )
            sentry_sdk.get_current_scope().set_client(client)
            try:
                raise ValueError("Catalog Error: Table prod_db.finance.payments does not exist")
            except ValueError as e:
                with sentry_sdk.new_scope() as scope:
                    scope.set_tag(event.SENTRY_REDACT_TAG, "true")
                    sentry_sdk.capture_exception(e)
            client.flush()

        assert len(sent) == 1
        # (Frame context lines hold this test's own source, so check the value.)
        assert sent[0]["exception"]["values"][0]["value"] == event.REDACTED_EXCEPTION_VALUE


class TestCookieMiddleware:
    @pytest.fixture
    def client(self):
        from recce.server import set_context_by_cookie

        app = FastAPI()
        app.middleware("http")(set_context_by_cookie)

        @app.get("/")
        def index():
            return {}

        return TestClient(app)

    def test_opted_out_never_sets_a_none_cookie(self, client):
        with patch("recce.event.is_anonymous_tracking", return_value=False):
            resp = client.get("/")
        assert "recce_user_id" not in resp.headers.get("set-cookie", "")

    def test_opted_out_deletes_an_existing_cookie(self, client):
        client.cookies.set("recce_user_id", "uid-old")
        with patch("recce.event.is_anonymous_tracking", return_value=False):
            resp = client.get("/")
        set_cookie = resp.headers.get("set-cookie", "")
        assert "recce_user_id=" in set_cookie
        assert "uid-old" not in set_cookie
        assert "Max-Age=0" in set_cookie or "expires=" in set_cookie.lower()

    def test_opted_in_sets_the_user_id(self, client):
        with (
            patch("recce.event.is_anonymous_tracking", return_value=True),
            patch("recce.event.get_user_id", return_value="uid-1"),
        ):
            resp = client.get("/")
        assert "recce_user_id=uid-1" in resp.headers.get("set-cookie", "")


class TestPosthogKillSwitch:
    @pytest.mark.parametrize("value,expected", [("1", True), ("0", False), ("", False)])
    def test_normalized_values(self, value, expected):
        from recce.event.posthog_telemetry import _is_kill_switched

        with patch.dict(os.environ, {"RECCE_DISABLE_TELEMETRY": value}):
            assert _is_kill_switched() is expected

    def test_do_not_track_blocks_capture(self):
        import recce.event.posthog_telemetry as ph

        client = MagicMock()
        with patch.dict(os.environ, {"DO_NOT_TRACK": "1"}), patch.object(ph, "_get_client", return_value=client):
            ph.track("command", {})
        client.capture.assert_not_called()


class TestRealSentrySdkPayloads:
    """Drive the real SDK through event.init() and inspect every envelope.

    Guards the SDK-version-specific paths: Sentry SDK 3 attaches sys.argv to
    every segment span as process.command_args (ArgvIntegration does not cover
    it) and captures log lines as events, breadcrumbs or Sentry Logs.
    """

    def test_opted_in_payloads_carry_no_secrets_paths_or_sql(self, profile_path):
        import logging
        import socket

        sent = []

        class _Transport(sentry_sdk.transport.Transport):
            def capture_envelope(self, envelope):
                for item in envelope.items:
                    sent.append(item.payload.get_bytes().decode("utf-8", "replace"))

        real_init = sentry_sdk.init

        def _init(*args, **kwargs):
            kwargs["transport"] = _Transport
            kwargs["dsn"] = "https://p@example.invalid/1"
            return real_init(*args, **kwargs)

        sql = "SELECT secret_col FROM prod_db.finance.payments"
        token = "FAKE-TOKEN-FOR-TEST"

        class DbtDatabaseError(Exception):
            pass

        DbtDatabaseError.__module__ = "dbt_common.exceptions"

        path = profile_path({"user_id": "u", "anonymous_tracking": True})
        try:
            with (
                patch("recce.event.RECCE_USER_PROFILE", path),
                patch("recce.event.__version__", "1.99.0"),
                patch("recce.event._get_api_key", return_value="key"),
                patch("recce.event._collector"),
                patch.object(sentry_sdk, "init", _init),
                patch("sys.argv", ["recce", "server", "--cloud-token", token]),
            ):
                event.init()
                log = logging.getLogger("recce.test.sentry")
                log.info("info %s", sql)
                log.warning("warn %s", sql)
                log.error("Failed to execute value_diff task: %s", sql)
                with sentry_sdk.start_span(name="test-span"):
                    pass
                try:
                    raise DbtDatabaseError(f"{sql} in {event.USER_HOME}")
                except DbtDatabaseError as e:
                    sentry_sdk.capture_exception(e)
                sentry_sdk.flush()
        finally:
            sentry_sdk.get_client().close()
            sentry_sdk.get_global_scope().set_client(None)

        blob = "\n".join(sent)
        assert "test-span" in blob, "span was not sent; the probe is not exercising spans"
        assert event.REDACTED_EXCEPTION_VALUE in blob, "exception was not sent"
        assert token not in blob
        assert "secret_col" not in blob
        assert event.USER_HOME not in blob
        assert socket.gethostname() not in blob
        assert "process.command_args" not in blob
        assert "server.address" not in blob
