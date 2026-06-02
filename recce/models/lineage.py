"""Server-side lineage merge for the /api/info wire format (DRC-3258)."""

from __future__ import annotations

from typing import Any

from recce.models.types import (
    LineageDiff,
    MergedEdge,
    MergedLineage,
    MergedNode,
    MergedUnitTest,
    UnitTestSummary,
)


def _merge_unit_tests(
    base_specs: list[dict], curr_specs: list[dict]
) -> tuple[list[MergedUnitTest], UnitTestSummary | None]:
    """Merge a model's base + current unit-test specs into wire-format tests.

    diff_status is derived per test name: added/removed by presence, changed when
    the manifest checksum differs, else unchanged. The passing summary covers only
    the current env's tests (removed tests no longer run).
    """
    base_by_name = {s["name"]: s for s in base_specs}
    curr_by_name = {s["name"]: s for s in curr_specs}

    tests: list[MergedUnitTest] = []
    for name in sorted(set(base_by_name) | set(curr_by_name)):
        base_spec = base_by_name.get(name)
        curr_spec = curr_by_name.get(name)
        if curr_spec and not base_spec:
            diff_status = "added"
        elif base_spec and not curr_spec:
            diff_status = "removed"
        elif base_spec and curr_spec and base_spec.get("checksum") != curr_spec.get("checksum"):
            diff_status = "changed"
        else:
            diff_status = "unchanged"
        spec = curr_spec or base_spec
        tests.append(
            MergedUnitTest(
                name=name,
                unique_id=spec["unique_id"],
                status=(curr_spec or {}).get("status"),
                diff_status=diff_status,
            )
        )

    total = len(curr_specs)
    summary = None
    if total:
        passed = sum(1 for s in curr_specs if s.get("status") == "pass")
        summary = UnitTestSummary(total=total, passed=passed, pct=round(100 * passed / total))
    return tests, summary


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

        node_diff = diff.get(node_id)
        if node_diff:
            merged.change_status = node_diff.change_status
            merged.change = node_diff.change

        # DRC-3087: merge unit tests from base + current into the node.
        base_specs = (base_node or {}).get("unit_test_specs") or []
        curr_specs = (current_node or {}).get("unit_test_specs") or []
        if base_specs or curr_specs:
            unit_tests, summary = _merge_unit_tests(base_specs, curr_specs)
            merged.unit_tests = unit_tests
            merged.unit_test_summary = summary

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

    return MergedLineage(nodes=nodes, edges=edges, metadata=metadata)
