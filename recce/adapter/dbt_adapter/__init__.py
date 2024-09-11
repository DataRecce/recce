import json
import logging
import os
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, fields
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple, Iterator, Any, Set, Union

import agate
import dbt.adapters.factory
from dbt.contracts.state import PreviousState
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from recce.adapter.base import BaseAdapter
from recce.state import ArtifactsRoot
from .dbt_version import DbtVersion

# Reference: https://github.com/AltimateAI/vscode-dbt-power-user/blob/master/dbt_core_integration.py

get_adapter_orig = dbt.adapters.factory.get_adapter


def get_adapter(config):
    if hasattr(config, 'adapter'):
        return config.adapter
    else:
        return get_adapter_orig(config)


dbt.adapters.factory.get_adapter = get_adapter

# All dbt import should after overwriting the get_adapter
from dbt.adapters.base import Column  # noqa: E402
from dbt.adapters.factory import get_adapter_class_by_name  # noqa: E402
from dbt.adapters.sql import SQLAdapter  # noqa: E402
from dbt.config.runtime import RuntimeConfig  # noqa: E402
from dbt.contracts.graph.manifest import Manifest, WritableManifest, MacroManifest  # noqa: E402
from dbt.contracts.graph.nodes import ManifestNode  # noqa: E402
from dbt.contracts.results import CatalogArtifact  # noqa: E402
from dbt.flags import set_from_args  # noqa: E402
from dbt.parser.manifest import process_node  # noqa: E402
from dbt.parser.sql import SqlBlockParser  # noqa: E402

dbt_version = DbtVersion()

if dbt_version < 'v1.8':
    from dbt.contracts.connection import Connection
else:
    from dbt.adapters.contracts.connection import Connection


@contextmanager
def silence_no_nodes_warning():
    if dbt_version >= 'v1.8':
        from dbt.events.types import NoNodesForSelectionCriteria
        from dbt_common.events.functions import WARN_ERROR_OPTIONS
        WARN_ERROR_OPTIONS.silence.append(NoNodesForSelectionCriteria.__name__)
    try:
        yield
    finally:
        if dbt_version >= 'v1.8':
            from dbt_common.events.functions import WARN_ERROR_OPTIONS
            WARN_ERROR_OPTIONS.silence.pop()


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


def merge_tables(tables: List[agate.Table]) -> agate.Table:
    if dbt_version < 'v1.8':
        from dbt.clients.agate_helper import merge_tables
        return merge_tables(tables)
    else:
        from dbt_common.clients.agate_helper import merge_tables
        return merge_tables(tables)


def as_manifest(m: WritableManifest) -> Manifest:
    if dbt_version < 'v1.8':
        data = m.__dict__
        all_fields = set([x.name for x in fields(Manifest)])
        new_data = {k: v for k, v in data.items() if k in all_fields}
        return Manifest(**new_data)
    else:
        return Manifest.from_writable_manifest(m)


def load_manifest(path: str = None, data: dict = None):
    if path is not None:
        if not os.path.isfile(path):
            return None
        return WritableManifest.read_and_check_versions(path)
    if data is not None:
        return WritableManifest.upgrade_schema_version(data)


def load_catalog(path: str = None, data: dict = None):
    if path is not None:
        if not os.path.isfile(path):
            return None
        return CatalogArtifact.read_and_check_versions(path)
    if data is not None:
        return CatalogArtifact.upgrade_schema_version(data)


def previous_state(state_path: Path, target_path: Path, project_root: Path) -> PreviousState:
    if dbt_version < 'v1.5.2':
        return PreviousState(state_path, target_path)
    else:
        return PreviousState(state_path, target_path, project_root)


def default_profiles_dir():
    # Precedence: DBT_PROFILES_DIR > current working directory > ~/.dbt/
    # https://docs.getdbt.com/docs/core/connect-data-platform/connection-profiles#advanced-customizing-a-profile-directory
    if os.getenv('DBT_PROFILES_DIR'):
        return os.getenv('DBT_PROFILES_DIR')
    elif os.path.exists(os.path.join(os.getcwd(), 'profiles.yml')):
        return os.getcwd()
    else:
        return os.path.expanduser('~/.dbt/')


@dataclass()
class DbtArgs:
    """
    Used for RuntimeConfig.from_args
    """
    threads: Optional[int] = 1,
    target: Optional[str] = None,
    profiles_dir: Optional[str] = None,
    project_dir: Optional[str] = None,
    profile: Optional[str] = None,
    target_path: Optional[str] = None,
    project_only_flags: Optional[Dict[str, Any]] = None
    which: Optional[str] = None


@dataclass
class DbtAdapter(BaseAdapter):
    runtime_config: RuntimeConfig = None
    adapter: SQLAdapter = None
    manifest: Manifest = None
    previous_state: PreviousState = None
    target_path: str = None
    curr_manifest: WritableManifest = None
    curr_catalog: CatalogArtifact = None
    base_path: str = None
    base_manifest: WritableManifest = None
    base_catalog: CatalogArtifact = None

    # Review mode
    review_mode: bool = False

    # Watch the artifact change
    artifacts_observer = Observer()
    artifacts_files = []

    @classmethod
    def load(cls,
             no_artifacts=False,
             review=False,
             **kwargs):

        target = kwargs.get('target')
        profile_name = kwargs.get('profile')
        project_dir = kwargs.get('project_dir')
        profiles_dir = kwargs.get('profiles_dir')

        if profiles_dir is None:
            profiles_dir = default_profiles_dir()

        # runtime_config
        args = DbtArgs(
            threads=1,
            target=target,
            target_path='target',
            project_dir=project_dir,
            profiles_dir=profiles_dir,
            profile=profile_name,
            project_only_flags={},
            which='list'
        )
        set_from_args(args, args)

        from dbt.exceptions import DbtProjectError
        try:
            # adapter
            if dbt_version < 'v1.8':
                runtime_config = RuntimeConfig.from_args(args)
                adapter_name = runtime_config.credentials.type
                adapter_cls = get_adapter_class_by_name(adapter_name)
                adapter: SQLAdapter = adapter_cls(runtime_config)
            else:
                from dbt_common.context import set_invocation_context, get_invocation_context
                from dbt.mp_context import get_mp_context

                set_invocation_context({})
                get_invocation_context()._env = dict(os.environ)
                runtime_config = RuntimeConfig.from_args(args)
                adapter_name = runtime_config.credentials.type
                adapter_cls = get_adapter_class_by_name(adapter_name)
                adapter: SQLAdapter = adapter_cls(runtime_config, get_mp_context())

            adapter.connections.set_connection_name()
            runtime_config.adapter = adapter

            dbt_adapter = cls(
                runtime_config=runtime_config,
                adapter=adapter,
                review_mode=review,
            )
        except DbtProjectError as e:
            raise e

        # Load the artifacts from the state file or `target` and `target-base` directory
        if not no_artifacts and not review:
            dbt_adapter.load_artifacts()
            if not dbt_adapter.curr_manifest:
                raise Exception('Cannot load "target/manifest.json"')
            if not dbt_adapter.base_manifest:
                raise Exception('Cannot load "target-base/manifest.json"')
        return dbt_adapter

    def print_lineage_info(self):
        print("Base:")
        print(f"    Manifest: {self.base_manifest.metadata.generated_at}")
        print(f"    Catalog:  {self.base_catalog.metadata.generated_at if self.base_catalog else 'N/A'}")

        print("Current:")
        print(f"    Manifest: {self.curr_manifest.metadata.generated_at}")
        print(f"    Catalog:  {self.curr_catalog.metadata.generated_at if self.curr_catalog else 'N/A'}")

    def get_columns(self, model: str, base=False) -> List[Column]:
        relation = self.create_relation(model, base)
        if dbt_version < 'v1.8':
            return self.adapter.execute_macro(
                'get_columns_in_relation',
                kwargs={"relation": relation},
                manifest=self.manifest)
        else:
            from dbt.context.providers import generate_runtime_macro_context
            macro_manifest = MacroManifest(self.manifest.macros)
            self.adapter.set_macro_resolver(macro_manifest)
            self.adapter.set_macro_context_generator(generate_runtime_macro_context)
            return self.adapter.execute_macro(
                'get_columns_in_relation',
                kwargs={"relation": relation})

    def get_model(self, model_id: str, base=False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        node = manifest_dict['nodes'].get(model_id)
        if node is None:
            return {}

        node_name = node['name']
        with self.adapter.connection_named('model'):
            columns = [column for column in self.get_columns(node_name, base=base)]

        child_map: List[str] = manifest_dict['child_map'][model_id]
        cols_not_null = []
        cols_unique = []

        for child in child_map:
            comps = child.split('.')
            child_type = comps[0]
            child_name = comps[2]

            not_null_prefix = f'not_null_{node_name}_'
            if child_type == 'test' and child_name.startswith(not_null_prefix):
                cols_not_null.append(child_name[len(not_null_prefix):])
            unique_prefix = f'unique_{node_name}_'
            if child_type == 'test' and child_name.startswith(unique_prefix):
                cols_unique.append(child_name[len(unique_prefix):])

        columns_info = {}
        primary_key = None
        for c in columns:
            col_name = c.column
            col = dict(name=col_name, type=c.dtype)
            if col_name in cols_not_null:
                col['not_null'] = True
            if col_name in cols_unique:
                col['unique'] = True
                if not primary_key:
                    primary_key = col_name
            columns_info[col_name] = col

        result = dict(columns=columns_info)
        if primary_key:
            result['primary_key'] = primary_key

        return result

    def load_artifacts(self):
        """
        Load the artifacts from the 'target' and 'target-base' directory
        """
        if self.runtime_config is None:
            raise Exception('Cannot find the dbt project configuration')

        project_root = self.runtime_config.project_root
        target_path = self.runtime_config.target_path
        target_base_path = 'target-base'
        self.target_path = os.path.join(project_root, target_path)
        self.base_path = os.path.join(project_root, target_base_path)

        # load the artifacts
        path = os.path.join(project_root, target_path, 'manifest.json')
        curr_manifest = load_manifest(path=path)
        if curr_manifest is None:
            raise Exception(f'Cannot load the current manifest: {path}')
        path = os.path.join(project_root, target_base_path, 'manifest.json')
        base_manifest = load_manifest(path=path)
        if base_manifest is None:
            raise Exception(f'Cannot load the base manifest: {path}')

        curr_catalog = load_catalog(path=os.path.join(project_root, target_path, 'catalog.json'))
        base_catalog = load_catalog(path=os.path.join(project_root, target_base_path, 'catalog.json'))

        # set the value if all the artifacts are loaded successfully
        self.curr_manifest = curr_manifest
        self.curr_catalog = curr_catalog
        self.base_manifest = base_manifest
        self.base_catalog = base_catalog

        # set the manifest
        self.manifest = as_manifest(curr_manifest)
        self.previous_state = previous_state(
            Path('target-base'),
            Path(self.runtime_config.target_path),
            Path(self.runtime_config.project_root),
        )

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

    def get_node_name_by_id(self, unique_id):
        if unique_id.startswith('source.'):
            if unique_id in self.curr_manifest.sources:
                return self.curr_manifest.sources[unique_id].name
            elif unique_id in self.base_manifest.sources:
                return self.base_manifest.sources[unique_id].name
        else:
            if unique_id in self.curr_manifest.nodes:
                return self.curr_manifest.nodes[unique_id].name
            elif unique_id in self.base_manifest.nodes:
                return self.base_manifest.nodes[unique_id].name
            return None

    def get_manifest(self, base: bool):
        return self.curr_manifest if base is False else self.base_manifest

    def generate_sql(self, sql_template: str, base: bool = False, context: Dict = {}):
        manifest = as_manifest(self.get_manifest(base))
        parser = SqlBlockParser(self.runtime_config, manifest, self.runtime_config)

        if dbt_version >= dbt_version.parse('v1.8'):
            from dbt_common.context import set_invocation_context
            set_invocation_context({})

        node_id = str("generated_" + uuid.uuid4().hex)
        node = parser.parse_remote(sql_template, node_id)
        process_node(self.runtime_config, manifest, node)

        if dbt_version < dbt_version.parse('v1.8'):
            compiler = self.adapter.get_compiler()
            compiler.compile_node(node, manifest, context)
            return node.compiled_code
        else:
            from dbt.context.providers import generate_runtime_model_context
            from dbt.clients import jinja
            jinja_ctx = generate_runtime_model_context(node, self.runtime_config, manifest)
            jinja_ctx.update(context)
            compiled_code = jinja.get_rendered(sql_template, jinja_ctx, node)
            return compiled_code

    def execute(self, sql: str, auto_begin: bool = False, fetch: bool = False, limit: Optional[int] = None) -> Tuple[
        any, agate.Table]:
        if dbt_version < dbt_version.parse('v1.6'):
            return self.adapter.execute(sql, auto_begin=auto_begin, fetch=fetch)

        return self.adapter.execute(sql, auto_begin=auto_begin, fetch=fetch, limit=limit)

    def get_lineage(self, base: Optional[bool] = False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog
        manifest_metadata = manifest.metadata if manifest is not None else None
        catalog_metadata = catalog.metadata if catalog is not None else None

        manifest_dict = manifest.to_dict()

        nodes = {}

        for node in manifest_dict['nodes'].values():
            unique_id = node['unique_id']
            resource_type = node['resource_type']

            if resource_type not in ['model', 'seed', 'exposure', 'snapshot']:
                continue

            nodes[unique_id] = {
                'id': node['unique_id'],
                'name': node['name'],
                'resource_type': node['resource_type'],
                'package_name': node['package_name'],
                'schema': node['schema'],
                'config': node['config'],
                'checksum': node['checksum'],
                'raw_code': node['raw_code'],
            }

            # List of <type>.<package_name>.<node_name>.<hash>
            # model.jaffle_shop.customer_segments
            # test.jaffle_shop.not_null_customers_customer_id.5c9bf9911d
            # test.jaffle_shop.unique_customers_customer_id.c5af1ff4b1
            child_map: List[str] = manifest_dict['child_map'][unique_id]
            cols_not_null = []
            cols_unique = []

            for child in child_map:
                node_name = node['name']
                comps = child.split('.')
                if len(comps) < 2:
                    # only happens in unittest
                    continue

                child_type = comps[0]
                child_name = comps[2]

                not_null_prefix = f'not_null_{node_name}_'
                if child_type == 'test' and child_name.startswith(not_null_prefix):
                    cols_not_null.append(child_name[len(not_null_prefix):])
                unique_prefix = f'unique_{node_name}_'
                if child_type == 'test' and child_name.startswith(unique_prefix):
                    cols_unique.append(child_name[len(unique_prefix):])

            if catalog is not None and unique_id in catalog.nodes:
                columns = {}
                primary_key = None
                for col_name, col in catalog.nodes[unique_id].columns.items():
                    col = dict(name=col_name, type=col.type)
                    if col_name in cols_not_null:
                        col['not_null'] = True
                    if col_name in cols_unique:
                        col['unique'] = True
                        if not primary_key:
                            primary_key = col_name
                    columns[col_name] = col
                nodes[unique_id]['columns'] = columns
                if primary_key:
                    nodes[unique_id]['primary_key'] = primary_key

        for source in manifest_dict['sources'].values():
            unique_id = source['unique_id']

            nodes[unique_id] = {
                'id': source['unique_id'],
                'name': source['name'],
                'resource_type': source['resource_type'],
                'package_name': source['package_name'],
                'config': source['config'],
            }

            if catalog is not None and unique_id in catalog.sources:
                nodes[unique_id]['columns'] = catalog.sources[unique_id].columns

        for exposure in manifest_dict['exposures'].values():
            nodes[exposure['unique_id']] = {
                'id': exposure['unique_id'],
                'name': exposure['name'],
                'resource_type': exposure['resource_type'],
                'package_name': exposure['package_name'],
                'config': exposure['config'],
            }
        for metric in manifest_dict['metrics'].values():
            nodes[metric['unique_id']] = {
                'id': metric['unique_id'],
                'name': metric['name'],
                'resource_type': metric['resource_type'],
                'package_name': metric['package_name'],
                'config': metric['config'],
            }

        if 'semantic_models' in manifest_dict:
            for semantic_models in manifest_dict['semantic_models'].values():
                nodes[semantic_models['unique_id']] = {
                    'id': semantic_models['unique_id'],
                    'name': semantic_models['name'],
                    'resource_type': semantic_models['resource_type'],
                    'package_name': semantic_models['package_name'],
                    'config': semantic_models['config'],
                }

        nodeIds = nodes.keys()
        parent_map = {}
        for k, parents in manifest_dict['parent_map'].items():
            if k not in nodeIds:
                continue
            parent_map[k] = [parent for parent in parents if parent in nodeIds]

        return dict(
            parent_map=parent_map,
            nodes=nodes,
            manifest_metadata=manifest_metadata,
            catalog_metadata=catalog_metadata,
        )

    def get_manifests_by_id(self, unique_id: str):
        curr_manifest = self.get_manifest(base=False)
        base_manifest = self.get_manifest(base=True)
        if unique_id in curr_manifest.nodes.keys() or unique_id in base_manifest.nodes.keys():
            return {
                'current': curr_manifest.nodes.get(unique_id),
                'base': base_manifest.nodes.get(unique_id)
            }
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

    def start_monitor_artifacts(self, callback: Callable = None):
        if self.artifacts_files:
            event_handler = ArtifactsEventHandler(self.artifacts_files, callback=callback)
            if self.target_path:
                self.artifacts_observer.schedule(event_handler, self.target_path, recursive=False)
            if self.base_path:
                self.artifacts_observer.schedule(event_handler, self.base_path, recursive=False)
            self.artifacts_observer.start()
            logger.info('Start monitoring dbt artifacts')

    def stop_monitor_artifacts(self):
        if self.artifacts_files:
            self.artifacts_observer.stop()
            self.artifacts_observer.join()
            logger.info('Stop monitoring artifacts')

    def set_artifacts(self,
                      base_manifest: WritableManifest,
                      curr_manifest: WritableManifest,
                      manifest: Manifest,
                      previous_manifest: Manifest,
                      ):
        self.curr_manifest = curr_manifest
        self.base_manifest = base_manifest
        self.manifest = manifest
        self.previous_state = previous_state(
            Path('target-base'),
            Path(self.runtime_config.target_path),
            Path(self.runtime_config.project_root)
        )
        self.previous_state.manifest = previous_manifest

        # The dependencies of the review mode is derived from manifests.
        # It is a workaround solution to use macro dispatch
        # see: https://docs.getdbt.com/reference/dbt-jinja-functions/dispatch
        dependencies = {}
        for macro in self.manifest.macros.values():
            if macro.package_name not in dependencies:
                dependencies[macro.package_name] = self.runtime_config
        self.runtime_config.dependencies = dependencies

    def refresh(self, refresh_file_path: str = None):
        # Refresh the artifacts
        if refresh_file_path is None:
            return self.load_artifacts()

        target_type = refresh_file_path.split('/')[-2]
        if self.target_path and target_type == os.path.basename(self.target_path):
            if refresh_file_path.endswith('manifest.json'):
                self.curr_manifest = load_manifest(path=refresh_file_path)
                self.manifest = as_manifest(self.curr_manifest)
            elif refresh_file_path.endswith('catalog.json'):
                self.curr_catalog = load_catalog(path=refresh_file_path)
        elif self.base_path and target_type == os.path.basename(self.base_path):
            if refresh_file_path.endswith('manifest.json'):
                self.base_manifest = load_manifest(path=refresh_file_path)
            elif refresh_file_path.endswith('catalog.json'):
                self.base_catalog = load_catalog(path=refresh_file_path)

    def create_relation(self, model, base=False):
        node = self.find_node_by_name(model, base)
        if node is None:
            return None

        return self.adapter.Relation.create_from(self.runtime_config, node)

    def select_nodes(self, select: Optional[str] = None, exclude: Optional[str] = None) -> Set[str]:
        from dbt.graph import NodeSelector
        from dbt.compilation import Compiler
        from dbt.graph import parse_difference
        import dbt.compilation

        select_list = [select] if select else None
        exclude_list = [exclude] if exclude else None

        # if dbt version < 1.8
        if dbt_version < 'v1.8':
            spec = parse_difference(select_list, exclude_list, "eager")
        else:
            spec = parse_difference(select_list, exclude_list)

        manifest = Manifest()
        manifest_prev = self.previous_state.manifest
        manifest_curr = self.manifest

        manifest.nodes = {**manifest_prev.nodes, **manifest_curr.nodes}
        manifest.sources = {**manifest_prev.sources, **manifest_curr.sources}
        manifest.exposures = {**manifest_prev.exposures, **manifest_curr.exposures}
        manifest.metrics = {**manifest_prev.metrics, **manifest_curr.metrics}
        if hasattr(manifest_prev, 'semantic_models'):
            manifest.semantic_models = {**manifest_prev.semantic_models, **manifest_curr.semantic_models}

        compiler = Compiler(self.runtime_config)
        # disable to print compile states
        tmp_func = dbt.compilation.print_compile_stats
        dbt.compilation.print_compile_stats = lambda x: None
        graph = compiler.compile(manifest, write=False)
        dbt.compilation.print_compile_stats = tmp_func
        selector = NodeSelector(graph, manifest, previous_state=self.previous_state)

        # disable "The selection criterion does not match"
        with silence_no_nodes_warning():
            return selector.get_selected(spec)

    def export_artifacts(self) -> ArtifactsRoot:
        '''
        Export the artifacts from the current state
        '''
        artifacts = ArtifactsRoot()

        def _load_artifact(artifact):
            return artifact.to_dict() if artifact else None

        artifacts.base = {
            'manifest': _load_artifact(self.base_manifest),
            'catalog': _load_artifact(self.base_catalog),
        }
        artifacts.current = {
            'manifest': _load_artifact(self.curr_manifest),
            'catalog': _load_artifact(self.curr_catalog),
        }
        return artifacts

    def export_artifacts_from_file(self) -> ArtifactsRoot:
        '''
        Export the artifacts from the state file. This is the old impolementation
        '''
        artifacts = ArtifactsRoot()
        target_path = self.runtime_config.target_path
        target_base_path = 'target-base'

        def _load_artifact(path):
            if not os.path.isfile(path):
                return None

            with open(path, 'r') as f:
                json_content = f.read()
                return json.loads(json_content)

        project_root = self.runtime_config.project_root
        artifacts.base = {
            'manifest': _load_artifact(os.path.join(project_root, target_base_path, 'manifest.json')),
            'catalog': _load_artifact(os.path.join(project_root, target_base_path, 'catalog.json')),
        }
        artifacts.current = {
            'manifest': _load_artifact(os.path.join(project_root, target_path, 'manifest.json')),
            'catalog': _load_artifact(os.path.join(project_root, target_path, 'catalog.json')),
        }
        return artifacts

    def import_artifacts(self, artifacts: ArtifactsRoot, merge=True):
        # Merge the artifacts from the state file or cloud
        def _select_artifact(
            original: Union[WritableManifest, CatalogArtifact],
            new: Union[WritableManifest, CatalogArtifact]
        ):
            if merge:
                if not original:
                    return new
                if not new:
                    return original
                return original if original.metadata.generated_at > new.metadata.generated_at else new
            else:
                return new

        self.base_manifest = _select_artifact(self.base_manifest, load_manifest(data=artifacts.base.get('manifest')))
        self.curr_manifest = _select_artifact(self.curr_manifest, load_manifest(data=artifacts.current.get('manifest')))
        self.base_catalog = _select_artifact(self.base_catalog, load_catalog(data=artifacts.base.get('catalog')))
        self.curr_catalog = _select_artifact(self.curr_catalog, load_catalog(data=artifacts.current.get('catalog')))

        self.manifest = as_manifest(self.curr_manifest)
        self.previous_state = previous_state(
            Path('target-base'),
            Path(self.runtime_config.target_path),
            Path(self.runtime_config.project_root)
        )
        self.previous_state.manifest = as_manifest(self.base_manifest)

        # The dependencies of the review mode is derived from manifests.
        # It is a workaround solution to use macro dispatch
        # see: https://docs.getdbt.com/reference/dbt-jinja-functions/dispatch
        dependencies = {}
        for macro in self.manifest.macros.values():
            if macro.package_name not in dependencies:
                dependencies[macro.package_name] = self.runtime_config

        self.runtime_config.dependencies = dependencies

        if not self.curr_manifest or not self.base_manifest:
            raise Exception(
                'No enough dbt artifacts in the state file. Please use the latest recce to generate the recce state')

    @contextmanager
    def connection_named(self, name: str) -> Iterator[None]:
        with self.adapter.connection_named(name):
            yield

    def get_thread_connection(self) -> Connection:
        return self.adapter.connections.get_thread_connection()

    def cancel(self, connection: Connection):
        self.adapter.connections.cancel(connection)
