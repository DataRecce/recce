"""Sentry is on for released builds, and for a development build that opts in.

The environment comes from __version__.
"""

import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest
import sentry_sdk as real_sentry_sdk

import recce.event as event


@pytest.fixture(autouse=True)
def _clear_opt_in():
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("RECCE_ENABLE_SENTRY_IN_DEVELOPMENT", None)
        yield


@pytest.fixture
def stubs():
    with (
        patch("recce.event.sentry_sdk") as sentry_sdk,
        patch("recce.event._collector") as collector,
        patch("recce.event._get_api_key", return_value="key"),
        patch("recce.event._get_sentry_dns", return_value="https://p@example.invalid/1"),
        patch("recce.event.load_user_profile", return_value={"user_id": "uid-test"}),
        patch("recce.event.telemetry_enabled", return_value=True),
    ):
        yield SimpleNamespace(sentry_sdk=sentry_sdk, collector=collector)


def test_development_build_does_not_start_sentry(stubs):
    with patch("recce.event.__version__", "1.62.0.dev0"):
        event.init()

    stubs.sentry_sdk.init.assert_not_called()
    stubs.sentry_sdk.set_tag.assert_not_called()


def test_development_build_still_sets_up_amplitude(stubs):
    with patch("recce.event.__version__", "1.62.0.dev0"):
        event.init()

    stubs.collector.set_api_key.assert_called_once_with("key")
    stubs.collector.set_user_id.assert_called_once_with("uid-test")
    stubs.collector.set_unsend_events_file.assert_called_once_with(event.RECCE_USER_EVENT_PATH)


@pytest.mark.parametrize(
    "version,expected_env",
    [
        ("1.62.0.20260825", "nightly"),
        ("1.62.0.20260825-post1", "nightly"),
        ("1.62.0.20260825a1", "nightly"),
        ("1.62.0", "production"),
    ],
)
def test_released_build_starts_sentry(stubs, version, expected_env):
    with patch("recce.event.__version__", version):
        event.init()

    kwargs = stubs.sentry_sdk.init.call_args.kwargs
    assert kwargs["environment"] == expected_env
    assert kwargs["release"] == version
    assert kwargs["data_collection"]["stack_frame_variables"] is False
    assert kwargs["data_collection"]["http_bodies"] == []
    assert kwargs["attach_stacktrace"] is False
    # Run the real SDK option validation: recce.track swallows init errors,
    # so a rejected option would silently turn Sentry off.
    real_sentry_sdk.Client(**kwargs).close()


@pytest.mark.parametrize("value", ["1", "TRUE"])
def test_opt_in_starts_sentry_on_a_development_build(stubs, value):
    with (
        patch.dict(os.environ, {"RECCE_ENABLE_SENTRY_IN_DEVELOPMENT": value}),
        patch("recce.event.__version__", "1.62.0.dev0"),
    ):
        event.init()

    assert stubs.sentry_sdk.init.call_args.kwargs["environment"] == "development"


def test_unrecognized_opt_in_value_does_not_start_sentry(stubs):
    with (
        patch.dict(os.environ, {"RECCE_ENABLE_SENTRY_IN_DEVELOPMENT": "0"}),
        patch("recce.event.__version__", "1.62.0.dev0"),
    ):
        event.init()

    stubs.sentry_sdk.init.assert_not_called()


def test_opted_out_user_never_starts_sentry_and_drops_the_queue(stubs):
    with (
        patch("recce.event.telemetry_enabled", return_value=False),
        patch("recce.event.__version__", "1.62.0"),
    ):
        event.init()

    stubs.sentry_sdk.init.assert_not_called()
    stubs.collector.clear_events.assert_called_once()


def test_sentry_does_not_send_hostname_argv_or_log_lines(stubs):
    from sentry_sdk.integrations.argv import ArgvIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    with patch("recce.event.__version__", "1.62.0"):
        event.init()

    kwargs = stubs.sentry_sdk.init.call_args.kwargs
    assert kwargs["server_name"] == ""
    assert kwargs["data_collection"]["user_info"] is False
    assert any(isinstance(i, ArgvIntegration) for i in kwargs["disabled_integrations"])
    (logging_integration,) = [i for i in kwargs["integrations"] if isinstance(i, LoggingIntegration)]
    # SDK 3 splits log capture into Sentry Logs, events and breadcrumbs: all off.
    assert logging_integration._logs_handler is None
    assert logging_integration._event_handler is None
    assert logging_integration._breadcrumb_handler is None
    assert kwargs["before_send"] is event._scrub_sentry_event
    assert kwargs["before_send_span"] is event._scrub_sentry_span
