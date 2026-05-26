"""Tests for --unsafe-sql CLI flag wiring."""

from click.testing import CliRunner

from recce.cli import cli


def test_unsafe_sql_flag_present_in_server_help():
    """The --unsafe-sql flag must be visible in `recce server --help`."""
    runner = CliRunner()
    result = runner.invoke(cli, ["server", "--help"])
    assert result.exit_code == 0
    assert "--unsafe-sql" in result.output
    assert "DuckDB SQL sandbox" in result.output


def test_unsafe_sql_flag_present_in_other_commands_using_recce_options():
    """The flag is added to recce_options, so it should appear on other commands too.

    This is intentional — any command that loads a recce context should honor it.
    """
    runner = CliRunner()
    result = runner.invoke(cli, ["run", "--help"])
    assert result.exit_code == 0
    assert "--unsafe-sql" in result.output
