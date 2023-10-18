import os
import tempfile
from dataclasses import dataclass

from dbt.adapters.factory import get_adapter_by_type
from dbt.adapters.sql import SQLAdapter
from dbt.cli.main import dbtRunner
from dbt.config.runtime import load_profile, load_project
from dbt.contracts.graph.manifest import WritableManifest, Manifest
from dbt.config.project import Project
from dbt.config.profile import Profile


@dataclass
class DBTContext:
    profile: Profile
    project: Project
    adapter: SQLAdapter
    manifest: Manifest
    curr_manifest: WritableManifest = None
    base_manifest: WritableManifest = None

    @classmethod
    def load(cls, target=None):
        project_path = os.getcwd()

        with tempfile.TemporaryDirectory() as temp_dir:
            parseResult = dbtRunner().invoke(["-q", "parse", "--target-path", temp_dir])

        manifest = parseResult.result
        profile = load_profile(project_path, {}, target_override=target)
        project = load_project(project_path, False, profile)
        adapter: SQLAdapter = get_adapter_by_type(profile.credentials.type)

        # To overwrite the manfiest because we need the compiled analysis code
        curr_manifest = WritableManifest.read_and_check_versions('target/manifest.json')
        base_manifest = WritableManifest.read_and_check_versions('target-base/manifest.json')

        return cls(profile=profile,
                   project=project,
                   adapter=adapter,
                   manifest=manifest,
                   curr_manifest=curr_manifest,
                   base_manifest=base_manifest)

    def find_resource_by_name(self, resource_name, base=False):

        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, node in manifest.nodes.items():
            if node.name == resource_name:
                return node

        return None
