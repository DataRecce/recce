import os
from dataclasses import dataclass
from typing import Optional

import pandas as pd
from dbt.adapters.factory import get_adapter_by_type
from dbt.adapters.sql import SQLAdapter
from dbt.cli.main import dbtRunner
from dbt.config.profile import Profile
from dbt.config.project import Project
from dbt.config.runtime import load_profile, load_project
from dbt.contracts.graph.manifest import WritableManifest, Manifest
from dbt.contracts.graph.nodes import ResultNode, SourceDefinition, ManifestNode
from dbt.contracts.results import CatalogArtifact


def load_manifest(path):
    if not os.path.isfile(path):
        return None
    return WritableManifest.read_and_check_versions(path)


def load_catalog(path):
    if not os.path.isfile(path):
        return None
    return CatalogArtifact.read_and_check_versions(path)


@dataclass
class DBTContext:
    profile: Profile = None
    project: Project = None
    adapter: SQLAdapter = None
    manifest: Manifest = None
    curr_manifest: WritableManifest = None
    curr_catalog: CatalogArtifact = None
    base_manifest: WritableManifest = None
    base_catalog: CatalogArtifact = None

    @classmethod
    def load(cls, target=None):

        # We need to run the dbt parse command because
        # 1. load the dbt profiles by dbt-core rule
        # 2. initialize the adapter
        parseResult = dbtRunner().invoke(["-q", "parse"])
        manifest = parseResult.result

        project_path = os.getcwd()
        profile = load_profile(project_path, {}, target_override=target)
        project = load_project(project_path, False, profile)

        adapter: SQLAdapter = get_adapter_by_type(profile.credentials.type)

        dbt_context = cls(profile=profile,
                          project=project,
                          adapter=adapter,
                          manifest=manifest)
        dbt_context.load_artifacts()

        if not dbt_context.curr_manifest:
            raise Exception('Cannot load "target/manifest.json"')
        if not dbt_context.base_manifest:
            raise Exception('Cannot load "target-base/manifest.json"')

        return dbt_context

    def get_columns(self, node: ResultNode):
        relation = self.adapter.Relation.create_from(self.project, node)
        return self.adapter.execute_macro(
            'get_columns_in_relation',
            kwargs={"relation": relation},
            manifest=self.manifest)

    def load_artifacts(self):
        """
        Load the artifacts from the 'target' and 'target-base' directory
        """
        target_path = self.project.target_path
        target_base_path = 'target-base'

        curr_manifest = load_manifest(os.path.join(target_path, 'manifest.json'))
        curr_catalog = load_catalog(os.path.join(target_path, 'catalog.json'))
        base_manifest = load_manifest(os.path.join(target_base_path, 'manifest.json'))
        base_catalog = load_catalog(os.path.join(target_base_path, 'catalog.json'))

        # set the value if all the artifacts are loaded successfully
        self.curr_manifest = curr_manifest
        self.curr_catalog = curr_catalog
        self.base_manifest = base_manifest
        self.base_catalog = base_catalog

    def find_node_by_name(self, node_name, base=False) -> Optional[ManifestNode]:

        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, node in manifest.nodes.items():
            if node.name == node_name:
                return node

        return None

    def find_source_by_name(self, source_name, table_name, base=False) -> Optional[SourceDefinition]:

        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, source in manifest.sources.items():
            if source.source_name == source_name and source.name == table_name:
                return source

        return None

    def execute_sql(self, sql_template, base=False) -> pd.DataFrame:
        from jinja2 import Template
        import agate

        def ref(node_name):
            node = self.find_node_by_name(node_name, base)
            if node is None:
                raise Exception(f"reference not found: \"{node_name}\"")
            if node.resource_type != 'model' and node.resource_type != 'seed':
                raise Exception(f"reference is not a model or seed: \"{node_name}\"")

            relation = self.adapter.Relation.create_from(self.project, node)
            return str(relation)

        def source(source_name, table_name):
            source = self.find_source_by_name(source_name, table_name, base)
            if source is None:
                raise Exception(f"source not found: \"{source_name}.{table_name}\"")

            relation = self.adapter.Relation.create_from(self.project, source)
            return str(relation)

        template = Template(sql_template)
        sql = template.render(ref=ref, source=source)

        adapter = self.adapter
        with adapter.connection_named('test'):
            response, result = adapter.execute(sql, fetch=True, auto_begin=True)
            table: agate.Table = result
            df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
            return df

    def get_lineage(self, base: Optional[bool] = False):

        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog

        manifest_dict = manifest.to_dict()

        parent_map = {k: v for k, v in manifest_dict['parent_map'].items() if not k.startswith('test.')}

        nodes = {}

        for node in manifest_dict['nodes'].values():
            unique_id = node['unique_id']
            if node['resource_type'] == 'test':
                continue

            nodes[unique_id] = {
                'id': node['unique_id'],
                'name': node['name'],
                'resource_type': node['resource_type'],
                'package_name': node['package_name'],
                'checksum': node['checksum'],
                'raw_code': node['raw_code'],
            }

            if catalog is not None and unique_id in catalog.nodes:
                nodes[unique_id]['columns'] = catalog.nodes[unique_id].columns

        for source in manifest_dict['sources'].values():
            unique_id = source['unique_id']

            nodes[unique_id] = {
                'id': source['unique_id'],
                'name': source['name'],
                'resource_type': source['resource_type'],
                'package_name': source['package_name'],
            }

            if catalog is not None and unique_id in catalog.sources:
                nodes[unique_id]['columns'] = catalog.sources[unique_id].columns

        for exposure in manifest_dict['exposures'].values():
            nodes[exposure['unique_id']] = {
                'id': exposure['unique_id'],
                'name': exposure['name'],
                'resource_type': exposure['resource_type'],
                'package_name': exposure['package_name'],
            }
        for metric in manifest_dict['metrics'].values():
            nodes[metric['unique_id']] = {
                'id': metric['unique_id'],
                'name': metric['name'],
                'resource_type': metric['resource_type'],
                'package_name': metric['package_name'],
            }

        if 'semantic_models' in manifest_dict:
            for semantic_models in manifest_dict['semantic_models'].values():
                nodes[semantic_models['unique_id']] = {
                    'id': semantic_models['unique_id'],
                    'name': semantic_models['name'],
                    'resource_type': semantic_models['resource_type'],
                    'package_name': semantic_models['package_name'],
                }

        return dict(parent_map=parent_map, nodes=nodes)
