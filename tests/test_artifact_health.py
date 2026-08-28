from typing import Any

import pytest

from recce.artifact_health import (
    artifact_health_payload,
    classify_artifact_health,
    classify_schema_coverage,
    schema_coverage_payload,
)


def _manifest(
    *,
    models: int = 0,
    ephemeral: int = 0,
    semantic_views: int = 0,
) -> dict[str, Any]:
    nodes: dict[str, dict[str, Any]] = {}
    for index in range(models):
        node_id = f"model.pkg.m{index}"
        nodes[node_id] = {
            "resource_type": "model",
            "config": {"materialized": "table"},
        }
    for index in range(ephemeral):
        node_id = f"model.pkg.e{index}"
        nodes[node_id] = {
            "resource_type": "model",
            "config": {"materialized": "ephemeral"},
        }
    for index in range(semantic_views):
        node_id = f"model.pkg.sv{index}"
        nodes[node_id] = {
            "resource_type": "model",
            "config": {"materialized": "semantic_view"},
        }
    return {"nodes": nodes}


def _catalog(*, models: tuple[str, ...] = (), sources: tuple[str, ...] = ()) -> dict[str, Any]:
    return {
        "nodes": {node_id: {"metadata": {}} for node_id in models},
        "sources": {source_id: {"metadata": {}} for source_id in sources},
    }


@pytest.mark.parametrize(
    ("manifest", "catalog", "status", "covered", "missing", "orphans"),
    [
        (_manifest(models=2), _catalog(models=()), "empty", 0, 2, 0),
        (_manifest(models=2), _catalog(models=("model.pkg.m0",)), "partial", 1, 1, 0),
        (
            _manifest(models=2),
            _catalog(models=("model.pkg.m0", "model.pkg.m1")),
            "complete",
            2,
            0,
            0,
        ),
        (_manifest(models=2), None, "absent", 0, 2, 0),
        (_manifest(ephemeral=2), None, "not_applicable", 0, 0, 0),
        (None, _catalog(models=()), "unknown", 0, 0, 0),
    ],
)
def test_classify_artifact_health(
    manifest: dict[str, Any] | None,
    catalog: dict[str, Any] | None,
    status: str,
    covered: int,
    missing: int,
    orphans: int,
) -> None:
    health = classify_artifact_health(manifest, catalog)

    assert health.status == status
    assert len(health.covered_node_ids) == covered
    assert len(health.missing_node_ids) == missing
    assert len(health.orphan_node_ids) == orphans


def test_sources_only_catalog_does_not_cover_expected_nodes() -> None:
    health = classify_artifact_health(_manifest(models=1), _catalog(sources=("source.pkg.raw",)))

    assert health.status == "empty"
    assert health.covered_node_ids == frozenset()
    assert health.missing_node_ids == frozenset({"model.pkg.m0"})


def test_ephemeral_and_semantic_view_models_are_not_expected() -> None:
    manifest = _manifest(models=1, ephemeral=1, semantic_views=1)

    health = classify_artifact_health(manifest, _catalog(models=("model.pkg.m0",)))

    assert health.status == "complete"
    assert health.expected_node_ids == frozenset({"model.pkg.m0"})


@pytest.mark.parametrize("resource_type", ["seed", "snapshot"])
def test_seed_and_snapshot_relations_are_expected(resource_type: str) -> None:
    node_id = f"{resource_type}.pkg.orders"
    manifest = {
        "nodes": {
            node_id: {
                "resource_type": resource_type,
                "config": {"materialized": resource_type},
            }
        }
    }

    health = classify_artifact_health(manifest, _catalog(models=(node_id,)))

    assert health.status == "complete"
    assert health.expected_node_ids == frozenset({node_id})
    assert health.covered_node_ids == frozenset({node_id})


def test_payload_sorts_and_bounds_orphan_ids() -> None:
    manifest = _manifest(models=1)
    catalog = _catalog(models=("model.pkg.z", "model.pkg.a", "model.pkg.m0", "model.pkg.b"))

    payload = artifact_health_payload(classify_artifact_health(manifest, catalog), sample_limit=2)

    assert payload == {
        "status": "complete",
        "expected_count": 1,
        "covered_count": 1,
        "catalog_entry_count": 4,
        "missing_node_count": 0,
        "missing_nodes": [],
        "missing_more": False,
        "orphan_node_count": 3,
        "orphan_nodes": ["model.pkg.a", "model.pkg.b"],
        "orphan_more": True,
    }


def test_payload_caps_samples_at_fifty_even_when_limit_is_larger() -> None:
    orphan_ids = tuple(f"model.pkg.orphan{index:02d}" for index in range(51))
    health = classify_artifact_health(_manifest(models=1), _catalog(models=orphan_ids))

    payload = artifact_health_payload(health, sample_limit=100)

    assert len(payload["orphan_nodes"]) == 50
    assert payload["orphan_more"] is True


def test_malformed_non_dict_manifest_nodes_are_unknown() -> None:
    health = classify_artifact_health({"nodes": []}, _catalog(models=()))

    assert health.status == "unknown"
    assert health.expected_node_ids == frozenset()
    assert health.covered_node_ids == frozenset()
    assert health.missing_node_ids == frozenset()
    assert health.orphan_node_ids == frozenset()


def test_malformed_non_dict_catalog_nodes_are_unknown() -> None:
    health = classify_artifact_health(_manifest(models=1), {"nodes": []})

    assert health.status == "unknown"
    assert health.expected_node_ids == frozenset({"model.pkg.m0"})
    assert health.covered_node_ids == frozenset()
    assert health.missing_node_ids == frozenset()
    assert health.orphan_node_ids == frozenset()


def _lineage_node(
    *,
    resource_type: str = "model",
    materialized: str = "table",
    catalog_status: str | None = "covered",
    columns: tuple[str, ...] = ("id",),
) -> dict[str, Any]:
    node: dict[str, Any] = {
        "resource_type": resource_type,
        "config": {"materialized": materialized},
        "columns": {column: {"type": "text"} for column in columns},
    }
    if catalog_status is not None:
        node["catalog_status"] = catalog_status
    return node


@pytest.mark.parametrize(
    ("base_nodes", "current_nodes"),
    [
        (None, {}),
        ({}, None),
        (None, None),
    ],
    ids=["missing-base", "missing-current", "missing-both"],
)
def test_schema_coverage_is_unknown_when_either_node_mapping_is_missing(
    base_nodes: dict[str, dict[str, Any]] | None,
    current_nodes: dict[str, dict[str, Any]] | None,
) -> None:
    coverage = classify_schema_coverage(base_nodes, current_nodes, ["model.pkg.orders"])

    assert coverage.status == "unknown"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset()


@pytest.mark.parametrize(
    ("base_status", "current_status"),
    [
        ("unchecked", "covered"),
        ("covered", "unchecked"),
        ("unchecked", "unchecked"),
    ],
    ids=["missing-base-catalog", "missing-current-catalog", "missing-both-catalogs"],
)
def test_schema_coverage_is_partial_when_either_catalog_side_is_unchecked(
    base_status: str,
    current_status: str,
) -> None:
    node_id = "model.pkg.orders"

    coverage = classify_schema_coverage(
        {node_id: _lineage_node(catalog_status=base_status)},
        {node_id: _lineage_node(catalog_status=current_status)},
        [node_id],
    )

    assert coverage.status == "partial"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset({node_id})


def test_schema_coverage_keeps_checked_nodes_when_other_nodes_are_unchecked() -> None:
    checked_id = "model.pkg.verified_removal"
    unchecked_id = "model.pkg.not_rebuilt"

    coverage = classify_schema_coverage(
        {
            checked_id: _lineage_node(columns=("id", "removed")),
            unchecked_id: _lineage_node(),
        },
        {
            checked_id: _lineage_node(columns=("id",)),
            unchecked_id: _lineage_node(catalog_status="unchecked", columns=()),
        },
        [unchecked_id, checked_id],
    )

    assert coverage.status == "partial"
    assert coverage.checked_node_ids == frozenset({checked_id})
    assert coverage.unchecked_node_ids == frozenset({unchecked_id})


def test_schema_coverage_excludes_one_sided_structural_nodes() -> None:
    removed_id = "model.pkg.removed"

    coverage = classify_schema_coverage(
        {removed_id: _lineage_node()},
        {},
        [removed_id],
    )

    assert coverage.status == "complete"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset()


def test_schema_coverage_fails_closed_for_selected_id_absent_from_both_manifests() -> None:
    stale_id = "model.pkg.misspelled_orders"

    coverage = classify_schema_coverage({}, {}, [stale_id])

    assert coverage.status == "partial"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset({stale_id})


@pytest.mark.parametrize(
    ("base_nodes", "current_nodes"),
    [
        ({"model.pkg.broken": []}, {}),
        ({}, {"model.pkg.broken": []}),
    ],
    ids=["malformed-base", "malformed-current"],
)
def test_schema_coverage_rejects_malformed_one_sided_nodes(
    base_nodes: dict[str, Any],
    current_nodes: dict[str, Any],
) -> None:
    coverage = classify_schema_coverage(base_nodes, current_nodes, ["model.pkg.broken"])

    assert coverage.status == "unknown"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset()


@pytest.mark.parametrize(
    ("node_id", "node"),
    [
        ("model.pkg.inlined", _lineage_node(materialized="ephemeral", catalog_status="not_applicable", columns=())),
        (
            "model.pkg.semantic",
            _lineage_node(materialized="semantic_view", catalog_status="not_applicable", columns=()),
        ),
    ],
    ids=["ephemeral", "semantic-view"],
)
def test_schema_coverage_excludes_models_that_cannot_carry_catalog_columns(
    node_id: str,
    node: dict[str, Any],
) -> None:
    coverage = classify_schema_coverage({node_id: node}, {node_id: node}, [node_id])

    assert coverage.status == "complete"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset()


@pytest.mark.parametrize(
    ("base_materialized", "current_materialized"),
    [("table", "ephemeral"), ("semantic_view", "table")],
    ids=["table-to-ephemeral", "semantic-view-to-table"],
)
def test_schema_coverage_excludes_transitions_with_a_non_catalogable_side(
    base_materialized: str,
    current_materialized: str,
) -> None:
    node_id = "model.pkg.transitioned"
    base_node = _lineage_node(
        materialized=base_materialized,
        catalog_status="covered" if base_materialized == "table" else "not_applicable",
    )
    current_node = _lineage_node(
        materialized=current_materialized,
        catalog_status="covered" if current_materialized == "table" else "not_applicable",
    )

    coverage = classify_schema_coverage(
        {node_id: base_node},
        {node_id: current_node},
        [node_id],
    )

    assert coverage.status == "complete"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset()


def test_schema_coverage_checks_catalogued_sources() -> None:
    source_id = "source.pkg.raw_orders"
    source = _lineage_node(resource_type="source")

    coverage = classify_schema_coverage({source_id: source}, {source_id: source}, [source_id])

    assert coverage.status == "complete"
    assert coverage.checked_node_ids == frozenset({source_id})
    assert coverage.unchecked_node_ids == frozenset()


def test_schema_coverage_treats_legacy_nodes_without_catalog_status_as_unchecked() -> None:
    node_id = "model.pkg.legacy"
    legacy_node = _lineage_node(catalog_status=None)

    coverage = classify_schema_coverage({node_id: legacy_node}, {node_id: legacy_node}, [node_id])

    assert coverage.status == "partial"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset({node_id})


@pytest.mark.parametrize(
    ("node_id", "resource_type"),
    [
        ("model.pkg.orders", "model"),
        ("source.pkg.raw_orders", "source"),
    ],
    ids=["table-model", "source"],
)
def test_schema_coverage_does_not_let_not_applicable_marker_hide_a_relation(
    node_id: str,
    resource_type: str,
) -> None:
    malformed_node = _lineage_node(
        resource_type=resource_type,
        catalog_status="not_applicable",
    )

    coverage = classify_schema_coverage(
        {node_id: malformed_node},
        {node_id: malformed_node},
        [node_id],
    )

    assert coverage.status == "partial"
    assert coverage.checked_node_ids == frozenset()
    assert coverage.unchecked_node_ids == frozenset({node_id})


def test_schema_coverage_payload_sorts_and_bounds_unchecked_nodes() -> None:
    node_ids = [f"model.pkg.m{index:02d}" for index in range(55)]
    base_nodes = {node_id: _lineage_node() for node_id in node_ids}
    current_nodes = {node_id: _lineage_node(catalog_status="unchecked", columns=()) for node_id in reversed(node_ids)}

    payload = schema_coverage_payload(
        classify_schema_coverage(base_nodes, current_nodes, reversed(node_ids)),
        sample_limit=100,
    )

    assert payload == {
        "status": "partial",
        "unchecked_nodes": sorted(node_ids)[:50],
        "unchecked_node_count": 55,
        "more": True,
    }


def test_schema_coverage_payload_clamps_negative_sample_limit_to_zero() -> None:
    node_ids = [f"model.pkg.m{index:02d}" for index in range(55)]
    base_nodes = {node_id: _lineage_node() for node_id in node_ids}
    current_nodes = {node_id: _lineage_node(catalog_status="unchecked", columns=()) for node_id in node_ids}

    payload = schema_coverage_payload(
        classify_schema_coverage(base_nodes, current_nodes, node_ids),
        sample_limit=-1,
    )

    assert payload == {
        "status": "partial",
        "unchecked_nodes": [],
        "unchecked_node_count": 55,
        "more": True,
    }
