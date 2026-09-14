import os
from unittest.mock import patch

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, dbt_supported_registry


def test_dbt_adapter_support_tasks(dbt_test_helper):
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Test dbt task support
    support_tasks = adapter.support_tasks()

    for task_type in dbt_supported_registry:
        task = task_type.value
        assert task in support_tasks
        assert support_tasks[task] is True

    assert "change_analysis" in support_tasks
    assert support_tasks["change_analysis"] is True


def test_dbt_adapter_duckdb_external_access_can_be_set_true():
    """DbtAdapter.load() must propagate duckdb_external_access=True from kwargs."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.join(current_dir, "test_proj")
    with patch("recce.adapter.dbt_adapter.log_performance"):
        adapter = DbtAdapter.load(
            no_artifacts=True,
            project_dir=project_dir,
            profiles_dir=project_dir,
            duckdb_external_access=True,
        )
    assert adapter.duckdb_external_access is True


def test_recce_context_propagates_duckdb_external_access():
    """RecceContext.load(duckdb_external_access=True, ...) must reach the adapter via **kwargs."""
    from recce.core import RecceContext

    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.join(current_dir, "test_proj")

    with patch("recce.adapter.dbt_adapter.log_performance"):
        ctx = RecceContext.load(
            no_artifacts=True,
            project_dir=project_dir,
            profiles_dir=project_dir,
            duckdb_external_access=True,
        )

    assert ctx.adapter.duckdb_external_access is True


def test_get_lineage_catalog_status_marks_missing_current_model_unchecked(dbt_test_helper):
    """Catalog membership, not timestamps, controls current-side coverage."""
    node_id = "model.recce_test.not_cataloged"
    dbt_test_helper.create_model(
        "not_cataloged",
        base_sql="select 1 as id",
        curr_sql="select 1 as id",
        unique_id=node_id,
        base_columns={"id": "integer"},
    )

    lineage = dbt_test_helper.adapter.get_lineage()

    assert lineage["nodes"][node_id]["catalog_status"] == "unchecked"
    assert "covered_node_ids" not in lineage["artifact_health"]

    # Assert the STATUS, not just a count: passing catalog=None to the
    # classifier also produces a non-zero missing count, but it yields "empty"
    # here only when a real catalog was consulted and covered nothing. That
    # distinction drives which catalog the UI tells the user to regenerate.
    health = lineage["artifact_health"]
    assert health["status"] == "empty"
    assert health["covered_count"] == 0
    assert node_id in health["missing_nodes"]


def test_get_lineage_artifact_health_is_complete_when_every_model_is_catalogued(dbt_test_helper):
    """The still-healthy half: a covered project reports no coverage gap."""
    node_id = "model.recce_test.cataloged"
    dbt_test_helper.create_model(
        "cataloged",
        base_sql="select 1 as id",
        curr_sql="select 1 as id",
        unique_id=node_id,
        base_columns={"id": "integer"},
        curr_columns={"id": "integer"},
    )

    lineage = dbt_test_helper.adapter.get_lineage()

    health = lineage["artifact_health"]
    assert lineage["nodes"][node_id]["catalog_status"] == "covered"
    assert health["status"] == "complete"
    assert health["missing_node_count"] == 0
    assert health["missing_nodes"] == []
    assert health["covered_count"] == health["expected_count"]


@pytest.mark.parametrize("materialized", ["ephemeral", "semantic_view"])
def test_get_lineage_catalog_status_marks_excluded_materializations_not_applicable(dbt_test_helper, materialized):
    node_id = f"model.recce_test.{materialized}_model"

    def exclude_from_catalog_coverage(node):
        node["config"]["materialized"] = materialized

    dbt_test_helper.create_model(
        f"{materialized}_model",
        base_sql="select 1 as id",
        curr_sql="select 1 as id",
        unique_id=node_id,
        patch_func=exclude_from_catalog_coverage,
    )

    lineage = dbt_test_helper.adapter.get_lineage()

    assert lineage["nodes"][node_id]["catalog_status"] == "not_applicable"
