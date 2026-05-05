"""
Tests for check_base_freshness() helper (M2, AC-3).

Coverage:
  - test_status_fresh          — mtime within threshold → FRESH
  - test_status_stale_time     — mtime > 48 h → STALE_TIME
  - test_status_stale_sha      — SHA mismatch → STALE_SHA
  - test_status_missing        — no manifest.json → MISSING
  - test_sha_absent_no_raise   — R9 best-effort: missing DBT_GIT_SHA field → FRESH, no exception
"""

import json
import time
from unittest.mock import patch

import pytest

from recce.cli import check_base_freshness


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
    import os

    os.utime(manifest_path, (old_time, old_time))
    return target_base


def test_status_fresh(fresh_manifest_dir):
    """Manifest mtime within threshold and matching SHA → FRESH."""
    manifest_sha = "abc1234def5678901234567890123456789012ab"
    with patch("recce.git.current_commit_hash", return_value=manifest_sha):
        result = check_base_freshness(
            target_base_path=str(fresh_manifest_dir),
            freshness_threshold_hours=48.0,
        )
    assert result["status"] == "FRESH"
    assert result["recommendation"] == "reuse"
    assert result["artifact_age_hours"] is not None
    assert result["artifact_age_hours"] < 48.0


def test_status_stale_time(old_manifest_dir):
    """Manifest mtime > 48 h threshold → STALE_TIME, message contains 'stale'."""
    result = check_base_freshness(
        target_base_path=str(old_manifest_dir),
        freshness_threshold_hours=48.0,
    )
    assert result["status"] == "STALE_TIME"
    assert result["recommendation"] == "docs_generate"
    assert "stale" in result["message"].lower()
    assert result["artifact_age_hours"] > 48.0


def test_status_stale_sha(fresh_manifest_dir):
    """SHA in manifest differs from current HEAD → STALE_SHA, message contains 'stale'."""
    different_sha = "9999999deadbeef0000000000000000000000000"
    with patch("recce.git.current_commit_hash", return_value=different_sha):
        result = check_base_freshness(
            target_base_path=str(fresh_manifest_dir),
            freshness_threshold_hours=48.0,
        )
    assert result["status"] == "STALE_SHA"
    assert result["recommendation"] == "docs_generate"
    assert "stale" in result["message"].lower()


def test_status_missing(tmp_path):
    """No manifest.json in target_base_path → MISSING, recommendation full_build."""
    non_existent = tmp_path / "target-base-empty"
    result = check_base_freshness(
        target_base_path=str(non_existent),
        freshness_threshold_hours=48.0,
    )
    assert result["status"] == "MISSING"
    assert result["recommendation"] == "full_build"
    assert result["artifact_age_hours"] is None


def test_sha_absent_no_raise(tmp_path):
    """R9 best-effort: DBT_GIT_SHA field absent in manifest → FRESH, no exception raised."""
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

    # Should not raise, and should fall through to FRESH (time check passes)
    result = check_base_freshness(
        target_base_path=str(target_base),
        freshness_threshold_hours=48.0,
    )
    # With no DBT_GIT_SHA, SHA check is skipped → FRESH (time check passed)
    assert result["status"] == "FRESH"
    assert result["base_sha"] is None
