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


def test_change_analysis_ignores_parent_without_columns(dbt_test_helper):
    """DRC-4918: a parent with no columns must not be written to the change-analysis schema as an
    empty table. sqlglot then skips qualify() for the whole statement, so `select *` cannot expand and
    the column diff is wrong. Here `ghost` is a parent but is not referenced in the SQL."""
    dbt_test_helper.create_model(
        "customers",
        unique_id="model.customers",
        base_sql="select 1 as id, 2 as a, 3 as b",
        curr_sql="select 1 as id, 2 as a, 3 as b",
        base_columns={"id": "int", "a": "int", "b": "int"},
        curr_columns={"id": "int", "a": "int", "b": "int"},
    )
    dbt_test_helper.create_model(
        "ghost",
        unique_id="model.ghost",
        base_sql="select 1 as id",
        curr_sql="select 1 as id",
        base_columns={},
        curr_columns={},
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        base_sql='select * from {{ ref("customers") }}',
        curr_sql='select id, a from {{ ref("customers") }}',
        base_columns={"id": "int", "a": "int", "b": "int"},
        curr_columns={"id": "int", "a": "int"},
        depends_on=["model.customers", "model.ghost"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    node_diff = adapter.get_change_analysis_cached("model.model2")

    assert node_diff.change.category == "partial_breaking"
    assert node_diff.change.columns == {"b": "removed"}


def _add_macro(helper, package_name, name, macro_sql, manifests=None):
    from dbt.contracts.graph.nodes import Macro

    unique_id = f"macro.{package_name}.{name}"
    for manifest in manifests or (helper.base_manifest, helper.curr_manifest):
        manifest.macros[unique_id] = Macro.from_dict(
            {
                "name": name,
                "resource_type": "macro",
                "package_name": package_name,
                "path": f"macros/{name}.sql",
                "original_file_path": f"macros/{name}.sql",
                "unique_id": unique_id,
                "macro_sql": macro_sql,
            }
        )


def test_change_analysis_resolves_macros_of_another_project(dbt_test_helper):
    """The manifest comes from another dbt project than the one recce runs in, as on
    Recce Cloud. Its project macro and its dispatched package macro must still render."""
    _add_macro(dbt_test_helper, "other_proj", "cents", "{% macro cents(col) %}({{ col }} / 100){% endmacro %}")
    _add_macro(
        dbt_test_helper,
        "other_pkg",
        "add_up",
        "{% macro add_up(a, b) %}{{ return(adapter.dispatch('add_up', 'other_pkg')(a, b)) }}{% endmacro %}",
    )
    _add_macro(
        dbt_test_helper,
        "other_pkg",
        "default__add_up",
        "{% macro default__add_up(a, b) %}{{ a }} + {{ b }}{% endmacro %}",
    )
    for manifest in (dbt_test_helper.base_manifest, dbt_test_helper.curr_manifest):
        manifest.metadata.project_name = "other_proj"

    dbt_test_helper.create_model(
        "payments",
        unique_id="model.payments",
        base_sql="select 1 as id, 200 as amount",
        curr_sql="select 1 as id, 200 as amount",
        base_columns={"id": "int", "amount": "int"},
        curr_columns={"id": "int", "amount": "int"},
        package_name="other_proj",
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        base_sql='select id, {{ cents("amount") }} as amount from {{ ref("payments") }}',
        curr_sql='select id, {{ cents("amount") }} as amount, {{ other_pkg.add_up("id", "amount") }} as total '
        'from {{ ref("payments") }}',
        base_columns={"id": "int", "amount": "int"},
        curr_columns={"id": "int", "amount": "int", "total": "int"},
        depends_on=["model.payments"],
        package_name="other_proj",
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    node_diff = adapter.get_change_analysis_cached("model.model2")

    assert node_diff.change.category == "non_breaking"
    assert node_diff.change.columns == {"total": "added"}


def test_change_analysis_resolves_package_macros_only_in_base_manifest(dbt_test_helper):
    """A package the base manifest uses but the current manifest dropped must still be
    searched by adapter.dispatch(), or the base render fails and the category is unknown."""
    base_only = (dbt_test_helper.base_manifest,)
    _add_macro(
        dbt_test_helper,
        "base_pkg",
        "add_up",
        "{% macro add_up(a, b) %}{{ return(adapter.dispatch('add_up', 'base_pkg')(a, b)) }}{% endmacro %}",
        manifests=base_only,
    )
    _add_macro(
        dbt_test_helper,
        "base_pkg",
        "default__add_up",
        "{% macro default__add_up(a, b) %}{{ a }} + {{ b }}{% endmacro %}",
        manifests=base_only,
    )

    dbt_test_helper.create_model(
        "payments",
        unique_id="model.payments",
        base_sql="select 1 as id, 200 as amount",
        curr_sql="select 1 as id, 200 as amount",
        base_columns={"id": "int", "amount": "int"},
        curr_columns={"id": "int", "amount": "int"},
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        base_sql='select id, amount, {{ base_pkg.add_up("id", "amount") }} as total from {{ ref("payments") }}',
        curr_sql='select id, amount, id + amount as total, 1 as flag from {{ ref("payments") }}',
        base_columns={"id": "int", "amount": "int", "total": "int"},
        curr_columns={"id": "int", "amount": "int", "total": "int", "flag": "int"},
        depends_on=["model.payments"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    node_diff = adapter.get_change_analysis_cached("model.model2")

    assert node_diff.change.category == "non_breaking"
    assert node_diff.change.columns == {"flag": "added"}
