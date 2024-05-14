import textwrap
from unittest.mock import patch

import pytest
from dbt.contracts.graph.nodes import ModelNode

from recce.adapter.dbt_adapter import DbtAdapter, load_manifest, as_manifest
from recce.core import RecceContext

pass


class DbtTestHelper:

    def __init__(self):
        base_model = {
            "resource_type": "model",
            "name": "customers",
            "package_name": "jaffle_shop",
            "path": "customers.sql",
            "original_file_path": "models/customers.sql",
            "unique_id": "model.jaffle_shop.customers",
            "fqn": [
                "jaffle_shop",
                "customers"
            ],
            "schema": "main",
            "alias": "customers",
            "checksum": {
                "name": "sha256",
                "checksum": ""
            },
        }
        curr_model = {
            "resource_type": "model",
            "name": "customers",
            "package_name": "jaffle_shop",
            "path": "customers.sql",
            "original_file_path": "models/customers.sql",
            "unique_id": "model.jaffle_shop.customers",
            "fqn": [
                "jaffle_shop",
                "customers"
            ],
            "schema": "curr",
            "alias": "customers",
            "checksum": {
                "name": "sha256",
                "checksum": ""
            },
        }

        curr_manifest = as_manifest(load_manifest('tests/adapter/dbt_adapter/target/manifest.json'))
        base_manifest = as_manifest(load_manifest('tests/adapter/dbt_adapter/target-base/manifest.json'))

        base_manifest.add_node_nofile(ModelNode.from_dict(base_model))
        curr_manifest.add_node_nofile(ModelNode.from_dict(curr_model))

        from recce.state import ArtifactsRoot
        dbt_adapter = DbtAdapter.load(
            artifacts=ArtifactsRoot(
                base={'manifest': base_manifest.writable_manifest().to_dict()},
                current={'manifest': curr_manifest.writable_manifest().to_dict()}
            ),
            project_dir='tests/adapter/dbt_adapter/',
            profiles_dir='tests/adapter/dbt_adapter/',
        )

        context = RecceContext()
        context.adapter_type = 'dbt'
        context.adapter = dbt_adapter

        import pandas as pd
        csv_data = """
           customer_id,name,age
           1,Alice,30
           2,Bob,25
           3,Charlie,35
           """

        csv_data_base = """
           customer_id,name,age
           1,Alice,35
           2,Bob,25
           3,Charlie,35
           """

        # 使用 Pandas 读取 CSV 数据
        from io import StringIO
        df = pd.read_csv(StringIO(textwrap.dedent(csv_data)))
        df2 = pd.read_csv(StringIO(textwrap.dedent(csv_data_base)))
        dbt_adapter.execute("CREATE schema curr")
        dbt_adapter.execute("CREATE TABLE main.customers AS SELECT * FROM df")
        dbt_adapter.execute("CREATE TABLE curr.customers AS SELECT * FROM df2")
        # result, table = dbt_adapter.execute("SELECT * FROM main.customers", auto_begin=True, fetch=True, limit=2000)
        # agate.table.print_table(table)
        # result, table = dbt_adapter.execute("SELECT * FROM curr.customers", auto_begin=True, fetch=True, limit=2000)
        # agate.table.print_table(table)
        self.context = context


@pytest.fixture()
def helper():
    return DbtTestHelper()


@pytest.fixture
def mock_default_context(helper):
    with patch('recce.core.default_context', return_value=helper.context):
        yield


def test_query(mock_default_context):
    from recce.tasks import QueryDiffTask

    params = dict(sql_template='select * from {{ ref("customers") }}')
    task = QueryDiffTask(params)
    run_result = task.execute()
    print(run_result)

    params = dict(sql_template='select * from {{ ref("customers") }}', primary_keys=['customer_id'])
    task = QueryDiffTask(params)
    run_result = task.execute()
    print(run_result)


def test_query2(mock_default_context):
    from recce.tasks import QueryDiffTask

    params = dict(sql_template='select * from {{ ref("customers") }}')
    task = QueryDiffTask(params)
    run_result = task.execute()
    print(run_result)

    params = dict(sql_template='select * from {{ ref("customers") }}', primary_keys=['customer_id'])
    task = QueryDiffTask(params)
    run_result = task.execute()
    print(run_result)


def test_query3(mock_default_context):
    from recce.tasks import QueryDiffTask

    params = dict(sql_template='select * from {{ ref("customers") }}')
    task = QueryDiffTask(params)
    run_result = task.execute()
    print(run_result)

    params = dict(sql_template='select * from {{ ref("customers") }}', primary_keys=['customer_id'])
    task = QueryDiffTask(params)
    run_result = task.execute()
    print(run_result)
