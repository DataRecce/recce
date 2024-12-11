from recce.adapter.dbt_adapter import DbtAdapter, dbt_supported_registry
from recce.models import RunType


def test_dbt_adapter_support_tasks(dbt_test_helper):
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Test dbt package name
    supported_dbt_packages = set([package.package_name for package in adapter.manifest.macros.values()])
    assert 'audit_helper' in supported_dbt_packages
    assert 'dbt_profiler' in supported_dbt_packages

    # Test dbt task support
    support_tasks = adapter.support_tasks()

    for task_type in dbt_supported_registry:
        task = task_type.value
        assert task in support_tasks
        assert support_tasks[task] is True


def test_dbt_adapter_support_tasks_without_required_dbt_package(dbt_test_helper):
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    # Mock the macros in manifest to simulate no required dbt package installed
    adapter.manifest.macros = {}

    support_tasks = adapter.support_tasks()

    for task_type in dbt_supported_registry:
        task = task_type.value
        assert task in support_tasks
        if task == RunType.PROFILE_DIFF.value:
            assert support_tasks[task] is False
        elif task == RunType.VALUE_DIFF.value:
            assert support_tasks[task] is False
        elif task == RunType.VALUE_DIFF_DETAIL.value:
            assert support_tasks[task] is False

    # Check the query_diff_with_primary_key is not supported
    assert support_tasks["query_diff_with_primary_key"] is False
