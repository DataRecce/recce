"""Tests for --duckdb-external-access CLI flag wiring."""

from click.testing import CliRunner

from recce.cli import cli


def test_flag_present_in_server_help():
    """`recce server --help` must surface the flag."""
    runner = CliRunner()
    result = runner.invoke(cli, ["server", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" in result.output


def test_flag_present_in_other_commands_using_recce_options():
    """The flag lives in recce_options, so it should appear on other commands too."""
    runner = CliRunner()
    result = runner.invoke(cli, ["run", "--help"])
    assert result.exit_code == 0
    assert "--duckdb-external-access" in result.output
