import hashlib
import logging
import os
import time
from dataclasses import dataclass, fields
from typing import Callable, Dict, List, Optional, Union

import agate
import pandas as pd
from dbt.adapters.factory import get_adapter_by_type
from dbt.adapters.sql import SQLAdapter
from dbt.cli.main import dbtRunner
from dbt.config.profile import Profile
from dbt.config.project import Project, package_config_from_data
from dbt.config.renderer import PackageRenderer
from dbt.config.runtime import load_profile, load_project
from dbt.contracts.files import FileHash
from dbt.contracts.graph.manifest import Manifest, WritableManifest
from dbt.contracts.graph.model_config import ContractConfig, NodeConfig
from dbt.contracts.graph.nodes import Contract, DependsOn, ManifestNode, ModelNode, ResultNode, SourceDefinition
from dbt.contracts.graph.unparsed import Docs
from dbt.contracts.results import CatalogArtifact
from dbt.deps.base import downloads_directory
from dbt.deps.resolver import resolve_packages
from dbt.node_types import AccessType, ModelLanguage, NodeType
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

logger = logging.getLogger('uvicorn')


class ArtifactsEventHandler(FileSystemEventHandler):
    def __init__(self, watch_files: List[str], callback: Callable = None):
        super().__init__()
        self.watch_files = watch_files
        self.callback = callback

    def on_modified(self, event):
        if event.is_directory:
            return None

        if event.src_path in self.watch_files:
            if callable(self.callback):
                self.callback(event)

    def on_created(self, event):
        if event.is_directory:
            return None

        if event.src_path in self.watch_files:
            if callable(self.callback):
                self.callback(event)


class DbtVersionTool:

    def __init__(self):
        from dbt import version as dbt_version
        self.dbt_version = self.parse(dbt_version.__version__)

    @staticmethod
    def parse(version: str):
        from packaging import version as v
        return v.parse(version)

    def as_version(self, other):
        from packaging.version import Version
        if isinstance(other, Version):
            return other
        if isinstance(other, str):
            return self.parse(other)
        return self.parse(str(other))

    def __ge__(self, other):
        return self.dbt_version >= self.as_version(other)

    def __gt__(self, other):
        return self.dbt_version > self.as_version(other)

    def __lt__(self, other):
        return self.dbt_version < self.as_version(other)

    def __le__(self, other):
        return self.dbt_version <= self.as_version(other)

    def __eq__(self, other):
        return self.dbt_version.release[:2] == self.as_version(other).release[:2]

    def __str__(self):
        return ".".join([str(x) for x in list(self.dbt_version.release)])


dbt_version = DbtVersionTool()


def _fake_node(package_name: str, raw_code: str, depends_nodes: List):
    def has_field(field_name):
        return field_name in {f.name for f in fields(NodeConfig)}

    node_config = None
    if has_field('on_configuration_change'):
        from dbt.contracts.graph.model_config import OnConfigurationChangeOption
        node_config = NodeConfig(_extra={}, enabled=True, alias=None, schema=None, database=None, tags=[], meta={},
                                 group=None, materialized='view', incremental_strategy=None, persist_docs={},
                                 post_hook=[],
                                 pre_hook=[], quoting={}, column_types={}, full_refresh=None, unique_key=None,
                                 on_schema_change='ignore',
                                 on_configuration_change=OnConfigurationChangeOption.Apply, grants={}, packages=[],
                                 docs=Docs(show=True, node_color=None), contract=ContractConfig(enforced=False))
    else:
        node_config = NodeConfig(_extra={}, enabled=True, alias=None, schema=None, database=None, tags=[], meta={},
                                 group=None, materialized='view', incremental_strategy=None, persist_docs={},
                                 post_hook=[],
                                 pre_hook=[], quoting={}, column_types={}, full_refresh=None, unique_key=None,
                                 on_schema_change='ignore', grants={}, packages=[],
                                 docs=Docs(show=True, node_color=None), contract=ContractConfig(enforced=False))

    sha256 = hashlib.sha256(package_name.encode())
    file_hash = FileHash(name='sha256', checksum=sha256.hexdigest())
    return _build_model(depends_nodes, file_hash, node_config, package_name, raw_code)


def _build_model(depends_nodes, file_hash, node_config, package_name, raw_code):
    data = dict(database='', schema='', name='',
                resource_type=NodeType.Model, package_name=package_name, path=f'generated/{package_name}.sql',
                original_file_path=f'models/generated/{package_name}.sql',
                unique_id=f'model.recce.generated.{package_name}',
                fqn=['reccee', 'staging', package_name],
                alias=package_name, checksum=file_hash,
                config=node_config, _event_status={}, tags=[], description='', columns={}, meta={}, group=None,
                patch_path=None, build_path=None, deferred=False, unrendered_config={},
                created_at=time.time(), config_call_dict={},
                relation_name=None,
                raw_code=raw_code,
                language=ModelLanguage.sql, refs=[], sources=[], metrics=[],
                depends_on=DependsOn(macros=[], nodes=depends_nodes),
                compiled_path=None, compiled=False,
                compiled_code=None, extra_ctes_injected=False, extra_ctes=[], _pre_injected_sql=None,
                contract=Contract(
                    enforced=False,
                    checksum=None), access=AccessType.Protected, constraints=[], version=None, latest_version=None,
                defer_relation=None)

    model_fields = {field.name for field in fields(ModelNode)}
    filtered_data = {k: v for k, v in data.items() if k in model_fields}

    return ModelNode(**filtered_data)


def generate_compiled_sql(manifest: Union[Manifest, WritableManifest], adapter, sql, context: Dict = None):
    if context is None:
        context = {}

    package_names = [x.package_name for x in manifest.nodes.values() if isinstance(x, ModelNode)]
    possible_useful_nodes = [x for x in manifest.nodes if x.startswith('model.')]
    node = _fake_node(package_names[0], sql, possible_useful_nodes)
    compiler = adapter.get_compiler()

    def as_manifest(m):
        if not isinstance(m, WritableManifest):
            return m

        data = m.__dict__
        all_fields = set([x.name for x in fields(Manifest)])
        new_data = {k: v for k, v in data.items() if k in all_fields}
        return Manifest(**new_data)

    x: ModelNode = compiler.compile_node(node, as_manifest(manifest), context)
    return x.compiled_code


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
    target_path: str = None
    curr_manifest: WritableManifest = None
    curr_catalog: CatalogArtifact = None
    base_path: str = None
    base_manifest: WritableManifest = None
    base_catalog: CatalogArtifact = None
    artifacts_observer = Observer()
    artifacts_files = []

    @classmethod
    def packages_downloader(cls, project: Project):
        # reference from dbt-core tasks/deps.py

        os.environ["DBT_MACRO_DEBUGGING"] = "false"
        os.environ["DBT_VERSION_CHECK"] = "false"

        renderer = PackageRenderer({})
        packages_lock_dict = {'packages': [{'package': 'dbt-labs/audit_helper', 'version': '0.9.0'}]}
        packages_lock_config = package_config_from_data(
            renderer.render_data(packages_lock_dict), packages_lock_dict
        ).packages

        lock_defined_deps = resolve_packages(packages_lock_config, project, {})
        with downloads_directory():
            for package in lock_defined_deps:
                package.install(project, renderer)

    @classmethod
    def load(cls, **kwargs):
        # We need to run the dbt parse command because
        # 1. load the dbt profiles by dbt-core rule
        # 2. initialize the adapter
        cmd = ["-q", "parse"]
        target = kwargs.get('target')
        profile_name = kwargs.get('profile')
        project_dir = kwargs.get('project_dir')
        profiles_dir = kwargs.get('profiles_dir')

        if target:
            cmd.extend(["--target", target])
        if profile_name:
            cmd.extend(["--profile", profile_name])
        if project_dir:
            cmd.extend(["--project-dir", project_dir])
        if profiles_dir:
            cmd.extend(["--profiles-dir", profiles_dir])
        parse_result = dbtRunner().invoke(cmd)
        manifest = parse_result.result

        if project_dir is None:
            project_path = os.getcwd()
        else:
            project_path = project_dir

        # The option 'profiles_dir' will be added into dbt global flags when we invoke dbt parse.
        # The function 'load_profile' will use the global flags to load the profile.
        profile = load_profile(project_path, {}, profile_name_override=profile_name, target_override=target)
        project = load_project(project_path, False, profile)

        packages = [x.package for x in project.packages.packages]
        if not kwargs.get('skip_download', False) and 'dbt-labs/audit_helper' not in packages:
            cls.packages_downloader(project)
            return cls.load(**dict(skip_download=True, **kwargs))

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
        project_root = self.project.project_root
        target_path = self.project.target_path
        target_base_path = 'target-base'
        self.target_path = os.path.join(project_root, target_path)
        self.base_path = os.path.join(project_root, target_base_path)

        # load the artifacts
        curr_manifest = load_manifest(os.path.join(project_root, target_path, 'manifest.json'))
        curr_catalog = load_catalog(os.path.join(project_root, target_path, 'catalog.json'))
        base_manifest = load_manifest(os.path.join(project_root, target_base_path, 'manifest.json'))
        base_catalog = load_catalog(os.path.join(project_root, target_base_path, 'catalog.json'))

        # set the value if all the artifacts are loaded successfully
        self.curr_manifest = curr_manifest
        self.curr_catalog = curr_catalog
        self.base_manifest = base_manifest
        self.base_catalog = base_catalog

        # set the file paths to watch
        self.artifacts_files = [
            os.path.join(project_root, target_path, 'manifest.json'),
            os.path.join(project_root, target_path, 'catalog.json'),
            os.path.join(project_root, target_base_path, 'manifest.json'),
            os.path.join(project_root, target_base_path, 'catalog.json'),
        ]

    def find_node_by_name(self, node_name, base=False) -> Optional[ManifestNode]:

        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, node in manifest.nodes.items():
            if node.name == node_name:
                return node

        return None

    def get_manifest(self, base: bool):
        return self.curr_manifest if base is False else self.base_manifest

    def find_source_by_name(self, source_name, table_name, base=False) -> Optional[SourceDefinition]:

        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, source in manifest.sources.items():
            if source.source_name == source_name and source.name == table_name:
                return source

        return None

    def execute_sql(self, sql_template, base=False) -> pd.DataFrame:
        adapter = self.adapter
        with adapter.connection_named('test'):
            sql = self.generate_sql(sql_template, base)
            response, result = adapter.execute(sql, fetch=True, auto_begin=True)
            table: agate.Table = result
            df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
            return df

    def generate_sql(self, sql_template, base):
        try:
            return generate_compiled_sql(self.get_manifest(base), self.adapter, sql_template, {})
        except BaseException as e:
            if hasattr(e, 'msg'):
                if 'depends on' in e.msg:
                    message_from = e.msg.index('depends on')
                    raise Exception(e.msg[message_from:])
            raise e

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

    def start_monitor_artifacts(self, callback: Callable = None):
        event_handler = ArtifactsEventHandler(self.artifacts_files, callback=callback)
        self.artifacts_observer.schedule(event_handler, self.target_path, recursive=False)
        self.artifacts_observer.schedule(event_handler, self.base_path, recursive=False)
        self.artifacts_observer.start()
        logger.info('Started monitoring dbt artifacts')

    def stop_monitor_artifacts(self):
        self.artifacts_observer.stop()
        self.artifacts_observer.join()
        logger.info('Stopped monitoring artifacts')

    def refresh(self, refresh_file_path: str = None):
        if refresh_file_path is None:
            return self.load_artifacts()

        target_type = refresh_file_path.split('/')[-2]
        if target_type == os.path.basename(self.target_path):
            if refresh_file_path.endswith('manifest.json'):
                self.curr_manifest = load_manifest(refresh_file_path)
            elif refresh_file_path.endswith('catalog.json'):
                self.curr_catalog = load_catalog(refresh_file_path)
        elif target_type == os.path.basename(self.base_path):
            if refresh_file_path.endswith('manifest.json'):
                self.base_manifest = load_manifest(refresh_file_path)
            elif refresh_file_path.endswith('catalog.json'):
                self.base_catalog = load_catalog(refresh_file_path)

    def compare_all_columns(self, primary_key: str, model: str):
        # find the relation names
        base_relation = self.generate_sql(f'{{{{ ref("{model}")  }}}}', True)

        # https://github.com/dbt-labs/dbt-audit-helper/tree/0.9.0/#compare_column_values-source
        #   {{
        #     audit_helper.compare_all_columns(
        #       a_relation=ref('stg_customers'),
        #       b_relation=api.Relation.create(database='dbt_db', schema='analytics_prod', identifier='stg_customers'),
        #       exclude_columns=['updated_at'],
        #       primary_key='id'
        #     )
        #   }}

        sql_template = f"""
        {{{{
            audit_helper.compare_all_columns(
                a_relation=ref('{model}'),
                b_relation='{base_relation}',
                primary_key='{primary_key}'
            )
        }}}}
        """
        return self.execute_sql(sql_template, False)
