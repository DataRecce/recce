"""Emit info.json and lineage_diff.json artifacts for cloud-mode `recce init`.

These JSON files are uploaded to S3 (`metadata/` prefix) alongside the manifest
and catalog, and serve Cloud's `/info` and `/select` endpoints without requiring
the Cloud API to re-compute lineage from raw dbt artifacts on every request.

Both files are derived purely from the adapter's already-loaded manifests and
catalogs — no SQL execution, no I/O beyond the two JSON writes. Reuses
`build_merged_lineage` (same helper the OSS `/api/info` endpoint uses) and the
adapter's `get_lineage_diff()` so the shapes stay in sync with the live-instance
responses.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from recce.adapter.base import BaseAdapter
from recce.models.lineage import build_merged_lineage
from recce.models.types import LineageDiff

logger = logging.getLogger("recce")


def _resolve_adapter_type(adapter: BaseAdapter) -> str | None:
    """Best-effort resolve the warehouse adapter type string (e.g. "duckdb")."""
    # DbtAdapter stores adapter_type on manifest.metadata; fall back to the
    # wrapped dbt adapter's .type() method.
    manifest = getattr(adapter, "curr_manifest", None) or getattr(adapter, "base_manifest", None)
    metadata = getattr(manifest, "metadata", None) if manifest is not None else None
    adapter_type = getattr(metadata, "adapter_type", None)
    if adapter_type:
        return adapter_type
    inner = getattr(adapter, "adapter", None)
    type_fn = getattr(inner, "type", None)
    if callable(type_fn):
        try:
            return type_fn()
        except Exception:
            return None
    return None


def _build_info_payload(adapter: BaseAdapter, lineage_diff: LineageDiff) -> dict[str, Any]:
    """Build the artifact-sourced portion of the `/info` response.

    Cloud-specific fields (org_id, project_id, has_warehouse_connection,
    cloud_mode, review_mode, support_tasks, pull_request) are injected by the
    Cloud API at request time — this function emits only what the CLI can
    derive from the manifest + catalog.
    """
    merged_lineage = build_merged_lineage(lineage_diff)
    return {
        "adapter_type": _resolve_adapter_type(adapter),
        "lineage": merged_lineage.model_dump(exclude_none=True, by_alias=True),
    }


def emit_info_and_lineage_diff(
    adapter: BaseAdapter,
    info_path: Path,
    lineage_diff_path: Path,
) -> None:
    """Write `info.json` and `lineage_diff.json` derived from the adapter.

    Args:
        adapter: Loaded BaseAdapter (typically DbtAdapter) with both envs.
        info_path: Destination path for info.json.
        lineage_diff_path: Destination path for lineage_diff.json.

    Raises:
        Any exception from the underlying lineage computation or JSON write.
        The caller is expected to log+continue (graceful degradation) — the
        cloud-mode upload block in `recce/cli.py` does exactly this.
    """
    lineage_diff = adapter.get_lineage_diff()
    lineage_diff_payload = lineage_diff.model_dump(mode="json")
    info_payload = _build_info_payload(adapter, lineage_diff)

    _write_json_atomic(info_path, info_payload)
    _write_json_atomic(lineage_diff_path, lineage_diff_payload)


def _write_json_atomic(path: Path, payload: Any) -> None:
    """Write JSON to ``path`` atomically via a sibling .tmp file.

    Uses compact separators (no compression — per DRC-3296 scope decision).
    """
    data = json.dumps(payload, separators=(",", ":"), default=str).encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + ".tmp")
    try:
        tmp_path.write_bytes(data)
        tmp_path.replace(path)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise
