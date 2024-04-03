import json
import logging
import os
import uuid
from dataclasses import dataclass, fields
from typing import Callable, Dict, List, Optional, Tuple

import agate
from dbt.adapters.base import Column
from dbt.adapters.factory import get_adapter_by_type
from dbt.adapters.sql import SQLAdapter
from dbt.cli.main import dbtRunner
from dbt.config.runtime import RuntimeConfig
from dbt.contracts.graph.manifest import Manifest, WritableManifest
from dbt.contracts.graph.nodes import ManifestNode, SourceDefinition
from dbt.contracts.results import CatalogArtifact
from dbt.parser.manifest import process_node
from dbt.parser.sql import SqlBlockParser
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from recce.models import RunDAO, CheckDAO
from recce.models.check import load_checks
from recce.models.run import load_runs
from recce.state import RecceState, RecceStateMetadata, GitRepoInfo

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


def as_manifest(m: WritableManifest) -> Manifest:
    data = m.__dict__
    all_fields = set([x.name for x in fields(Manifest)])
    new_data = {k: v for k, v in data.items() if k in all_fields}
    return Manifest(**new_data)


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


def execute_dbt_parse(target=None, profile_name=None, project_dir=None, profiles_dir=None):
    cmd = ["-q", "parse"]
    if target:
        cmd.extend(["--target", target])
    if profile_name:
        cmd.extend(["--profile", profile_name])
    if project_dir:
        cmd.extend(["--project-dir", project_dir])
    if profiles_dir:
        cmd.extend(["--profiles-dir", profiles_dir])

    # Check the dbt project to get the database connection information
    return dbtRunner().invoke(cmd)


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


@dataclass
class DBTContext:
    review_mode: bool = False
    runtime_config: RuntimeConfig = None
    adapter: SQLAdapter = None
    manifest: Manifest = None
    target_path: str = None
    curr_manifest: WritableManifest = None
    curr_catalog: CatalogArtifact = None
    base_path: str = None
    base_manifest: WritableManifest = None
    base_catalog: CatalogArtifact = None

    # Watch the artifact change
    artifacts_observer = Observer()
    artifacts_files = []

    # The state file used for review mode
    review_state_file: str = None
    review_state: RecceState = None

    def info(self):
        dbt_adapter_type = self.runtime_config.credentials.type if self.runtime_config else 'recce_run'
        return {
            "adapterType": dbt_adapter_type,
        }

    @classmethod
    def load(cls, **kwargs):

        target = kwargs.get('target')
        profile_name = kwargs.get('profile')
        project_dir = kwargs.get('project_dir')
        profiles_dir = kwargs.get('profiles_dir')
        state_file = kwargs.get('state_file', 'recce_state.json')
        is_review_mode = kwargs.get('review', False)

        # We need to run the dbt parse command because
        # 1. load the dbt profiles by dbt-core rule
        # 2. initialize the adapter
        parse_result = execute_dbt_parse(target=target, profile_name=profile_name, project_dir=project_dir)
        manifest = parse_result.result

        if parse_result.success:
            # Load the dbt context from DBT
            args = DbtArgs(
                threads=1,
                target=target,
                project_dir=project_dir,
                profiles_dir=profiles_dir,
                profile=profile_name,
            )
            runtime_config = RuntimeConfig.from_args(args)
            adapter: SQLAdapter = get_adapter_by_type(runtime_config.credentials.type)

            dbt_context = cls(
                runtime_config=runtime_config,
                adapter=adapter,
                manifest=manifest,
                review_mode=is_review_mode,
            )
        else:
            # Load the dbt context from recce state
            dbt_context = cls(
                review_mode=is_review_mode,
            )

        if state_file:
            state = RecceState.from_file(state_file)
            dbt_context.import_state(state)

        # Load the artifacts from the state file or `target` and `target-base` directory
        if is_review_mode:
            if state_file:
                dbt_context.review_state_file = state_file
                dbt_context.load_artifacts_from_state(state_file)

            if not dbt_context.curr_manifest or not dbt_context.base_manifest:
                raise Exception(
                    'No enough dbt artifacts in the state file. Please use the latest recce to generate the recce state')
        else:
            if parse_result.success is False:
                raise parse_result.exception
            dbt_context.load_artifacts_from_manifest()

            if not dbt_context.curr_manifest:
                raise Exception('Cannot load "target/manifest.json"')
            if not dbt_context.base_manifest:
                raise Exception('Cannot load "target-base/manifest.json"')
        return dbt_context

    def get_columns(self, model: str, base=False) -> List[Column]:
        relation = self.create_relation(model, base)

        return self.adapter.execute_macro(
            'get_columns_in_relation',
            kwargs={"relation": relation},
            manifest=self.manifest)

    def load_artifacts_from_state(self, state_file: str = None):
        if state_file is None:
            raise Exception('The recce state file is not provided')

        state = RecceState.from_file(state_file)
        if state is None:
            raise Exception('Recce state is not loaded from the state file')

        self.review_state = state
        self.base_manifest = load_manifest(data=state.artifacts.base.get('manifest'))
        self.base_catalog = load_catalog(data=state.artifacts.base.get('catalog'))
        self.curr_manifest = load_manifest(data=state.artifacts.current.get('manifest'))
        self.curr_catalog = load_catalog(data=state.artifacts.current.get('catalog'))

        self.artifacts_files = [
            os.path.abspath(state_file)
        ]

    def load_artifacts_from_manifest(self):
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
        curr_manifest = load_manifest(path=os.path.join(project_root, target_path, 'manifest.json'))
        curr_catalog = load_catalog(path=os.path.join(project_root, target_path, 'catalog.json'))
        base_manifest = load_manifest(path=os.path.join(project_root, target_base_path, 'manifest.json'))
        base_catalog = load_catalog(path=os.path.join(project_root, target_base_path, 'catalog.json'))

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

    def get_node_name_by_id(self, unique_id):
        if unique_id in self.curr_manifest.nodes:
            return self.curr_manifest.nodes[unique_id].name
        elif unique_id in self.base_manifest.nodes:
            return self.base_manifest.nodes[unique_id].name
        return None

    def get_manifest(self, base: bool):
        return self.curr_manifest if base is False else self.base_manifest

    def find_source_by_name(self, source_name, table_name, base=False) -> Optional[SourceDefinition]:

        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, source in manifest.sources.items():
            if source.source_name == source_name and source.name == table_name:
                return source

        return None

    def generate_sql(self, sql_template: str, base: bool = False, context: Dict = {}):
        manifest = as_manifest(self.get_manifest(base))
        parser = SqlBlockParser(self.runtime_config, manifest, self.runtime_config)

        node_id = str("generated_" + uuid.uuid4().hex)
        node = parser.parse_remote(sql_template, node_id)
        process_node(self.runtime_config, manifest, node)

        compiler = self.adapter.get_compiler()
        compiler.compile_node(node, manifest, context)
        return node.compiled_code

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

        parent_map = {k: v for k, v in manifest_dict['parent_map'].items() if not k.startswith('test.')}

        nodes = {}

        for node in manifest_dict['nodes'].values():
            unique_id = node['unique_id']
            resource_type = node['resource_type']

            if resource_type not in ['model', 'seed', 'exposure']:
                continue

            nodes[unique_id] = {
                'id': node['unique_id'],
                'name': node['name'],
                'resource_type': node['resource_type'],
                'package_name': node['package_name'],
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

        pr_url = os.environ.get('RECCE_PR_URL')
        if self.review_mode and self.review_state.pull_request and self.review_state.pull_request.url:
            pr_url = self.review_state.pull_request.url

        metadata = dict(
            pr_url=pr_url
        )

        return dict(
            metadata=metadata,
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
            if self.review_state_file:
                self.artifacts_observer.schedule(event_handler, os.path.curdir, recursive=False)
            self.artifacts_observer.start()
            logger.info('Start monitoring dbt artifacts')
        else:
            logger.warning('No artifacts to monitor')

    def stop_monitor_artifacts(self):
        self.artifacts_observer.stop()
        self.artifacts_observer.join()
        logger.info('Stop monitoring artifacts')

    def refresh(self, refresh_file_path: str = None):
        # Refresh the artifacts
        if refresh_file_path is None:
            return self.load_artifacts_from_manifest()

        target_type = refresh_file_path.split('/')[-2]
        if self.target_path and target_type == os.path.basename(self.target_path):
            if refresh_file_path.endswith('manifest.json'):
                self.curr_manifest = load_manifest(path=refresh_file_path)
            elif refresh_file_path.endswith('catalog.json'):
                self.curr_catalog = load_catalog(path=refresh_file_path)
        elif self.base_path and target_type == os.path.basename(self.base_path):
            if refresh_file_path.endswith('manifest.json'):
                self.base_manifest = load_manifest(path=refresh_file_path)
            elif refresh_file_path.endswith('catalog.json'):
                self.base_catalog = load_catalog(path=refresh_file_path)
        else:
            # The file is not in the target or target-base directory
            self.load_artifacts_from_state()

    def create_relation(self, model, base=False):
        node = self.find_node_by_name(model, base)
        if node is None:
            return None

        return self.adapter.Relation.create_from(self.runtime_config, node)

    def export_state(self) -> RecceState:
        """
        Export the state to a RecceState object.
        """
        state = RecceState()
        state.metadata = RecceStateMetadata()

        # runs & checks
        state.runs = RunDAO().list()
        state.checks = CheckDAO().list()

        # artifacts & git & pull_request. If in review mode, use the review state
        if self.review_mode:
            state.artifacts = self.review_state.artifacts
            state.git = self.review_state.git
            state.pull_request = self.review_state.pull_request
        else:
            target_path = self.runtime_config.target_path
            target_base_path = 'target-base'

            def _load_artifact(path):
                if not os.path.isfile(path):
                    return None

                with open(path, 'r') as f:
                    json_content = f.read()
                    return json.loads(json_content)

            project_root = self.runtime_config.project_root
            state.artifacts.base = {
                'manifest': _load_artifact(os.path.join(project_root, target_base_path, 'manifest.json')),
                'catalog': _load_artifact(os.path.join(project_root, target_base_path, 'catalog.json')),
            }
            state.artifacts.current = {
                'manifest': _load_artifact(os.path.join(project_root, target_path, 'manifest.json')),
                'catalog': _load_artifact(os.path.join(project_root, target_path, 'catalog.json')),
            }

            git = GitRepoInfo.from_current_repositroy()
            if git:
                state.git = git

        return state

    def import_state(self, import_state: RecceState):
        """
        Import the state. It would
        1. Merge runs
        2. Merge checks
        """
        checks = CheckDAO().list()
        runs = RunDAO().list()
        current_check_ids = [str(c.check_id) for c in checks]
        current_run_ids = [str(r.run_id) for r in runs]

        # merge checks
        import_checks = 0
        for check in import_state.checks:
            if str(check.check_id) not in current_check_ids:
                checks.append(check)
                import_checks += 1

        # merge runs
        import_runs = 0
        for run in import_state.runs:
            if str(run.run_id) not in current_run_ids:
                runs.append(run)
                import_runs += 1

        runs.sort(key=lambda x: x.run_at)

        # Update to in-memory db

        load_runs(runs)
        load_checks(checks)

        return import_runs, import_checks


dbt_context: Optional[DBTContext] = None


def load_dbt_context(**kwargs) -> DBTContext:
    global dbt_context
    if dbt_context is None:
        dbt_context = DBTContext.load(**kwargs)
    return dbt_context


def default_dbt_context() -> DBTContext:
    global dbt_context
    return dbt_context
