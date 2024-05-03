import logging
from abc import ABC, abstractmethod
from typing import Dict, Optional, Callable

from recce.state import ArtifactsRoot

# from dbt.contracts.graph.nodes import ManifestNode

logger = logging.getLogger('uvicorn')


class BaseAdapter(ABC):
    @abstractmethod
    def get_lineage(self, base: Optional[bool] = False):
        raise NotImplementedError()

    @abstractmethod
    def get_model(self, model_id: str, base=False):
        raise NotImplementedError()

    def start_monitor_artifacts(self, callback: Callable = None):
        pass

    def stop_monitor_artifacts(self):
        pass

    def refresh(self, refresh_file_path: str = None):
        pass

    def export_artifacts(self) -> ArtifactsRoot:
        return ArtifactsRoot(base={}, current={})

    def import_artifacts(self, artifacts: ArtifactsRoot):
        pass

    def find_node_by_name(self, node_name, base=False):
        logger.info("Deprecated method find_node_by_name. It returns dbt's type")
        manifest = self.curr_manifest if base is False else self.base_manifest
        for key, node in manifest.nodes.items():
            if node.name == node_name:
                return node
        return None

    def get_node_by_name(self, node_name):
        node = self.find_node_by_name(node_name) or self.find_node_by_name(node_name, base=True)
        return node

    def get_node_name_by_id(self, unique_id):
        if unique_id in self.curr_manifest.nodes:
            return self.curr_manifest.nodes[unique_id].name
        elif unique_id in self.base_manifest.nodes:
            return self.base_manifest.nodes[unique_id].name
        return None

    def build_name_to_unique_id_index(self) -> Dict[str, str]:
        name_to_unique_id = {}
        curr_manifest = self.get_manifest(base=False)
        base_manifest = self.get_manifest(base=True)

        for unique_id, node in base_manifest.nodes.items():
            name_to_unique_id[node.name] = unique_id
        for unique_id, node in curr_manifest.nodes.items():
            name_to_unique_id[node.name] = unique_id
        return name_to_unique_id
