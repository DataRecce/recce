"""Server-side lineage merge for the /api/info wire format (DRC-3258)."""

from __future__ import annotations

from typing import Any

from recce.models.types import (
    LineageDiff,
    MergedEdge,
    MergedLineage,
    MergedNode,
)


def build_merged_lineage(lineage_diff: LineageDiff) -> MergedLineage:
    """Convert internal LineageDiff to wire-format MergedLineage.

    Merges base + current nodes into a single set, computes edges
    from dual parent_maps, and bakes diff into nodes.
    """
    base = lineage_diff.base
    current = lineage_diff.current
    diff = lineage_diff.diff

    # 1. Merge nodes — prefer current metadata, fall back to base for removed
    nodes: dict[str, MergedNode] = {}
    all_ids = set(base.get("nodes", {})) | set(current.get("nodes", {}))
    for node_id in sorted(all_ids):
        base_node = base.get("nodes", {}).get(node_id)
        current_node = current.get("nodes", {}).get(node_id)

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

        if base_node is None or current_node is None:
            merged.schema_comparison_status = "not_applicable"
        else:
            base_catalog_status = base_node.get("catalog_status")
            current_catalog_status = current_node.get("catalog_status")
            if base_catalog_status == current_catalog_status == "not_applicable":
                merged.schema_comparison_status = "not_applicable"
            elif base_catalog_status == current_catalog_status == "covered":
                merged.schema_comparison_status = "complete"
            else:
                # Missing markers from old producers are deliberately unchecked:
                # absent evidence must never be upgraded to a complete comparison.
                merged.schema_comparison_status = "unchecked"

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

    base_artifact_health = base.get("artifact_health")
    current_artifact_health = current.get("artifact_health")
    artifact_health = None
    if base_artifact_health is not None or current_artifact_health is not None:
        artifact_health = {
            "base": base_artifact_health,
            "current": current_artifact_health,
        }

    return MergedLineage(nodes=nodes, edges=edges, metadata=metadata, artifact_health=artifact_health)
