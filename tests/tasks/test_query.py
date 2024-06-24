import os
import textwrap
import uuid

import pytest
from dbt.contracts.graph.nodes import ModelNode

from recce.adapter.dbt_adapter import DbtAdapter, as_manifest, load_manifest
from recce.core import RecceContext, set_default_context
from recce.tasks import QueryDiffTask


class DbtTestHelper:

    def __init__(self):
        schema_prefix = "schema_" + uuid.uuid4().hex
        self.base_schema = f"{schema_prefix}_base"
        self.curr_schema = f"{schema_prefix}_curr"

        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_dir = os.path.join(current_dir, '../adapter/dbt_adapter')
        profiles_dir = project_dir
        manifest_path = os.path.join(project_dir, 'manifest.json')

        dbt_adapter = DbtAdapter.load(
            no_artifacts=True,
            project_dir=project_dir,
            profiles_dir=profiles_dir,
        )

        context = RecceContext()
        context.adapter_type = 'dbt'
        context.adapter = dbt_adapter
        context.schema_prefix = schema_prefix
        self.adapter = dbt_adapter
        self.context = context
        self.curr_manifest = as_manifest(load_manifest(manifest_path))
        self.base_manifest = as_manifest(load_manifest(manifest_path))
        self.context = context

        self.adapter.execute(f"CREATE schema IF NOT EXISTS {self.base_schema}")
        self.adapter.execute(f"CREATE schema IF NOT EXISTS {self.curr_schema}")
        self.adapter.set_artifacts(self.base_manifest, self.curr_manifest)

    def create_model(self, model_name, base_csv, curr_csv):
        package_name = "recce_test"

        def _add_model_to_manifest(base):
            if base:
                schema = self.base_schema
                manifest = self.base_manifest
            else:
                schema = self.curr_schema
                manifest = self.curr_manifest

            node = ModelNode.from_dict({
                "resource_type": "model",
                "name": model_name,
                "package_name": package_name,
                "path": "",
                "original_file_path": "",
                "unique_id": f"model.{package_name}.{model_name}",
                "fqn": [
                    package_name,
                    model_name,
                ],
                "schema": schema,
                "alias": model_name,
                "checksum": {
                    "name": "sha256",
                    "checksum": ""
                },
            })
            manifest.add_node_nofile(node)

        _add_model_to_manifest(base=True)
        _add_model_to_manifest(base=False)

        import pandas as pd
        from io import StringIO
        df_base = pd.read_csv(StringIO(textwrap.dedent(base_csv)))
        df_curr = pd.read_csv(StringIO(textwrap.dedent(curr_csv)))
        dbt_adapter = self.adapter
        with dbt_adapter.connection_named('create model'):
            dbt_adapter.execute(f"CREATE TABLE {self.base_schema}.{model_name} AS SELECT * FROM df_base")
            dbt_adapter.execute(f"CREATE TABLE {self.curr_schema}.{model_name} AS SELECT * FROM df_curr")
        self.adapter.set_artifacts(self.base_manifest, self.curr_manifest)

    def remove_model(self, model_name):
        dbt_adapter = self.adapter
        with dbt_adapter.connection_named('cleanup'):
            dbt_adapter.execute(f"DROP TABLE IF EXISTS {self.base_schema}.{model_name}")
            dbt_adapter.execute(f"DROP TABLE IF EXISTS {self.curr_schema}.{model_name} ")

    def cleanup(self):
        dbt_adapter = self.adapter
        with dbt_adapter.connection_named('cleanup'):
            dbt_adapter.execute(f"DROP SCHEMA IF EXISTS {self.base_schema} CASCADE")
            dbt_adapter.execute(f"DROP SCHEMA IF EXISTS {self.curr_schema} CASCADE")


@pytest.fixture
def helper():
    helper = DbtTestHelper()
    context = helper.context
    set_default_context(context)
    yield helper
    helper.cleanup()


def test_query_in_client(helper):
    csv_data_curr = """
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

    helper.create_model("customers", csv_data_base, csv_data_curr)
    params = dict(sql_template=f'select * from {{{{ ref("customers") }}}}')
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 3
    assert len(run_result.current.data) == 3


def test_query_in_warehouse(helper):
    csv_data_curr = """
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

    helper.create_model("customers", csv_data_base, csv_data_curr)
    params = dict(sql_template=f'select * from {{{{ ref("customers") }}}}', primary_keys=['customer_id'])
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.diff.data) == 2
