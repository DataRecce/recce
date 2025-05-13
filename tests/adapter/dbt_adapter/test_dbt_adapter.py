from recce.adapter.dbt_adapter import DbtAdapter, dbt_supported_registry


def test_dbt_adapter_support_tasks(dbt_test_helper):
    adapter: DbtAdapter = dbt_test_helper.context.adapter

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
