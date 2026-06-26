"""Tests for `recce mcp-config-install` CLI subcommand.

Covers:
- Writes both recce and recce-widgets MCP entries with RECCE_MCP_WIDGETS=1
- Preserves existing MCP server entries (other servers untouched)
- Validates --project-dir (must contain dbt_project.yml)
- Dry-run mode does not write to disk
- Backup file is created before writing
- Backup preserves the pristine pre-recce original on re-run (not clobbered)
- Falls back to `python -m recce.cli` when the `recce` binary is not on PATH
"""

import json
import shutil
import sys
from pathlib import Path

from click.testing import CliRunner

from recce.cli import mcp_config_install

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_dbt_project(tmp_path: Path) -> Path:
    """Create a minimal dbt project directory with dbt_project.yml."""
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / "dbt_project.yml").write_text("name: my_project\nversion: '1.0.0'\n")
    return tmp_path


def _make_config(config_path: Path, extra_servers=None):
    """Write a minimal claude_desktop_config.json to config_path."""
    servers = extra_servers or {}
    config_path.write_text(json.dumps({"mcpServers": servers}, indent=2))


# ---------------------------------------------------------------------------
# Test 1: writes two entries with RECCE_MCP_WIDGETS=1
# ---------------------------------------------------------------------------


def test_install_writes_two_entries(tmp_path, monkeypatch):
    """mcp-config-install writes recce and recce-widgets with RECCE_MCP_WIDGETS=1."""
    monkeypatch.setattr(sys, "platform", "darwin")

    project_dir = _make_dbt_project(tmp_path / "my_project")
    config_file = tmp_path / "claude_desktop_config.json"
    _make_config(config_file)

    runner = CliRunner()
    result = runner.invoke(
        mcp_config_install,
        [
            "--project-dir",
            str(project_dir),
            "--config",
            str(config_file),
            "--yes",
        ],
    )

    assert result.exit_code == 0, f"Unexpected exit: {result.output}\n{result.exception}"

    written = json.loads(config_file.read_text())
    servers = written["mcpServers"]

    assert "recce" in servers, "recce entry missing"
    assert "recce-widgets" in servers, "recce-widgets entry missing"

    assert servers["recce"]["env"].get("RECCE_MCP_WIDGETS") == "1"
    assert servers["recce-widgets"]["env"].get("RECCE_MCP_WIDGETS") == "1"

    # args must include the subcommand and --project-dir
    assert "mcp-server" in servers["recce"]["args"]
    assert "--project-dir" in servers["recce"]["args"]
    assert "mcp-widget-server" in servers["recce-widgets"]["args"]
    assert "--project-dir" in servers["recce-widgets"]["args"]


# ---------------------------------------------------------------------------
# Test 2: preserves existing entries
# ---------------------------------------------------------------------------


def test_install_preserves_existing_entries(tmp_path, monkeypatch):
    """mcp-config-install preserves third-party MCP server entries."""
    monkeypatch.setattr(sys, "platform", "darwin")

    project_dir = _make_dbt_project(tmp_path / "my_project")
    config_file = tmp_path / "claude_desktop_config.json"
    _make_config(
        config_file,
        extra_servers={
            "other-server": {
                "command": "/usr/local/bin/other",
                "args": ["start"],
                "env": {},
            }
        },
    )

    runner = CliRunner()
    result = runner.invoke(
        mcp_config_install,
        [
            "--project-dir",
            str(project_dir),
            "--config",
            str(config_file),
            "--yes",
        ],
    )

    assert result.exit_code == 0, f"Unexpected exit: {result.output}\n{result.exception}"

    written = json.loads(config_file.read_text())
    servers = written["mcpServers"]

    # Recce entries written
    assert "recce" in servers
    assert "recce-widgets" in servers

    # Third-party entry preserved unchanged
    assert "other-server" in servers
    assert servers["other-server"]["command"] == "/usr/local/bin/other"


# ---------------------------------------------------------------------------
# Test 3: validates project dir (missing dbt_project.yml)
# ---------------------------------------------------------------------------


def test_install_validates_project_dir(tmp_path, monkeypatch):
    """mcp-config-install errors out when project-dir lacks dbt_project.yml."""
    monkeypatch.setattr(sys, "platform", "darwin")

    empty_dir = tmp_path / "not_a_dbt_project"
    empty_dir.mkdir()
    config_file = tmp_path / "claude_desktop_config.json"
    _make_config(config_file)

    runner = CliRunner()
    result = runner.invoke(
        mcp_config_install,
        [
            "--project-dir",
            str(empty_dir),
            "--config",
            str(config_file),
            "--yes",
        ],
    )

    assert result.exit_code != 0, "Expected non-zero exit for missing dbt_project.yml"
    assert "dbt_project.yml" in (result.output or ""), f"Expected dbt_project.yml mention in output: {result.output}"


# ---------------------------------------------------------------------------
# Test 4: dry-run does not write
# ---------------------------------------------------------------------------


def test_install_dry_run_does_not_write(tmp_path, monkeypatch):
    """mcp-config-install --dry-run prints diff but does not modify the config file."""
    monkeypatch.setattr(sys, "platform", "darwin")

    project_dir = _make_dbt_project(tmp_path / "my_project")
    config_file = tmp_path / "claude_desktop_config.json"
    original_content = json.dumps({"mcpServers": {}}, indent=2)
    config_file.write_text(original_content)

    runner = CliRunner()
    result = runner.invoke(
        mcp_config_install,
        [
            "--project-dir",
            str(project_dir),
            "--config",
            str(config_file),
            "--dry-run",
        ],
    )

    assert result.exit_code == 0, f"Unexpected exit: {result.output}\n{result.exception}"

    # Config file must be unchanged
    assert config_file.read_text() == original_content, "Config file was modified during --dry-run"

    # Backup must NOT be created
    backup_path = config_file.with_suffix(config_file.suffix + ".recce.bak")
    assert not backup_path.exists(), "Backup file should not be created during --dry-run"


# ---------------------------------------------------------------------------
# Test 5: backup is created before writing
# ---------------------------------------------------------------------------


def test_install_backup_created(tmp_path, monkeypatch):
    """mcp-config-install creates a .recce.bak backup of the config before writing."""
    monkeypatch.setattr(sys, "platform", "darwin")

    project_dir = _make_dbt_project(tmp_path / "my_project")
    config_file = tmp_path / "claude_desktop_config.json"
    original_content = json.dumps({"mcpServers": {}}, indent=2)
    config_file.write_text(original_content)

    runner = CliRunner()
    result = runner.invoke(
        mcp_config_install,
        [
            "--project-dir",
            str(project_dir),
            "--config",
            str(config_file),
            "--yes",
        ],
    )

    assert result.exit_code == 0, f"Unexpected exit: {result.output}\n{result.exception}"

    backup_path = config_file.with_suffix(config_file.suffix + ".recce.bak")
    assert backup_path.exists(), "Backup file (.recce.bak) not created"

    # Backup content matches original (pre-write snapshot)
    backup_content = json.loads(backup_path.read_text())
    assert backup_content == {"mcpServers": {}}, "Backup content does not match original config"


def test_install_backup_preserves_pristine_original_on_rerun(tmp_path, monkeypatch):
    """Re-running install must NOT clobber the .recce.bak with the already-modified
    config. The backup must keep the pristine pre-recce original so 'undo' is reliable."""
    monkeypatch.setattr(sys, "platform", "darwin")

    project_dir = _make_dbt_project(tmp_path / "my_project")
    config_file = tmp_path / "claude_desktop_config.json"
    # Pristine original: a user's third-party server, no recce entries.
    pristine = {"mcpServers": {"other-server": {"command": "/usr/local/bin/other", "args": ["start"], "env": {}}}}
    config_file.write_text(json.dumps(pristine, indent=2))

    runner = CliRunner()
    args = ["--project-dir", str(project_dir), "--config", str(config_file), "--yes"]

    r1 = runner.invoke(mcp_config_install, args)
    assert r1.exit_code == 0, f"first run failed: {r1.output}\n{r1.exception}"

    # Second run: config_file already carries recce entries now.
    r2 = runner.invoke(mcp_config_install, args)
    assert r2.exit_code == 0, f"second run failed: {r2.output}\n{r2.exception}"

    backup_path = config_file.with_suffix(config_file.suffix + ".recce.bak")
    backup_content = json.loads(backup_path.read_text())
    assert backup_content == pristine, "Backup was clobbered with the modified config; pristine original lost"
    assert "recce" not in backup_content["mcpServers"], "Backup must not contain recce entries"


def test_install_python_fallback_uses_cli_module(tmp_path, monkeypatch):
    """When no recce executable is on PATH, fallback command must be runnable."""
    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.setattr(shutil, "which", lambda _: None)

    project_dir = _make_dbt_project(tmp_path / "my_project")
    config_file = tmp_path / "claude_desktop_config.json"
    _make_config(config_file)

    runner = CliRunner()
    result = runner.invoke(
        mcp_config_install,
        [
            "--project-dir",
            str(project_dir),
            "--config",
            str(config_file),
            "--yes",
        ],
    )

    assert result.exit_code == 0, f"Unexpected exit: {result.output}\n{result.exception}"
    written = json.loads(config_file.read_text())
    servers = written["mcpServers"]
    assert servers["recce"]["command"] == sys.executable
    assert servers["recce"]["args"][:2] == ["-m", "recce.cli"]
    assert servers["recce-widgets"]["args"][:2] == ["-m", "recce.cli"]
