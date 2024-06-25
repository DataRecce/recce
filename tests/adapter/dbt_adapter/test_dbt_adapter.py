import os
import textwrap
import uuid
from io import StringIO

import pytest
from dbt.contracts.graph.nodes import ModelNode

from recce.adapter.dbt_adapter import DbtAdapter, as_manifest, load_manifest
from recce.core import RecceContext, set_default_context


class DbtTestHelper:

    def __init__(self):
        schema_prefix = "schema_" + uuid.uuid4().hex
        self.base_schema = f"{schema_prefix}_base"
        self.curr_schema = f"{schema_prefix}_curr"

        current_dir = os.path.dirname(os.path.abspath(__file__))
        project_dir = os.path.join(current_dir, '.')
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

    def create_model(self, model_name, base_csv, curr_csv, depends_on=[]):
        package_name = "recce_test"
        # unique_id = f"model.{package_name}.{model_name}"
        unique_id = model_name

        def _add_model_to_manifest(base, raw_code):
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
                "unique_id": unique_id,
                "fqn": [
                    package_name,
                    model_name,
                ],
                "schema": schema,
                "alias": model_name,
                "checksum": {
                    "name": "sha256",
                    "checksum": hash(raw_code),
                },
                "raw_code": raw_code,
                "config": {
                    "materialized": "table",
                    "tags": ["test_tag"],
                },
                "tags": ["test_tag"],
                "depends_on": {
                    "nodes": depends_on
                },
            })
            manifest.add_node_nofile(node)
            return node

        base_csv = textwrap.dedent(base_csv)
        curr_csv = textwrap.dedent(curr_csv)

        _add_model_to_manifest(True, base_csv)
        _add_model_to_manifest(False, curr_csv)

        import pandas as pd
        df_base = pd.read_csv(StringIO(base_csv))
        df_curr = pd.read_csv(StringIO(curr_csv))
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


def test_select(helper):
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

    helper.create_model("customers_1", csv_data_base, csv_data_curr)
    helper.create_model("customers_2", csv_data_base, csv_data_base, ["customers_1"])
    adapter: DbtAdapter = helper.context.adapter

    # Test methods
    node_ids = adapter.select_nodes('customers_1')
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes('resource_type:model')
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes('tag:test_tag')
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes('tag:test_tag2')
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes("config.materialized:incremental")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes("config.materialized:table")
    assert len(node_ids) == 2

    # Test state method
    node_ids = adapter.select_nodes("state:modified")
    assert len(node_ids) == 1

    # Test set operation
    node_ids = adapter.select_nodes("customers_1 customers_2")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("customers_1,customers_2")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes("config.materialized:table,tag:test_tag")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("config.materialized:table,tag:test_tag2")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes(exclude='customers_1')
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes('customers_1', exclude='customers_2')
    assert len(node_ids) == 1

    # Test graph operation
    node_ids = adapter.select_nodes("state:modified+")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("+state:modified")
    assert len(node_ids) == 1
