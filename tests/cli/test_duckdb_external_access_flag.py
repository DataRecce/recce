"""Tests for --duckdb-external-access CLI flag wiring.

The flag is intentionally server-only: `recce server` is the only HTTP-exposed
surface where unauth callers can submit SQL. Local CLI commands (`recce run`,
`recce query`, `recce diff`) preserve the pre-DRC-3578 permissive behavior so
existing check files with read_csv/COPY workflows do not break.
"""

from click.testing import CliRunner

from recce.cli import cli


def test_flag_present_in_server_help():
    """`recce server --help` must surface the flag."""
    runner = CliRunner()
    result = runner.invoke(cli, ["server", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" in result.output


def test_flag_absent_from_run_help():
    """`recce run` is not HTTP-exposed; the opt-out flag is server-only."""
    runner = CliRunner()
    result = runner.invoke(cli, ["run", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" not in result.output
