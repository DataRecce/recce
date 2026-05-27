"""Tests for --disable-duckdb-external-access CLI flag wiring.

External access is allowed by default (opt-out). The disable flag is
intentionally server-only: `recce server` is the only HTTP-exposed surface
where unauth callers can submit SQL, so it is the only command that needs to
restrict external access. `recce run`, `recce query`, and `recce diff` keep
the permissive default and have no disable flag.
"""

from click.testing import CliRunner

from recce.cli import cli


def test_flag_present_in_server_help():
    """`recce server --help` must surface the disable flag."""
    runner = CliRunner()
    result = runner.invoke(cli, ["server", "--help"])
    assert result.exit_code == 0
    assert "--disable-duckdb-external-access" in result.output


def test_flag_absent_from_run_help():
    """`recce run` is permissive by default; the disable flag is server-only."""
    runner = CliRunner()
    result = runner.invoke(cli, ["run", "--help"])
    assert result.exit_code == 0
    assert "--disable-duckdb-external-access" not in result.output
