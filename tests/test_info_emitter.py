"""Unit tests for recce.util.info_emitter."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from recce.models.types import LineageDiff, NodeDiff
from recce.util.info_emitter import (
    _build_info_payload,
    _resolve_adapter_type,
    _write_json_atomic,
    emit_info_and_lineage_diff,
)


def _make_node(unique_id: str, **overrides):
    """Build a minimal lineage node dict compatible with build_merged_lineage."""
    node = {
        "id": unique_id,
        "name": unique_id.split(".")[-1],
        "resource_type": "model",
        "package_name": "demo",
        "schema": "main",
        "config": {"materialized": "table"},
    }
    node.update(overrides)
    return node


def _make_lineage_diff(
    base_node_ids: list[str] | None = None,
    curr_node_ids: list[str] | None = None,
    diff: dict[str, NodeDiff] | None = None,
    base_parent_map: dict[str, list[str]] | None = None,
    curr_parent_map: dict[str, list[str]] | None = None,
) -> LineageDiff:
    base_node_ids = base_node_ids or []
    curr_node_ids = curr_node_ids or []
    return LineageDiff(
        base={
            "nodes": {nid: _make_node(nid) for nid in base_node_ids},
            "parent_map": base_parent_map or {},
            "manifest_metadata": {"adapter_type": "duckdb"},
            "catalog_metadata": {},
        },
        current={
            "nodes": {nid: _make_node(nid) for nid in curr_node_ids},
            "parent_map": curr_parent_map or {},
            "manifest_metadata": {"adapter_type": "duckdb"},
            "catalog_metadata": {},
        },
        diff=diff or {},
    )


def _make_adapter(lineage_diff: LineageDiff, adapter_type: str | None = "duckdb"):
    """Mock a BaseAdapter with get_lineage_diff and manifest.metadata.adapter_type."""
    adapter = MagicMock()
    adapter.get_lineage_diff.return_value = lineage_diff
    manifest = MagicMock()
    manifest.metadata.adapter_type = adapter_type
    adapter.curr_manifest = manifest
    adapter.base_manifest = manifest
    return adapter


class TestResolveAdapterType:
    def test_prefers_manifest_metadata(self):
        adapter = _make_adapter(_make_lineage_diff(), adapter_type="snowflake")
        assert _resolve_adapter_type(adapter) == "snowflake"

    def test_falls_back_to_inner_adapter_type_fn(self):
        adapter = MagicMock()
        adapter.curr_manifest = None
        adapter.base_manifest = None
        adapter.adapter.type.return_value = "bigquery"
        assert _resolve_adapter_type(adapter) == "bigquery"

    def test_returns_none_when_unresolvable(self):
        adapter = MagicMock()
        adapter.curr_manifest = None
        adapter.base_manifest = None
        adapter.adapter = None
        assert _resolve_adapter_type(adapter) is None


class TestBuildInfoPayload:
    def test_shape_matches_cloud_info_contract(self):
        diff = _make_lineage_diff(
            base_node_ids=["model.demo.a"],
            curr_node_ids=["model.demo.a", "model.demo.b"],
            diff={"model.demo.b": NodeDiff(change_status="added")},
        )
        adapter = _make_adapter(diff, adapter_type="duckdb")
        payload = _build_info_payload(adapter, diff)

        assert payload["adapter_type"] == "duckdb"
        assert set(payload["lineage"].keys()) == {"nodes", "edges", "metadata"}
        # Both nodes present in merged output
        assert set(payload["lineage"]["nodes"].keys()) == {"model.demo.a", "model.demo.b"}
        # change_status baked into node
        assert payload["lineage"]["nodes"]["model.demo.b"]["change_status"] == "added"
        # unchanged nodes omit change_status (exclude_none)
        assert "change_status" not in payload["lineage"]["nodes"]["model.demo.a"]


class TestWriteJsonAtomic:
    def test_writes_compact_json(self, tmp_path: Path):
        target = tmp_path / "out.json"
        _write_json_atomic(target, {"a": 1, "b": [1, 2]})
        text = target.read_text()
        # separators=(",", ":") → no whitespace between tokens
        assert "," in text and ", " not in text
        assert json.loads(text) == {"a": 1, "b": [1, 2]}

    def test_cleans_up_tmp_on_failure(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        target = tmp_path / "out.json"

        def _boom(self, *args, **kwargs):
            raise OSError("disk full")

        monkeypatch.setattr(Path, "replace", _boom)
        with pytest.raises(OSError):
            _write_json_atomic(target, {"a": 1})
        # No stray .tmp file left behind
        leftover = list(tmp_path.glob("*.tmp"))
        assert leftover == []


class TestEmitInfoAndLineageDiff:
    def test_writes_both_files(self, tmp_path: Path):
        diff = _make_lineage_diff(
            base_node_ids=["model.demo.a"],
            curr_node_ids=["model.demo.a", "model.demo.b"],
            diff={"model.demo.b": NodeDiff(change_status="added")},
            curr_parent_map={"model.demo.b": ["model.demo.a"]},
        )
        adapter = _make_adapter(diff)

        info_path = tmp_path / "info.json"
        lineage_diff_path = tmp_path / "lineage_diff.json"
        emit_info_and_lineage_diff(adapter, info_path, lineage_diff_path)

        assert info_path.is_file()
        assert lineage_diff_path.is_file()

        info = json.loads(info_path.read_text())
        assert info["adapter_type"] == "duckdb"
        assert "nodes" in info["lineage"]
        # Edge derived from current parent_map
        edges = info["lineage"]["edges"]
        assert any(e["source"] == "model.demo.a" and e["target"] == "model.demo.b" for e in edges)

        ld = json.loads(lineage_diff_path.read_text())
        # Shape matches Cloud's LineageDiff model: base + current + diff
        assert set(ld.keys()) >= {"base", "current", "diff"}
        assert ld["diff"]["model.demo.b"]["change_status"] == "added"

    def test_creates_parent_dirs(self, tmp_path: Path):
        diff = _make_lineage_diff(curr_node_ids=["model.demo.a"])
        adapter = _make_adapter(diff)
        info_path = tmp_path / "nested" / "info.json"
        lineage_diff_path = tmp_path / "nested" / "lineage_diff.json"
        emit_info_and_lineage_diff(adapter, info_path, lineage_diff_path)
        assert info_path.is_file()
        assert lineage_diff_path.is_file()

    def test_lineage_diff_json_is_pydantic_compatible(self, tmp_path: Path):
        """The emitted lineage_diff.json must round-trip through LineageDiff.model_validate.

        This is the contract Cloud relies on when loading the pre-computed artifact.
        """
        diff = _make_lineage_diff(
            base_node_ids=["model.demo.a", "model.demo.removed"],
            curr_node_ids=["model.demo.a", "model.demo.b"],
            diff={
                "model.demo.b": NodeDiff(change_status="added"),
                "model.demo.removed": NodeDiff(change_status="removed"),
            },
        )
        adapter = _make_adapter(diff)
        info_path = tmp_path / "info.json"
        lineage_diff_path = tmp_path / "lineage_diff.json"
        emit_info_and_lineage_diff(adapter, info_path, lineage_diff_path)

        round_tripped = LineageDiff.model_validate(json.loads(lineage_diff_path.read_text()))
        assert set(round_tripped.diff.keys()) == {"model.demo.b", "model.demo.removed"}
        assert round_tripped.diff["model.demo.b"].change_status == "added"
        assert round_tripped.diff["model.demo.removed"].change_status == "removed"
