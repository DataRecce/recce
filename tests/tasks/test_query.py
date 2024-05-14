import pytest
from dbt.contracts.graph.manifest import Manifest
from dbt.contracts.graph.nodes import ModelNode

from recce.adapter.dbt_adapter import DbtAdapter
from recce.core import RecceContext


class DbtTestHelper:

    def __init__(self):
        model = {
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
            "schema": "dev",
            "alias": "customers",
            "checksum": {
                "name": "sha256",
                "checksum": ""
            },
        }
        manifest: Manifest = Manifest()
        manifest.add_node_nofile(ModelNode.from_dict(model))

        dbt_adapter = DbtAdapter.load(
            project_dir='tests/adapter/dbt_adapter/',
            profiles_dir='tests/adapter/dbt_adapter/',
        )

        context = RecceContext()
        context.adapter_type = 'dbt'
        context.adapter = dbt_adapter

        self.manifest = manifest


@pytest.fixture()
def helper():
    return DbtTestHelper()


def test_query(helper):
    print(helper.manifest)
