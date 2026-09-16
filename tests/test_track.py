"""Tests for recce/track.py: the props TrackCommand puts in the `command` event."""

from importlib.metadata import PackageNotFoundError
from unittest.mock import patch

import click
import pytest
from click.testing import CliRunner

from recce.track import TrackCommand, _installed_dbt_version


def _fake_version(installed):
    def lookup(dist):
        if dist in installed:
            return installed[dist]
        raise PackageNotFoundError(dist)

    return lookup


class TestInstalledDbtVersion:
    def test_reports_dbt_core_for_dbt_1x(self):
        with patch("importlib.metadata.version", _fake_version({"dbt-core": "1.12.4"})):
            assert _installed_dbt_version() == "1.12.4"

    def test_reports_dbt_distribution_for_dbt_v2(self):
        with patch("importlib.metadata.version", _fake_version({"dbt": "2.0.2"})):
            assert _installed_dbt_version() == "2.0.2"

    def test_prefers_dbt_core_when_both_present(self):
        installed = {"dbt-core": "1.12.4", "dbt": "2.0.2"}
        with patch("importlib.metadata.version", _fake_version(installed)):
            assert _installed_dbt_version() == "1.12.4"

    def test_returns_none_when_no_dbt(self):
        with patch("importlib.metadata.version", _fake_version({})):
            assert _installed_dbt_version() is None


@pytest.fixture
def command_event():
    """Invoke a TrackCommand and return the props of the `command` event."""
    with (
        patch("recce.event.init"),
        patch("recce.event.flush_events"),
        patch("recce.event.flush_exceptions"),
        patch("recce.event.capture_exception"),
        patch("recce.event.set_exception_tag"),
        patch("recce.event.log_codespaces_events"),
        patch("recce.event.log_event") as mock_log,
    ):

        def invoke(body):
            @click.command(cls=TrackCommand)
            def cmd():
                body()

            CliRunner().invoke(cmd, [])
            props, event_type = mock_log.call_args[0]
            assert event_type == "command"
            return props

        yield invoke


class TestCommandEventProp:
    def test_prop_sent_on_success(self, command_event):
        with patch("importlib.metadata.version", _fake_version({"dbt-core": "1.12.4"})):
            props = command_event(lambda: None)
        assert props["dbt_version"] == "1.12.4"

    def test_prop_sent_when_dbt_import_fails(self, command_event):
        """The dbt v2 case: the command fails on the missing dbt 1.x import, and
        the version still has to reach the event."""

        def body():
            raise ModuleNotFoundError("No module named 'agate'")

        with patch("importlib.metadata.version", _fake_version({"dbt": "2.0.2"})):
            props = command_event(body)
        assert props["dbt_version"] == "2.0.2"
        assert props["status"] is False
