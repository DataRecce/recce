"""Sentry starts for released builds only. The environment comes from __version__."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

import recce.event as event


@pytest.fixture
def stubs():
    with (
        patch("recce.event.sentry_sdk") as sentry_sdk,
        patch("recce.event._collector") as collector,
        patch("recce.event._get_api_key", return_value="key"),
        patch("recce.event._get_sentry_dns", return_value="https://p@example.invalid/1"),
        patch("recce.event.load_user_profile", return_value={"user_id": "uid-test"}),
    ):
        yield SimpleNamespace(sentry_sdk=sentry_sdk, collector=collector)


@pytest.mark.parametrize("version", ["1.62.0.dev0", "1.62.0.dev12"])
def test_development_build_does_not_start_sentry(stubs, version):
    with patch("recce.event.__version__", version):
        event.init()

    stubs.sentry_sdk.init.assert_not_called()
    stubs.sentry_sdk.set_tag.assert_not_called()


def test_development_build_still_sets_up_amplitude(stubs):
    with patch("recce.event.__version__", "1.62.0.dev0"):
        event.init()

    stubs.collector.set_api_key.assert_called_once_with("key")
    stubs.collector.set_user_id.assert_called_once_with("uid-test")


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
