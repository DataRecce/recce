"""Tests for `recce server` --mcp/--no-mcp flag and RECCE_DISABLE_MCP env var."""

from click.testing import CliRunner


def test_resolve_mcp_enabled_default_when_no_flag_no_env(monkeypatch):
    from recce.cli import _resolve_mcp_enabled

    monkeypatch.delenv("RECCE_DISABLE_MCP", raising=False)
    assert _resolve_mcp_enabled(None) is True


def test_resolve_mcp_enabled_no_mcp_flag_disables():
    from recce.cli import _resolve_mcp_enabled

    assert _resolve_mcp_enabled(False) is False


def test_resolve_mcp_enabled_env_var_disables(monkeypatch):
    from recce.cli import _resolve_mcp_enabled

    monkeypatch.setenv("RECCE_DISABLE_MCP", "1")
    assert _resolve_mcp_enabled(None) is False


def test_resolve_mcp_enabled_env_var_truthy_variants(monkeypatch):
    from recce.cli import _resolve_mcp_enabled

    for val in ("1", "true", "TRUE", "yes", "YES"):
        monkeypatch.setenv("RECCE_DISABLE_MCP", val)
        assert _resolve_mcp_enabled(None) is False, f"Expected disable for {val!r}"


def test_resolve_mcp_enabled_explicit_flag_overrides_env(monkeypatch):
    from recce.cli import _resolve_mcp_enabled

    monkeypatch.setenv("RECCE_DISABLE_MCP", "1")
    assert _resolve_mcp_enabled(True) is True


def test_server_command_accepts_no_mcp_flag():
    """--no-mcp parses without error (verified via --help short-circuit)."""
    from recce.cli import cli

    runner = CliRunner()
    result = runner.invoke(cli, ["server", "--help"])
    assert result.exit_code == 0
    assert "--mcp" in result.output
    assert "--no-mcp" in result.output
    assert "RECCE_DISABLE_MCP" in result.output
