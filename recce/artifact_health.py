from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any, Literal

ArtifactHealthStatus = Literal["complete", "partial", "empty", "absent", "not_applicable", "unknown"]
SchemaCoverageStatus = Literal["complete", "partial", "unknown"]
SchemaComparisonStatus = Literal["complete", "unchecked", "not_applicable"]


@dataclass(frozen=True)
class ArtifactHealth:
    status: ArtifactHealthStatus
    expected_node_ids: frozenset[str]
    covered_node_ids: frozenset[str]
    catalog_node_ids: frozenset[str]
    missing_node_ids: frozenset[str]
    orphan_node_ids: frozenset[str]


@dataclass(frozen=True)
class SchemaCoverage:
    status: SchemaCoverageStatus
    checked_node_ids: frozenset[str]
    unchecked_node_ids: frozenset[str]
    #: Selected nodes present on exactly one manifest side. They carry no
    #: column-level comparison, but their one-sidedness is *verified* evidence
    #: of an added or removed relation — not an unchecked node. Consumers must
    #: report them as differences; dropping them turns a real removal into an
    #: affirmative "no schema changes".
    one_sided_node_ids: frozenset[str] = frozenset()

    @property
    def comparable_node_ids(self) -> frozenset[str]:
        """Every node this comparison can stand behind: column-checked pairs
        plus one-sided structural evidence."""
        return self.checked_node_ids | self.one_sided_node_ids


_ELIGIBLE_RESOURCE_TYPES = frozenset({"model", "seed", "snapshot"})
_EXCLUDED_MATERIALIZATIONS = frozenset({"ephemeral", "semantic_view"})
_NON_RELATION_RESOURCE_TYPES = frozenset({"exposure", "metric", "semantic_model", "saved_query"})


def _unknown_health(expected_node_ids: frozenset[str] = frozenset()) -> ArtifactHealth:
    return ArtifactHealth(
        status="unknown",
        expected_node_ids=expected_node_ids,
        covered_node_ids=frozenset(),
        catalog_node_ids=frozenset(),
        missing_node_ids=frozenset(),
        orphan_node_ids=frozenset(),
    )


def _manifest_expected_node_ids(manifest: Mapping[str, Any]) -> frozenset[str] | None:
    nodes = manifest.get("nodes")
    if not isinstance(nodes, Mapping):
        return None

    expected: set[str] = set()
    for node_id, node in nodes.items():
        if not isinstance(node_id, str) or not isinstance(node, Mapping):
            return None
        if node.get("resource_type") not in _ELIGIBLE_RESOURCE_TYPES:
            continue
        config = node.get("config")
        materialized = config.get("materialized") if isinstance(config, Mapping) else None
        if materialized in _EXCLUDED_MATERIALIZATIONS:
            continue
        expected.add(node_id)
    return frozenset(expected)


def classify_artifact_health(
    manifest: Mapping[str, Any] | None,
    catalog: Mapping[str, Any] | None,
) -> ArtifactHealth:
    if manifest is None or not isinstance(manifest, Mapping):
        return _unknown_health()

    expected_node_ids = _manifest_expected_node_ids(manifest)
    if expected_node_ids is None:
        return _unknown_health()

    if catalog is None:
        if not expected_node_ids:
            return ArtifactHealth(
                status="not_applicable",
                expected_node_ids=expected_node_ids,
                covered_node_ids=frozenset(),
                catalog_node_ids=frozenset(),
                missing_node_ids=frozenset(),
                orphan_node_ids=frozenset(),
            )
        return ArtifactHealth(
            status="absent",
            expected_node_ids=expected_node_ids,
            covered_node_ids=frozenset(),
            catalog_node_ids=frozenset(),
            missing_node_ids=expected_node_ids,
            orphan_node_ids=frozenset(),
        )

    if not isinstance(catalog, Mapping):
        return _unknown_health(expected_node_ids)
    catalog_nodes = catalog.get("nodes")
    if not isinstance(catalog_nodes, Mapping):
        return _unknown_health(expected_node_ids)
    if any(not isinstance(node_id, str) or not isinstance(node, Mapping) for node_id, node in catalog_nodes.items()):
        return _unknown_health(expected_node_ids)

    catalog_node_ids = frozenset(catalog_nodes)
    covered_node_ids = expected_node_ids & catalog_node_ids
    missing_node_ids = expected_node_ids - covered_node_ids
    orphan_node_ids = catalog_node_ids - expected_node_ids

    if not expected_node_ids:
        status: ArtifactHealthStatus = "not_applicable"
    elif not covered_node_ids:
        status = "empty"
    elif not missing_node_ids:
        status = "complete"
    else:
        status = "partial"

    return ArtifactHealth(
        status=status,
        expected_node_ids=expected_node_ids,
        covered_node_ids=covered_node_ids,
        catalog_node_ids=catalog_node_ids,
        missing_node_ids=missing_node_ids,
        orphan_node_ids=orphan_node_ids,
    )


def artifact_health_payload(
    health: ArtifactHealth,
    *,
    sample_limit: int = 50,
) -> dict[str, Any]:
    effective_limit = min(sample_limit, 50)
    return {
        "status": health.status,
        "expected_count": len(health.expected_node_ids),
        "covered_count": len(health.covered_node_ids),
        "catalog_entry_count": len(health.catalog_node_ids),
        "missing_node_count": len(health.missing_node_ids),
        "missing_nodes": sorted(health.missing_node_ids)[:effective_limit],
        "missing_more": len(health.missing_node_ids) > effective_limit,
        "orphan_node_count": len(health.orphan_node_ids),
        "orphan_nodes": sorted(health.orphan_node_ids)[:effective_limit],
        "orphan_more": len(health.orphan_node_ids) > effective_limit,
    }


def _unknown_schema_coverage() -> SchemaCoverage:
    return SchemaCoverage(
        status="unknown",
        checked_node_ids=frozenset(),
        unchecked_node_ids=frozenset(),
        one_sided_node_ids=frozenset(),
    )


def _catalog_columns_are_applicable(node: Mapping[str, Any]) -> bool:
    if node.get("resource_type") in _NON_RELATION_RESOURCE_TYPES:
        return False
    config = node.get("config")
    materialized = config.get("materialized") if isinstance(config, Mapping) else None
    return materialized not in _EXCLUDED_MATERIALIZATIONS


def classify_node_schema_comparison(
    base_nodes: Mapping[str, Mapping[str, Any]],
    current_nodes: Mapping[str, Mapping[str, Any]],
    node_id: str,
) -> SchemaComparisonStatus:
    """Classify one selected node from exact two-sided lineage evidence."""
    in_base = node_id in base_nodes
    in_current = node_id in current_nodes
    if in_base != in_current:
        return "not_applicable"
    if not in_base:
        # A stale or misspelled selection is not structural one-sided evidence.
        return "unchecked"

    base_node = base_nodes.get(node_id)
    current_node = current_nodes.get(node_id)
    if not isinstance(base_node, Mapping) or not isinstance(current_node, Mapping):
        return "unchecked"
    if not _catalog_columns_are_applicable(base_node) or not _catalog_columns_are_applicable(current_node):
        return "not_applicable"
    if base_node.get("catalog_status") == current_node.get("catalog_status") == "covered":
        return "complete"
    return "unchecked"


def classify_schema_coverage(
    base_nodes: Mapping[str, Mapping[str, Any]] | None,
    current_nodes: Mapping[str, Mapping[str, Any]] | None,
    node_ids: Iterable[str],
) -> SchemaCoverage:
    if not isinstance(base_nodes, Mapping) or not isinstance(current_nodes, Mapping):
        return _unknown_schema_coverage()

    selected_node_ids = frozenset(node_ids)
    if any(not isinstance(node_id, str) for node_id in selected_node_ids):
        return _unknown_schema_coverage()

    checked: set[str] = set()
    unchecked: set[str] = set()
    one_sided: set[str] = set()
    for node_id in selected_node_ids:
        base_node = base_nodes.get(node_id)
        current_node = current_nodes.get(node_id)
        if (node_id in base_nodes and not isinstance(base_node, Mapping)) or (
            node_id in current_nodes and not isinstance(current_node, Mapping)
        ):
            return _unknown_schema_coverage()
        comparison_status = classify_node_schema_comparison(base_nodes, current_nodes, node_id)
        if comparison_status == "complete":
            checked.add(node_id)
        elif comparison_status == "unchecked":
            unchecked.add(node_id)
        elif (node_id in base_nodes) != (node_id in current_nodes):
            # Same precedence as classify_node_schema_comparison: one-sidedness
            # is decided before catalog applicability, so a one-sided relation
            # stays structural evidence rather than being written off.
            one_sided.add(node_id)

    return SchemaCoverage(
        status="partial" if unchecked else "complete",
        checked_node_ids=frozenset(checked),
        unchecked_node_ids=frozenset(unchecked),
        one_sided_node_ids=frozenset(one_sided),
    )


def schema_coverage_payload(
    coverage: SchemaCoverage,
    *,
    sample_limit: int = 50,
) -> dict[str, Any]:
    effective_limit = max(0, min(sample_limit, 50))
    return {
        "status": coverage.status,
        "unchecked_nodes": sorted(coverage.unchecked_node_ids)[:effective_limit],
        "unchecked_node_count": len(coverage.unchecked_node_ids),
        "more": len(coverage.unchecked_node_ids) > effective_limit,
    }
