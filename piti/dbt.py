import json
import os

from dbt.cli.main import dbtRunner, dbtRunnerResult
from dbt.config.profile import Profile
from dbt.config.project import Project
from dbt.config.runtime import load_profile, load_project

from dbt.adapters.sql import SQLAdapter

from dbt.adapters.factory import get_adapter_by_type

def test_connection():
    project_path = os.getcwd()
    dbtRunner().invoke(["-q", "debug"], project_dir=str(project_path))

    profile = load_profile(project_path, {})
    adapter:SQLAdapter = get_adapter_by_type(profile.credentials.type)
    with adapter.connection_named('test'):
        response, result = adapter.execute('select * from orders', fetch=True, auto_begin=True)
        print(response)
        print(result)
        for col in result.column_names:
            print(col)

        for row in result:
            print(row)








def load_dbt_manifest(path: str):
    with open(path, 'r') as file:
        data = json.load(file)
    return DbtManifest(data)


class DbtManifest():
    def __init__(self, data):
        self.data = data

    def find_model_by_name(self, resource_name):
        for key, node in self.data.get("nodes", {}).items():
            if node.get("name") == resource_name and node.get("resource_type") == "model":
                selected_node = node
                break

        return selected_node
