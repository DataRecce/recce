import os
from dataclasses import dataclass

from dbt.adapters.base import BaseRelation
from dbt.adapters.factory import get_adapter_by_type
from dbt.adapters.sql import SQLAdapter
from dbt.cli.main import dbtRunner
from dbt.config.runtime import load_profile, load_project
from dbt.contracts.graph.manifest import WritableManifest, Manifest, ModelNode
from dbt.config.project import Project
from dbt.config.profile import Profile

@dataclass
class DBTContext:
    profile: Profile
    project: Project
    adapter: SQLAdapter
    manifest: Manifest
    base_manifest: WritableManifest = None

    @classmethod
    def load(cls, target=None):
        project_path = os.getcwd()
        parseResult = dbtRunner().invoke(["-q", "parse"])
        manifest = parseResult.result
        profile = load_profile(project_path, {}, target_override=target)
        adapter: SQLAdapter = get_adapter_by_type(profile.credentials.type)

        base_manifest = WritableManifest.read_and_check_versions('target-base/manifest.json')

        return cls(profile=profile, project=profile, adapter=adapter, manifest=manifest, base_manifest=base_manifest)


    def find_model_by_name(self, resource_name, base=False) -> ModelNode:
        if base is True:
            manifest = self.base_manifest
        else:
            manifest = self.manifest.writable_manifest()

        for key, node in manifest.nodes.items():
            if node.name == resource_name and node.resource_type == "model":
                return node

        return None