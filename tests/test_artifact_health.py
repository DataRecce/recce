from typing import Any

import pytest

from recce.artifact_health import artifact_health_payload, classify_artifact_health


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
