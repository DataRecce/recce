import json
import logging
import os
import uuid
from contextlib import contextmanager
from copy import deepcopy
from dataclasses import dataclass, fields
from errno import ENOENT
from functools import lru_cache
from pathlib import Path
from typing import Callable, Dict, List, Optional, Tuple, Iterator, Any, Set, Union, Literal, Type

from recce.event import log_performance
from recce.exceptions import RecceException
from recce.util.cll import cll, CLLPerformanceTracking
from ...tasks.profile import ProfileTask
from recce.util.lineage import find_upstream, find_downstream

try:
    import agate
    import dbt.adapters.factory
    from dbt.contracts.state import PreviousState
except ImportError as e:
    print("Error: dbt module not found. Please install it by running:")
    print("pip install dbt-core dbt-<adapter>")
    raise e
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from recce.adapter.base import BaseAdapter
from recce.state import ArtifactsRoot
from .dbt_version import DbtVersion
from ...models import RunType
from ...models.types import LineageDiff, NodeDiff
from ...tasks import Task, QueryTask, QueryBaseTask, QueryDiffTask, ValueDiffTask, ValueDiffDetailTask, ProfileDiffTask, \
    RowCountTask, RowCountDiffTask, TopKDiffTask, HistogramDiffTask

dbt_supported_registry: Dict[RunType, Type[Task]] = {
    RunType.QUERY: QueryTask,
    RunType.QUERY_BASE: QueryBaseTask,
    RunType.QUERY_DIFF: QueryDiffTask,
    RunType.VALUE_DIFF: ValueDiffTask,
    RunType.VALUE_DIFF_DETAIL: ValueDiffDetailTask,
    RunType.PROFILE: ProfileTask,
    RunType.PROFILE_DIFF: ProfileDiffTask,
    RunType.ROW_COUNT: RowCountTask,
    RunType.ROW_COUNT_DIFF: RowCountDiffTask,
    RunType.TOP_K_DIFF: TopKDiffTask,
    RunType.HISTOGRAM_DIFF: HistogramDiffTask,
}

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


class EnvironmentEventHandler(FileSystemEventHandler):
    def __init__(self, observer, watch_files: set[str], callback: Callable = None):
        super().__init__()
        self.observer = observer
        self.watch_files = watch_files
        self.detected_files = set()
        self.callback = callback

    def on_created(self, event):
        if event.is_directory:
            return

        if event.src_path in self.watch_files:
            self.detected_files.add(event.src_path)

        # Check if all target-base files are created
        if self.detected_files == self.watch_files:
            if callable(self.callback):
                self.callback()
            self.observer.stop()


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
        try:
            # Overwrite the level_tag method temporarily to avoid the warning message
            from dbt.events.types import WarnStateTargetEqual, EventLevel
            original_level_tag_func = WarnStateTargetEqual.level_tag
            WarnStateTargetEqual.level_tag = lambda x: EventLevel.DEBUG
        except ImportError:
            # Skip overwriting the level_tag method if the dbt version not support
            original_level_tag_func = None
            pass

        state = PreviousState(state_path, target_path, project_root)

        if original_level_tag_func is not None:
            # Restore the original level_tag method
            WarnStateTargetEqual.level_tag = original_level_tag_func

        return state


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
    state_modified_compare_more_unrendered_values: Optional[bool] = False  # new flag added since dbt v1.9


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

    # Watch the base environment ready
    base_env_observer = Observer()

    def support_tasks(self):
        support_map = {run_type.value: True for run_type in dbt_supported_registry}
        supported_dbt_packages = set([package.package_name for package in self.manifest.macros.values()])

        if 'dbt_profiler' not in supported_dbt_packages:
            support_map[RunType.PROFILE_DIFF.value] = False
            support_map[RunType.PROFILE.value] = False

        if 'audit_helper' not in supported_dbt_packages:
            support_map[RunType.VALUE_DIFF.value] = False
            support_map[RunType.VALUE_DIFF_DETAIL.value] = False
            support_map['query_diff_with_primary_key'] = False

        return support_map

    @classmethod
    def load(cls,
             no_artifacts=False,
             review=False,
             **kwargs):

        target = kwargs.get('target')
        target_path = kwargs.get('target_path', 'target')
        target_base_path = kwargs.get('target_base_path', 'target-base')

        profile_name = kwargs.get('profile')
        project_dir = kwargs.get('project_dir')
        profiles_dir = kwargs.get('profiles_dir')

        if profiles_dir is None:
            profiles_dir = default_profiles_dir()

        # runtime_config
        args = DbtArgs(
            threads=1,
            target=target,
            target_path=target_path,
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
                base_path=target_base_path
            )
        except DbtProjectError as e:
            raise e

        # Load the artifacts from the state file or dbt target and dbt base directory
        if not no_artifacts and not review:
            dbt_adapter.load_artifacts()
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
        get_columns_macro = 'get_columns_in_relation'
        if self.adapter.connections.TYPE == 'databricks':
            get_columns_macro = 'get_columns_comments'

        if dbt_version < 'v1.8':
            columns = self.adapter.execute_macro(
                get_columns_macro,
                kwargs={"relation": relation},
                manifest=self.manifest)
        else:
            from dbt.context.providers import generate_runtime_macro_context
            macro_manifest = MacroManifest(self.manifest.macros)
            self.adapter.set_macro_resolver(macro_manifest)
            self.adapter.set_macro_context_generator(generate_runtime_macro_context)
            columns = self.adapter.execute_macro(
                get_columns_macro,
                kwargs={"relation": relation})

        if self.adapter.connections.TYPE == 'databricks':
            # reference: get_columns_in_relation (dbt/adapters/databricks/impl.py)
            from dbt.adapters.databricks import DatabricksColumn
            rows = columns
            columns = []
            for row in rows:
                if row["col_name"].startswith("#"):
                    break
                columns.append(
                    DatabricksColumn(
                        column=row["col_name"], dtype=row["data_type"], comment=row["comment"]
                    )
                )
            return columns
        else:
            return columns

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
        target_base_path = self.base_path
        self.target_path = os.path.join(project_root, target_path)
        self.base_path = os.path.join(project_root, target_base_path)

        # load the artifacts
        path = os.path.join(project_root, target_path, 'manifest.json')
        curr_manifest = load_manifest(path=path)
        if curr_manifest is None:
            raise FileNotFoundError(ENOENT, os.strerror(ENOENT), path)
        path = os.path.join(project_root, target_base_path, 'manifest.json')
        base_manifest = load_manifest(path=path)
        if base_manifest is None:
            raise FileNotFoundError(ENOENT, os.strerror(ENOENT), path)

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
            Path(target_base_path),
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

    def is_python_model(self, node_id: str, base: Optional[bool] = False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        model = manifest.nodes.get(node_id)
        if hasattr(model, 'language'):
            return model.language == 'python'

        return False

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
        elif unique_id.startswith('metric.'):
            if unique_id in self.curr_manifest.metrics:
                return self.curr_manifest.metrics[unique_id].name
            elif unique_id in self.base_manifest.metrics:
                return self.base_manifest.metrics[unique_id].name
        elif unique_id.startswith('exposure.'):
            if unique_id in self.curr_manifest.exposures:
                return self.curr_manifest.exposures[unique_id].name
            elif unique_id in self.base_manifest.exposures:
                return self.base_manifest.exposures[unique_id].name
        elif unique_id.startswith('semantic_model.'):
            if unique_id in self.curr_manifest.semantic_models:
                return self.curr_manifest.semantic_models[unique_id].name
            elif unique_id in self.base_manifest.semantic_models:
                return self.base_manifest.semantic_models[unique_id].name
        else:
            if unique_id in self.curr_manifest.nodes:
                return self.curr_manifest.nodes[unique_id].name
            elif unique_id in self.base_manifest.nodes:
                return self.base_manifest.nodes[unique_id].name
            return None

    def get_manifest(self, base: bool):
        return self.curr_manifest if base is False else self.base_manifest

    def generate_sql(self, sql_template: str, base: bool = False, context=None, provided_manifest=None):
        if context is None:
            context = {}
        manifest = provided_manifest if provided_manifest is not None else as_manifest(self.get_manifest(base))
        parser = SqlBlockParser(self.runtime_config, manifest, self.runtime_config)

        if dbt_version >= dbt_version.parse('v1.8'):
            from dbt_common.context import set_invocation_context, get_invocation_context
            set_invocation_context({})
            get_invocation_context()._env = dict(os.environ)

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

    def build_parent_map(self, nodes: Dict, base: Optional[bool] = False) -> Dict[str, List[str]]:
        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        node_ids = nodes.keys()
        parent_map = {}
        for k, parents in manifest_dict['parent_map'].items():
            if k not in node_ids:
                continue
            parent_map[k] = [parent for parent in parents if parent in node_ids]

        return parent_map

    def build_parent_list_per_node(self, node_id: str, base: Optional[bool] = False) -> List[str]:
        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        if node_id in manifest_dict['parent_map']:
            return manifest_dict['parent_map'][node_id]

    def get_lineage(self, base: Optional[bool] = False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog
        cache_key = hash((id(manifest), id(catalog)))
        return self.get_lineage_cached(base, cache_key)

    def get_lineage_diff(self) -> LineageDiff:
        cache_key = hash((
            id(self.base_manifest),
            id(self.base_catalog),
            id(self.curr_manifest),
            id(self.curr_catalog),
        ))
        return self._get_lineage_diff_cached(cache_key)

    @lru_cache(maxsize=2)
    def get_lineage_cached(self, base: Optional[bool] = False, cache_key=0):
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
                for col_name, col_metadata in catalog.nodes[unique_id].columns.items():
                    col = dict(name=col_name, type=col_metadata.type)
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
                'columns': {
                    col.get('name'): {
                        'name': col.get('name'),
                        'type': col.get('data_type')
                    }
                    for col in source.get('columns', {}).values()
                }
            }

            if catalog is not None and unique_id in catalog.sources:
                columns = {
                    col_name: {
                        'name': col_name,
                        'type': col_metadata.type
                    }
                    for col_name, col_metadata in catalog.sources[unique_id].columns.items()
                }
                nodes[unique_id]['columns'].update(columns)

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

        parent_map = self.build_parent_map(nodes, base)

        return dict(
            parent_map=parent_map,
            nodes=nodes,
            manifest_metadata=manifest_metadata,
            catalog_metadata=catalog_metadata,
        )

    @lru_cache(maxsize=1)
    def _get_lineage_diff_cached(self, cache_key) -> LineageDiff:
        base = self.get_lineage(base=True)
        current = self.get_lineage(base=False)
        keys = {
            *base.get('nodes', {}).keys(),
            *current.get('nodes', {}).keys()
        }

        # for each node, compare the base and current lineage
        diff = {}
        for key in keys:
            base_node = base.get('nodes', {}).get(key)
            curr_node = current.get('nodes', {}).get(key)
            if base_node and curr_node:
                base_checksum = base_node.get('checksum', {}).get('checksum')
                curr_checksum = curr_node.get('checksum', {}).get('checksum')
                if base_checksum is None or curr_checksum is None or base_checksum == curr_checksum:
                    continue

                change_category = 'breaking'
                if curr_node.get('resource_type') == 'model':
                    try:
                        from recce.util.breaking import is_breaking_change
                        base_sql = self.generate_sql(base_node.get('raw_code'))
                        curr_sql = self.generate_sql(curr_node.get('raw_code'))
                        dialect = self.adapter.connections.TYPE
                        if not is_breaking_change(base_sql, curr_sql, dialect=dialect):
                            change_category = 'non-breaking'
                    except Exception:
                        pass

                diff[key] = NodeDiff(change_status='modified', change_category=change_category)
            elif base_node:
                diff[key] = NodeDiff(change_status='removed')
            elif curr_node:
                diff[key] = NodeDiff(change_status='added')
        return LineageDiff(
            base=base,
            current=current,
            diff=diff,
        )

    def get_cll_by_node_id(self, node_id: str, base: Optional[bool] = False):
        cll_tracker = CLLPerformanceTracking()
        cll_tracker.start_column_lineage()

        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        parent_ids = find_upstream(node_id, manifest_dict.get('parent_map'))
        child_ids = find_downstream(node_id, manifest_dict.get('child_map'))
        cll_node_ids = parent_ids.union(child_ids)
        cll_node_ids.add(node_id)
        cll_tracker.set_total_nodes(len(cll_node_ids))

        node_manifest = self.get_lineage_nodes_metadata(base=base)
        nodes = {}
        for node_id in cll_node_ids:
            if node_id not in node_manifest:
                continue
            nodes[node_id] = self.get_cll_cached(node_id, base=base)

        cll_tracker.end_column_lineage()
        log_performance('column level lineage', cll_tracker.to_dict())
        cll_tracker.reset()

        return dict(nodes=nodes)

    @lru_cache(maxsize=128)
    def get_cll_cached(self, node_id: str, base: Optional[bool] = False):
        nodes = self.get_lineage_nodes_metadata(base=base)

        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()
        parent_list = []
        if node_id in manifest_dict['parent_map']:
            parent_list = manifest_dict['parent_map'][node_id]

        node = deepcopy(nodes[node_id])
        self.append_column_lineage(node, parent_list, base)
        return node

    def append_column_lineage(self, node: Dict, parent_list: List, base: Optional[bool] = False):
        def _apply_all_columns(node, trans_type, depends_on):
            for col in node.get('columns', {}).values():
                col['transformation_type'] = trans_type
                col['depends_on'] = depends_on

        def _depend_node_to_id(column_lineage, nodes):
            for cl in column_lineage.values():
                for depend_on in cl.depends_on:
                    if depend_on.node.startswith('__'):
                        for n in nodes.values():
                            if n.get('resource_type') != 'source':
                                continue
                            # __source__table -> source.table
                            source_table = depend_on.node.lstrip("_").replace("__", ".", 1).lower()
                            if source_table in n.get('id'):
                                depend_on.node = n.get('id')
                                break
                    else:
                        for n in nodes.values():
                            if n.get('name') == depend_on.node.lower():
                                depend_on.node = n.get('id')
                                break

        cll_tracker = CLLPerformanceTracking()
        nodes = self.get_lineage_nodes_metadata(base=base)
        manifest = as_manifest(self.get_manifest(base))
        resource_type = node.get('resource_type')
        if resource_type not in {'model', 'seed', 'source', 'snapshot'}:
            return

        if resource_type == 'source' or resource_type == 'seed':
            _apply_all_columns(node, 'source', [])
            return

        if node.get('raw_code') is None or self.is_python_model(node.get('id'), base=base):
            _apply_all_columns(node, 'unknown', [])
            return

        # dbt <= 1.8, MetricFlow expects the time spine table to be named metricflow_time_spine
        if node.get('name') == 'metricflow_time_spine':
            _apply_all_columns(node, 'source', [])
            return

        if not node.get('columns', {}):
            # no catalog
            return

        def ref_func(*args):
            if len(args) == 1:
                node = args[0]
            elif len(args) > 1:
                node = args[1]
            else:
                return None
            return node

        def source_func(source_name, table_name):
            return f"__{source_name}__{table_name}"

        raw_code = node.get('raw_code')
        jinja_context = dict(
            ref=ref_func,
            source=source_func,
        )

        schema = {}
        for parent_id in parent_list:
            parent_node = nodes.get(parent_id)
            if parent_node is None:
                continue
            columns = parent_node.get('columns') or {}
            name = parent_node.get('name')
            if parent_node.get('resource_type') == 'source':
                parts = parent_id.split('.')
                source = parts[2]
                table = parts[3]
                name = f"__{source}__{table}"
            schema[name] = {
                name: column.get('type') for name, column in columns.items()
            }

        try:
            # provide a manifest to speedup and not pollute the manifest
            compiled_sql = self.generate_sql(raw_code, base=base, context=jinja_context, provided_manifest=manifest)
            dialect = self.adapter.type()
            column_lineage = cll(compiled_sql, schema=schema, dialect=dialect)
        except RecceException:
            # TODO: provide parsing error message if needed
            _apply_all_columns(node, 'unknown', [])
            cll_tracker.increment_sqlglot_error_nodes()
            return
        except Exception:
            _apply_all_columns(node, 'unknown', [])
            cll_tracker.increment_other_error_nodes()
            return

        _depend_node_to_id(column_lineage, nodes)

        for name, column in node.get('columns', {}).items():
            if name in column_lineage:
                column['depends_on'] = column_lineage[name].depends_on
                column['transformation_type'] = column_lineage[name].type

    @lru_cache(maxsize=2)
    def get_lineage_nodes_metadata(self, base: Optional[bool] = False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog
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
                'raw_code': node['raw_code'],
            }

            if catalog is not None and unique_id in catalog.nodes:
                columns = {}
                for col_name, col_metadata in catalog.nodes[unique_id].columns.items():
                    col = dict(name=col_name, type=col_metadata.type)
                    columns[col_name] = col
                nodes[unique_id]['columns'] = columns

        for source in manifest_dict['sources'].values():
            unique_id = source['unique_id']

            nodes[unique_id] = {
                'id': source['unique_id'],
                'name': source['name'],
                'resource_type': source['resource_type'],
                'columns': {
                    col.get('name'): {
                        'name': col.get('name'),
                        'type': col.get('data_type')
                    }
                    for col in source.get('columns', {}).values()
                }
            }

            if catalog is not None and unique_id in catalog.sources:
                columns = {
                    col_name: {
                        'name': col_name,
                        'type': col_metadata.type
                    }
                    for col_name, col_metadata in catalog.sources[unique_id].columns.items()
                }
                nodes[unique_id]['columns'].update(columns)

        return nodes

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

    def start_monitor_base_env(self, callback: Callable = None):
        target_base_dir = os.path.join(self.runtime_config.project_root, 'target-base')
        base_env_files = {
            os.path.join(target_base_dir, 'manifest.json'),
            os.path.join(target_base_dir, 'catalog.json'),
        }
        event_handler = EnvironmentEventHandler(self.base_env_observer, base_env_files, callback=callback)
        self.base_env_observer.schedule(event_handler, self.runtime_config.project_root, recursive=True)
        self.base_env_observer.start()
        logger.info('Start monitoring base environment')

    def stop_monitor_base_env(self):
        if self.base_env_observer.is_alive():
            self.base_env_observer.stop()
        self.base_env_observer.join()
        logger.info('Stop monitoring base environment')

    def set_artifacts(self,
                      base_manifest: WritableManifest,
                      curr_manifest: WritableManifest,
                      manifest: Manifest,
                      previous_manifest: Manifest,
                      base_catalog: CatalogArtifact,
                      curr_catalog: CatalogArtifact,
                      ):
        self.curr_manifest = curr_manifest
        self.base_manifest = base_manifest
        self.manifest = manifest
        self.curr_catalog = curr_catalog
        self.base_catalog = base_catalog
        self.previous_state = previous_state(
            Path(self.base_path),
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

        # In single environment mode (target_path is equal to base_path),
        # we capture the original manifest as base and only update the current
        target_type = os.path.basename(os.path.dirname(refresh_file_path))
        if self.target_path and target_type == os.path.basename(self.target_path):
            if refresh_file_path.endswith('manifest.json'):
                self.curr_manifest = load_manifest(path=refresh_file_path)
                self.manifest = as_manifest(self.curr_manifest)
                self.get_cll_cached.cache_clear()
                self.get_lineage_nodes_metadata.cache_clear()
            elif refresh_file_path.endswith('catalog.json'):
                self.curr_catalog = load_catalog(path=refresh_file_path)
                self.get_lineage_nodes_metadata.cache_clear()
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

    def select_nodes(
        self,
        select: Optional[str] = None,
        exclude: Optional[str] = None,
        packages: Optional[list[str]] = None,
        view_mode: Optional[Literal['all', 'changed_models']] = None,
    ) -> Set[str]:
        from dbt.graph import NodeSelector
        from dbt.compilation import Compiler
        from dbt.graph import parse_difference, SelectionIntersection, SelectionUnion
        import dbt.compilation

        select_list = [select] if select else None
        exclude_list = [exclude] if exclude else None

        def _parse_difference(include, exclude):
            if dbt_version < 'v1.8':
                return parse_difference(include, exclude, "eager")
            else:
                return parse_difference(include, exclude)

        specs = [_parse_difference(select_list, exclude_list)]

        if packages is not None:
            package_spec = SelectionUnion([_parse_difference([f'package:{p}'], None) for p in packages])
            specs.append(package_spec)
        if view_mode and view_mode == 'changed_models':
            specs.append(_parse_difference(['1+state:modified+'], None))
        spec = SelectionIntersection(specs)

        manifest = Manifest()
        manifest_prev = self.previous_state.manifest
        manifest_curr = self.manifest

        manifest.nodes = {**manifest_prev.nodes, **manifest_curr.nodes}
        manifest.macros = {**manifest_prev.macros, **manifest_curr.macros}
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
        Export the artifacts from the state file. This is the old implementation
        '''
        artifacts = ArtifactsRoot()
        target_path = self.runtime_config.target_path
        target_base_path = self.base_path

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
            Path(self.base_path),
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

    def __hash__(self):
        return id(self)

    def __eq__(self, other):
        return self.__hash__() == other.__hash__()
