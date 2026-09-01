"""Server-side lineage merge for the /api/info wire format (DRC-3258)."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from pydantic import ValidationError

from recce.artifact_health import (
    classify_node_schema_comparison,
    classify_schema_coverage,
    schema_coverage_payload,
)
from recce.models.types import (
    ArtifactHealthPayload,
    LineageDiff,
    MergedEdge,
    MergedLineage,
    MergedNode,
)

_CATALOG_STATUSES = frozenset({"covered", "unchecked", "not_applicable"})


def _catalog_status(node: Mapping[str, Any] | None) -> str | None:
    if not isinstance(node, Mapping):
        return None
    status = node.get("catalog_status")
    return status if status in _CATALOG_STATUSES else None


_UNREADABLE_SIDE_HEALTH = {
    "status": "unknown",
    "expected_count": 0,
    "covered_count": 0,
    "catalog_entry_count": 0,
    "missing_node_count": 0,
    "missing_nodes": [],
    "missing_more": False,
    "orphan_node_count": 0,
    "orphan_nodes": [],
    "orphan_more": False,
}


def _readable_side_health(raw: Any) -> dict | None:
    """Degrade one side's health to "unknown" rather than failing the response.

    A producer on a different version can emit a status literal or field shape
    this build cannot parse. Raising here would take the whole merged-lineage
    response down — hiding every verified node along with the badge — which is
    strictly worse than reporting that side's health as unknown.
    """
    if raw is None:
        return None
    try:
        return ArtifactHealthPayload.model_validate(raw).model_dump()
    except ValidationError:
        return dict(_UNREADABLE_SIDE_HEALTH)


def build_merged_lineage(lineage_diff: LineageDiff) -> MergedLineage:
    """Convert internal LineageDiff to wire-format MergedLineage.

    Merges base + current nodes into a single set, computes edges
    from dual parent_maps, and bakes diff into nodes.
    """
    base = lineage_diff.base
    current = lineage_diff.current
    diff = lineage_diff.diff
    base_nodes = base.get("nodes")
    current_nodes = current.get("nodes")
    base_node_map = base_nodes if isinstance(base_nodes, Mapping) else {}
    current_node_map = current_nodes if isinstance(current_nodes, Mapping) else {}

    # 1. Merge nodes — prefer current metadata, fall back to base for removed
    nodes: dict[str, MergedNode] = {}
    all_ids = set(base_node_map) | set(current_node_map)
    for node_id in sorted(all_ids):
        base_node = base_node_map.get(node_id)
        current_node = current_node_map.get(node_id)

        source = current_node if current_node is not None else base_node
        merged = MergedNode(**source)  # extra="ignore" handles unknown keys

        # dbt stores materialized inside config; extract it since MergedNode
        # ignores nested dicts via extra="ignore".
        if merged.materialized is None:
            config = source.get("config")
            if isinstance(config, dict):
                mat = config.get("materialized")
                if isinstance(mat, str):
                    merged.materialized = mat

        # `schema` describes the preferred source — current whenever the node
        # exists there — so a base env living in a different schema would be
        # invisible to the client (DRC-3975). Carry it separately, but only when
        # it actually differs: lineage payloads run to thousands of nodes and in
        # most setups both envs share a schema, where `schema` already says it.
        if base_node is not None and current_node is not None:
            base_schema = base_node.get("schema")
            if isinstance(base_schema, str) and base_schema != merged.schema_name:
                merged.base_schema = base_schema

        node_diff = diff.get(node_id)
        if node_diff:
            merged.change_status = node_diff.change_status
            merged.change = node_diff.change

        merged.base_catalog_status = _catalog_status(base_node)
        merged.current_catalog_status = _catalog_status(current_node)
        merged.schema_comparison_status = classify_node_schema_comparison(
            base_node_map,
            current_node_map,
            node_id,
        )

        nodes[node_id] = merged

    # 2. Compute edges from dual parent_maps
    base_edges: set[tuple[str, str]] = set()
    for child, parents in base.get("parent_map", {}).items():
        for parent in parents:
            if parent in nodes and child in nodes:
                base_edges.add((parent, child))

    current_edges: set[tuple[str, str]] = set()
    for child, parents in current.get("parent_map", {}).items():
        for parent in parents:
            if parent in nodes and child in nodes:
                current_edges.add((parent, child))

    # 3. Edge change_status
    edges: list[MergedEdge] = []
    for source_id, target_id in base_edges | current_edges:
        in_base = (source_id, target_id) in base_edges
        in_current = (source_id, target_id) in current_edges

        change_status = None
        if in_current and not in_base:
            change_status = "added"
        elif in_base and not in_current:
            change_status = "removed"

        edges.append(MergedEdge(source=source_id, target=target_id, change_status=change_status))

    # Sort edges for deterministic output (set iteration order is nondeterministic)
    edges.sort(key=lambda e: (e.source, e.target))

    # 4. Metadata
    metadata: dict[str, Any] = {
        "base": {
            "manifest_metadata": base.get("manifest_metadata") or {},
            "catalog_metadata": base.get("catalog_metadata") or {},
        },
        "current": {
            "manifest_metadata": current.get("manifest_metadata") or {},
            "catalog_metadata": current.get("catalog_metadata") or {},
        },
    }

    base_artifact_health = _readable_side_health(base.get("artifact_health"))
    current_artifact_health = _readable_side_health(current.get("artifact_health"))
    artifact_health = None
    if base_artifact_health is not None or current_artifact_health is not None:
        artifact_health = {
            "base": base_artifact_health,
            "current": current_artifact_health,
        }

    schema_coverage = schema_coverage_payload(classify_schema_coverage(base_nodes, current_nodes, all_ids))

    return MergedLineage(
        nodes=nodes,
        edges=edges,
        metadata=metadata,
        artifact_health=artifact_health,
        schema_coverage=schema_coverage,
    )
