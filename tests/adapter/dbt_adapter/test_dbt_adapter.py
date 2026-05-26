import os
from unittest.mock import patch

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


def test_dbt_adapter_support_tasks_without_required_dbt_package(dbt_test_helper):
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    # Mock the macros in manifest to simulate no required dbt package installed
    adapter.manifest.macros = {}

    support_tasks = adapter.support_tasks()

    for task_type in dbt_supported_registry:
        task = task_type.value
        assert task in support_tasks
