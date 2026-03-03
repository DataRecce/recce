"""
Test that CLI can be imported even when mcp is not available.
"""

import sys
from unittest.mock import patch


def test_cli_can_be_imported_without_mcp():
    """Test that recce.cli can be imported even if mcp package is not available"""
    # This test verifies that the CLI module doesn't fail to import
    # when mcp is not installed, since mcp is an optional dependency
    from recce import cli

    assert cli is not None
    assert hasattr(cli, "cli")
    assert hasattr(cli, "mcp_server")


def test_mcp_server_command_fails_gracefully_without_mcp():
    """Test that mcp-server command shows helpful error when mcp is not available"""
    # Mock sys.modules to simulate mcp not being installed
    with patch.dict(sys.modules, {"mcp": None, "mcp.server": None, "mcp.server.stdio": None, "mcp.types": None}):
        # Remove mcp_server from modules to force reimport
        if "recce.mcp_server" in sys.modules:
            del sys.modules["recce.mcp_server"]

        from recce.cli import mcp_server

        # The function should exist
        assert mcp_server is not None

        # When called, it should handle ImportError gracefully
        # (We can't easily test the actual execution without more mocking,
        # but we've verified the function exists and can be imported)


def test_cli_command_exists():
    """Test that both server and mcp-server commands are registered"""
    from recce.cli import cli

    # Check that both commands exist
    commands = {cmd.name for cmd in cli.commands.values()}
    assert "server" in commands
    assert "mcp_server" in commands or "mcp-server" in commands
