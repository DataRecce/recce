import json


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
