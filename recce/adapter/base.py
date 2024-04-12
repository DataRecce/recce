import logging
from abc import ABC, abstractmethod
from typing import Dict, Optional, Tuple, Callable

import agate
from dbt.contracts.graph.nodes import ManifestNode

from recce.state import ArtifactsRoot

logger = logging.getLogger('uvicorn')


class BaseAdapter(ABC):
    @abstractmethod
    def generate_sql(self, sql_template: str, base: bool = False, context: Dict = {}):
        raise NotImplementedError()

    @abstractmethod
    def execute(
        self,
        sql: str,
        auto_begin: bool = False,
        fetch: bool = False,
        limit: Optional[int] = None
    ) -> Tuple[any, agate.Table]:
        raise NotImplementedError()

    @abstractmethod
    def get_lineage(self, base: Optional[bool] = False):
        raise NotImplementedError()

    @abstractmethod
    def get_model(self, model_id: str, base=False):
        raise NotImplementedError()

    @abstractmethod
    def start_monitor_artifacts(self, callback: Callable = None):
        pass

    @abstractmethod
    def stop_monitor_artifacts(self):
        pass

    @abstractmethod
    def refresh(self, refresh_file_path: str = None):
        pass

    @abstractmethod
    def export_artifacts(self) -> ArtifactsRoot:
        return ArtifactsRoot(base={}, current={})

    @abstractmethod
    def import_artifacts(self, artifacts: ArtifactsRoot):
        pass

    def find_node_by_name(self, node_name, base=False) -> Optional[ManifestNode]:
        logger.info("Deprecated method find_node_by_name. It returns dbt's type")
        manifest = self.curr_manifest if base is False else self.base_manifest
        for key, node in manifest.nodes.items():
            if node.name == node_name:
                return node

        return None

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
