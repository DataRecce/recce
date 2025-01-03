import logging
from abc import ABC, abstractmethod
from typing import Optional, Callable, Set, Literal

from recce.state import ArtifactsRoot

# from dbt.contracts.graph.nodes import ManifestNode

logger = logging.getLogger('uvicorn')


class BaseAdapter(ABC):

    @classmethod
    def load(cls, **kwargs):
        raise NotImplementedError()

    @abstractmethod
    def get_lineage(self, base: Optional[bool] = False):
        raise NotImplementedError()

    @abstractmethod
    def select_nodes(
        self,
        select: Optional[str] = None,
        exclude: Optional[str] = None,
        packages: Optional[list[str]] = None,
        view_mode: Optional[Literal['all', 'changed_models']] = None,
    ) -> Set[str]:
        raise NotImplementedError()

    @abstractmethod
    def get_model(self, model_id: str, base=False):
        raise NotImplementedError()

    @abstractmethod
    def get_node_name_by_id(self, unique_id):
        raise NotImplementedError()

    @abstractmethod
    def support_tasks(self):
        """
        Get the adapter support tasks. Should be implemented by subclass.
        The tasks support map is a dictionary that maps all the Recce tasks are supported by the adapter or not.
        True means supported, False means not supported.
        """
        raise NotImplementedError()

    def start_monitor_artifacts(self, callback: Callable = None):
        pass

    def stop_monitor_artifacts(self):
        pass

    def start_monitor_base_env(self, callback: Callable = None):
        pass

    def stop_monitor_base_env(self):
        pass

    def refresh(self, refresh_file_path: str = None):
        pass

    def export_artifacts(self) -> ArtifactsRoot:
        return ArtifactsRoot(base={}, current={})

    def import_artifacts(self, artifacts: ArtifactsRoot, merge: bool = False):
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
