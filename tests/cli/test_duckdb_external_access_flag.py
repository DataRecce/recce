"""Tests for --duckdb-external-access CLI flag wiring.

The flag is exposed on the two HTTP-exposed surfaces where unauth callers can
submit SQL: `recce server` and `recce mcp-server`. Both default to blocked and
resolve the setting identically (flag OR `duckdb_external_access` in recce.yml).
`recce run` (the public CLI entry point) sets duckdb_external_access=True before
loading the adapter so existing check files with read_csv/COPY workflows do not
break. The hidden `recce query` and `recce diff` debug commands intentionally
follow the safe adapter default (external access disabled) and have no opt-out
flag.
"""

import importlib.util
from unittest.mock import AsyncMock, patch

import pytest
from click.testing import CliRunner

from recce.cli import cli
from recce.util import SingletonMeta

# mcp-server imports recce.mcp_server (the optional `mcp` extra) before it reaches
# the flag/config resolution, so the resolution tests only apply when mcp is installed.
requires_mcp = pytest.mark.skipif(
    importlib.util.find_spec("mcp") is None,
    reason="requires the optional 'mcp' extra",
)


def test_flag_present_in_server_help():
    """`recce server --help` must surface the flag."""
    runner = CliRunner()
    result = runner.invoke(cli, ["server", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" in result.output


def test_flag_present_in_mcp_server_help():
    """`recce mcp-server --help` must surface the flag (parity with server)."""
    runner = CliRunner()
    result = runner.invoke(cli, ["mcp-server", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" in result.output


def test_flag_absent_from_run_help():
    """`recce run` is not HTTP-exposed; the opt-out flag is not offered there."""
    runner = CliRunner()
    result = runner.invoke(cli, ["run", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" not in result.output


@pytest.fixture
def reset_recce_config():
    """RecceConfig is a SingletonMeta; reset so recce.yml written in one test
    does not leak into another."""
    SingletonMeta._instances = {}
    yield
    SingletonMeta._instances = {}


def _mcp_external_access_kwarg(runner, extra_args=None, recce_yml=None):
    """Invoke `recce mcp-server` with run_mcp_server mocked and return the
    resolved duckdb_external_access kwarg it received.

    Runs inside an isolated filesystem so RecceConfig reads only the recce.yml
    written here (if any) and no local target/ artifacts are picked up.
    """
    with runner.isolated_filesystem():
        if recce_yml is not None:
            with open("recce.yml", "w", encoding="utf-8") as f:
                f.write(recce_yml)

        with patch("recce.mcp_server.run_mcp_server", new_callable=AsyncMock) as mock_run:
            result = runner.invoke(cli, ["mcp-server", *(extra_args or [])])

    assert result.exit_code == 0, result.output
    assert mock_run.call_count == 1
    return mock_run.call_args.kwargs["duckdb_external_access"]


@requires_mcp
def test_mcp_server_default_blocked(reset_recce_config):
    """mcp-server without flag/config resolves to blocked (default)."""
    resolved = _mcp_external_access_kwarg(CliRunner())
    assert resolved is False


@requires_mcp
def test_mcp_server_flag_enables(reset_recce_config):
    """mcp-server with --duckdb-external-access resolves to enabled."""
    resolved = _mcp_external_access_kwarg(CliRunner(), extra_args=["--duckdb-external-access"])
    assert resolved is True


@requires_mcp
def test_mcp_server_recce_yml_enables(reset_recce_config):
    """mcp-server with duckdb_external_access: true in recce.yml (no flag) resolves to enabled."""
    resolved = _mcp_external_access_kwarg(CliRunner(), recce_yml="duckdb_external_access: true\n")
    assert resolved is True
