"""
Tests for check_base_freshness() helper and the `recce check-base` CLI (M2, AC-3).

Coverage:
  Helper (`check_base_freshness()`):
    - test_status_fresh          — mtime within threshold → fresh
    - test_status_stale_time     — mtime > 48 h → stale_time
    - test_status_stale_sha      — SHA mismatch → stale_sha
    - test_status_missing        — no manifest.json → missing
    - test_sha_absent_no_raise   — R9 best-effort: missing DBT_GIT_SHA field → fresh

  CLI (`recce check-base`):
    - test_cli_json_schema_fresh     — JSON shape includes the documented fields
    - test_cli_text_format_renders   — --format text prints status line
    - test_cli_exit_code_fresh       — fresh → exit 0
    - test_cli_exit_code_missing     — missing → exit 1
    - test_cli_exit_code_stale_time  — stale_time → exit 2
    - test_cli_project_dir_resolves  — --project-dir joins onto target-base-path

  Helper (`resolve_target_base_path`):
    - test_resolve_relative_joins_with_project_dir
    - test_resolve_absolute_bypasses_project_dir
    - test_resolve_no_project_dir_uses_cwd
    - test_resolve_mcp_startup_finds_artifacts_under_project_dir
"""

import json
import os
import time
from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from recce.cli import check_base, check_base_freshness, resolve_target_base_path


@pytest.fixture()
def fresh_manifest_dir(tmp_path):
    """Create a target-base/ directory with a freshly-written manifest.json."""
    target_base = tmp_path / "target-base"
    target_base.mkdir()
    manifest = {
        "metadata": {
            "generated_at": "2024-01-01T00:00:00.000000Z",
            "env": {
                "DBT_GIT_SHA": "abc1234def5678901234567890123456789012ab",
            },
        }
    }
    (target_base / "manifest.json").write_text(json.dumps(manifest))
    return target_base


@pytest.fixture()
def old_manifest_dir(tmp_path):
    """Create a target-base/ directory with a manifest.json whose mtime is 73 h ago."""
    target_base = tmp_path / "target-base"
    target_base.mkdir()
    manifest_path = target_base / "manifest.json"
    manifest_path.write_text(json.dumps({"metadata": {"env": {}}}))
    # Back-date mtime by 73 hours
    old_time = time.time() - (73 * 3600)
    os.utime(manifest_path, (old_time, old_time))
    return target_base


# ---------------------------------------------------------------------------
# Helper tests — exercise check_base_freshness() directly
# ---------------------------------------------------------------------------


def test_status_fresh(fresh_manifest_dir):
    """Manifest mtime within threshold and matching SHA → fresh."""
    manifest_sha = "abc1234def5678901234567890123456789012ab"
    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = check_base_freshness(
            target_base_path=str(fresh_manifest_dir),
            freshness_threshold_hours=48.0,
        )
    assert result["status"] == "fresh"
    assert result["recommendation"] == "reuse"
    assert result["artifact_age_hours"] is not None
    assert result["artifact_age_hours"] < 48.0


def test_status_stale_time(old_manifest_dir):
    """Manifest mtime > 48 h threshold → stale_time, message contains 'stale'."""
    result = check_base_freshness(
        target_base_path=str(old_manifest_dir),
        freshness_threshold_hours=48.0,
    )
    assert result["status"] == "stale_time"
    assert result["recommendation"] == "docs_generate"
    assert "stale" in result["message"].lower()
    assert result["artifact_age_hours"] > 48.0


def test_status_stale_sha(fresh_manifest_dir):
    """SHA in manifest differs from current HEAD → stale_sha, message contains 'stale'."""
    different_sha = "9999999deadbeef0000000000000000000000000"
    with patch("recce.git.current_commit_hash", return_value=different_sha):
        result = check_base_freshness(
            target_base_path=str(fresh_manifest_dir),
            freshness_threshold_hours=48.0,
        )
    assert result["status"] == "stale_sha"
    assert result["recommendation"] == "docs_generate"
    assert "stale" in result["message"].lower()


def test_status_missing(tmp_path):
    """No manifest.json in target_base_path → missing, recommendation full_build."""
    non_existent = tmp_path / "target-base-empty"
    result = check_base_freshness(
        target_base_path=str(non_existent),
        freshness_threshold_hours=48.0,
    )
    assert result["status"] == "missing"
    assert result["recommendation"] == "full_build"
    assert result["artifact_age_hours"] is None
    # Suggested command must reference the user-supplied target_base_path,
    # not the hardcoded default.
    assert str(non_existent) in result["message"]


def test_sha_absent_no_raise(tmp_path):
    """R9 best-effort: DBT_GIT_SHA field absent in manifest → fresh, no exception raised."""
    target_base = tmp_path / "target-base"
    target_base.mkdir()
    # Manifest has no DBT_GIT_SHA in metadata.env
    manifest_no_sha = {
        "metadata": {
            "generated_at": "2024-01-01T00:00:00.000000Z",
            "env": {},  # DBT_GIT_SHA is absent
        }
    }
    (target_base / "manifest.json").write_text(json.dumps(manifest_no_sha))

    # Should not raise, and should fall through to fresh (time check passes)
    result = check_base_freshness(
        target_base_path=str(target_base),
        freshness_threshold_hours=48.0,
    )
    # With no DBT_GIT_SHA, SHA check is skipped → fresh (time check passed)
    assert result["status"] == "fresh"
    assert result["base_sha"] is None


# ---------------------------------------------------------------------------
# CLI tests — exercise `recce check-base` end-to-end via Click's CliRunner
# ---------------------------------------------------------------------------


def test_cli_json_schema_fresh(fresh_manifest_dir):
    """--format json (default) emits all documented fields and lowercase status."""
    manifest_sha = "abc1234def5678901234567890123456789012ab"
    runner = CliRunner()
    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = runner.invoke(
            check_base,
            ["--target-base-path", str(fresh_manifest_dir)],
        )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    # Documented schema — every key must be present.
    expected_keys = {
        "status",
        "recommendation",
        "message",
        "artifact_age_hours",
        "base_sha",
        "current_sha",
        "threshold_hours",
    }
    assert expected_keys.issubset(payload.keys())
    assert payload["status"] == "fresh"
    assert payload["recommendation"] == "reuse"


def test_cli_text_format_renders(fresh_manifest_dir):
    """--format text emits a human-readable status line."""
    manifest_sha = "abc1234def5678901234567890123456789012ab"
    runner = CliRunner()
    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = runner.invoke(
            check_base,
            [
                "--target-base-path",
                str(fresh_manifest_dir),
                "--format",
                "text",
            ],
        )
    assert result.exit_code == 0, result.output
    assert "Status: fresh" in result.output
    assert "Recommendation: reuse" in result.output


def test_cli_exit_code_fresh(fresh_manifest_dir):
    """fresh → exit 0 (no SystemExit raised)."""
    manifest_sha = "abc1234def5678901234567890123456789012ab"
    runner = CliRunner()
    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = runner.invoke(
            check_base,
            ["--target-base-path", str(fresh_manifest_dir)],
        )
    assert result.exit_code == 0


def test_cli_exit_code_missing(tmp_path):
    """missing → exit 1 (rebuild required)."""
    non_existent = tmp_path / "target-base-empty"
    runner = CliRunner()
    result = runner.invoke(
        check_base,
        ["--target-base-path", str(non_existent)],
    )
    assert result.exit_code == 1
    payload = json.loads(result.output)
    assert payload["status"] == "missing"
    assert payload["recommendation"] == "full_build"


def test_cli_exit_code_stale_time(old_manifest_dir):
    """stale_time → exit 2 (regenerate when convenient)."""
    runner = CliRunner()
    result = runner.invoke(
        check_base,
        [
            "--target-base-path",
            str(old_manifest_dir),
            "--freshness-threshold-hours",
            "48",
        ],
    )
    assert result.exit_code == 2
    payload = json.loads(result.output)
    assert payload["status"] == "stale_time"
    assert payload["recommendation"] == "docs_generate"


def test_cli_project_dir_resolves(tmp_path):
    """--project-dir joins onto a relative --target-base-path before resolving."""
    project_dir = tmp_path / "my_dbt_project"
    project_dir.mkdir()
    target_base = project_dir / "target-base"
    target_base.mkdir()
    manifest = {
        "metadata": {
            "env": {
                "DBT_GIT_SHA": "abc1234def5678901234567890123456789012ab",
            },
        }
    }
    (target_base / "manifest.json").write_text(json.dumps(manifest))

    manifest_sha = "abc1234def5678901234567890123456789012ab"
    runner = CliRunner()
    # Invoke from tmp_path with --project-dir; relative target-base-path "target-base"
    # should resolve under project_dir.
    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = runner.invoke(
            check_base,
            [
                "--project-dir",
                str(project_dir),
                "--target-base-path",
                "target-base",
            ],
        )
    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["status"] == "fresh"


# ---------------------------------------------------------------------------
# resolve_target_base_path() — shared by CLI and MCP startup so the join logic
# cannot drift (round-2 review: MCP startup was missing the join after the CLI
# was fixed).
# ---------------------------------------------------------------------------


def test_resolve_relative_joins_with_project_dir():
    """A relative target-base-path is joined under project-dir."""
    resolved = resolve_target_base_path("/foo/bar", "target-base")
    assert Path(resolved) == Path("/foo/bar") / "target-base"


def test_resolve_absolute_bypasses_project_dir():
    """An absolute target-base-path bypasses the join entirely."""
    resolved = resolve_target_base_path("/foo/bar", "/tmp/abs/target-base")
    assert Path(resolved) == Path("/tmp/abs/target-base")


def test_resolve_no_project_dir_uses_cwd():
    """When project_dir is None, resolution is relative to CWD ('./')."""
    resolved = resolve_target_base_path(None, "target-base")
    # Don't compare against a CWD-dependent absolute path; just verify the
    # relative path semantics: joining ./ with target-base.
    assert Path(resolved) == Path("./") / "target-base"


def test_resolve_mcp_startup_finds_artifacts_under_project_dir(tmp_path):
    """Regression for the round-2 review finding: MCP startup must use the
    same resolution as the CLI so artifacts under --project-dir are found.

    Mirrors test_cli_project_dir_resolves: builds a fresh manifest at
    {project_dir}/target-base/manifest.json, then asserts that the resolution
    helper produces a path whose freshness check returns 'fresh'. Without the
    helper, MCP startup would look at ./target-base relative to CWD and miss
    the artifact entirely.
    """
    project_dir = tmp_path / "my_dbt_project"
    project_dir.mkdir()
    target_base = project_dir / "target-base"
    target_base.mkdir()
    manifest_sha = "abc1234def5678901234567890123456789012ab"
    manifest = {"metadata": {"env": {"DBT_GIT_SHA": manifest_sha}}}
    (target_base / "manifest.json").write_text(json.dumps(manifest))

    # The MCP startup-equivalent invocation: pass project_dir + relative
    # target_base_path to the shared helper, then run the freshness check.
    resolved = resolve_target_base_path(str(project_dir), "target-base")
    assert Path(resolved) == target_base

    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = check_base_freshness(target_base_path=resolved)

    assert result["status"] == "fresh", result
