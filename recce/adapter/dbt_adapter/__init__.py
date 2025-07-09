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
from typing import (
    Any,
    Callable,
    Dict,
    Iterator,
    List,
    Literal,
    Optional,
    Set,
    Tuple,
    Type,
    Union,
)

from recce.event import log_performance
from recce.exceptions import RecceException
from recce.util.cll import CLLPerformanceTracking, cll
from recce.util.lineage import (
    build_column_key,
    filter_dependency_maps,
    find_downstream,
    find_upstream,
)
from recce.util.perf_tracking import LineagePerfTracker

from ...tasks.profile import ProfileTask
from ...util.breaking import BreakingPerformanceTracking, parse_change_category

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

from ...models import RunType
from ...models.types import (
    CllColumn,
    CllData,
    CllNode,
    LineageDiff,
    NodeChange,
    NodeDiff,
)
from ...tasks import (
    HistogramDiffTask,
    ProfileDiffTask,
    QueryBaseTask,
    QueryDiffTask,
    QueryTask,
    RowCountDiffTask,
    RowCountTask,
    Task,
    TopKDiffTask,
    ValueDiffDetailTask,
    ValueDiffTask,
)
from .dbt_version import DbtVersion

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
    if hasattr(config, "adapter"):
        return config.adapter
    else:
        return get_adapter_orig(config)


dbt.adapters.factory.get_adapter = get_adapter

# All dbt import should after overwriting the get_adapter
from dbt.adapters.base import Column  # noqa: E402
from dbt.adapters.factory import get_adapter_class_by_name  # noqa: E402
from dbt.adapters.sql import SQLAdapter  # noqa: E402
from dbt.config.runtime import RuntimeConfig  # noqa: E402
from dbt.contracts.graph.manifest import (  # noqa: E402
    MacroManifest,
    Manifest,
    WritableManifest,
)
from dbt.contracts.graph.nodes import ManifestNode  # noqa: E402
from dbt.contracts.results import CatalogArtifact  # noqa: E402
from dbt.flags import set_from_args  # noqa: E402
from dbt.parser.manifest import process_node  # noqa: E402
from dbt.parser.sql import SqlBlockParser  # noqa: E402

dbt_version = DbtVersion()

if dbt_version < "v1.8":
    from dbt.contracts.connection import Connection
else:
    from dbt.adapters.contracts.connection import Connection


@contextmanager
def silence_no_nodes_warning():
    if dbt_version >= "v1.8":
        from dbt.events.types import NoNodesForSelectionCriteria
        from dbt_common.events.functions import WARN_ERROR_OPTIONS

        WARN_ERROR_OPTIONS.silence.append(NoNodesForSelectionCriteria.__name__)
    try:
        yield
    finally:
        if dbt_version >= "v1.8":
            from dbt_common.events.functions import WARN_ERROR_OPTIONS

            WARN_ERROR_OPTIONS.silence.pop()


logger = logging.getLogger("uvicorn")
MIN_DBT_NODE_COMPOSITION = 3


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
    if dbt_version < "v1.8":
        from dbt.clients.agate_helper import merge_tables

        return merge_tables(tables)
    else:
        from dbt_common.clients.agate_helper import merge_tables

        return merge_tables(tables)


def as_manifest(m: WritableManifest) -> Manifest:
    if dbt_version < "v1.8":
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
    if dbt_version < "v1.5.2":
        return PreviousState(state_path, target_path)
    else:
        try:
            # Overwrite the level_tag method temporarily to avoid the warning message
            from dbt.events.types import EventLevel, WarnStateTargetEqual

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
    if os.getenv("DBT_PROFILES_DIR"):
        return os.getenv("DBT_PROFILES_DIR")
    elif os.path.exists(os.path.join(os.getcwd(), "profiles.yml")):
        return os.getcwd()
    else:
        return os.path.expanduser("~/.dbt/")


@dataclass()
class DbtArgs:
    """
    Used for RuntimeConfig.from_args
    """

    threads: Optional[int] = (1,)
    target: Optional[str] = (None,)
    profiles_dir: Optional[str] = (None,)
    project_dir: Optional[str] = (None,)
    profile: Optional[str] = (None,)
    target_path: Optional[str] = (None,)
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

        return support_map

    @classmethod
    def load(cls, no_artifacts=False, review=False, **kwargs):
        target = kwargs.get("target")
        target_path = kwargs.get("target_path", "target")
        target_base_path = kwargs.get("target_base_path", "target-base")

        profile_name = kwargs.get("profile")
        project_dir = kwargs.get("project_dir")
        profiles_dir = kwargs.get("profiles_dir")

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
            which="list",
        )
        set_from_args(args, args)

        from dbt.exceptions import DbtProjectError

        try:
            # adapter
            if dbt_version < "v1.8":
                runtime_config = RuntimeConfig.from_args(args)
                adapter_name = runtime_config.credentials.type
                adapter_cls = get_adapter_class_by_name(adapter_name)
                adapter: SQLAdapter = adapter_cls(runtime_config)
            else:
                from dbt.mp_context import get_mp_context
                from dbt_common.context import (
                    get_invocation_context,
                    set_invocation_context,
                )

                set_invocation_context({})
                get_invocation_context()._env = dict(os.environ)
                runtime_config = RuntimeConfig.from_args(args)
                adapter_name = runtime_config.credentials.type
                adapter_cls = get_adapter_class_by_name(adapter_name)
                adapter: SQLAdapter = adapter_cls(runtime_config, get_mp_context())
                from dbt.adapters.factory import FACTORY

                FACTORY.adapters[adapter_name] = adapter

            adapter.connections.set_connection_name()
            runtime_config.adapter = adapter

            dbt_adapter = cls(
                runtime_config=runtime_config,
                adapter=adapter,
                review_mode=review,
                base_path=target_base_path,
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
        get_columns_macro = "get_columns_in_relation"
        if self.adapter.connections.TYPE == "databricks":
            get_columns_macro = "get_columns_comments"

        if dbt_version < "v1.8":
            columns = self.adapter.execute_macro(
                get_columns_macro, kwargs={"relation": relation}, manifest=self.manifest
            )
        else:
            from dbt.context.providers import generate_runtime_macro_context

            macro_manifest = MacroManifest(self.manifest.macros)
            self.adapter.set_macro_resolver(macro_manifest)
            self.adapter.set_macro_context_generator(generate_runtime_macro_context)
            columns = self.adapter.execute_macro(get_columns_macro, kwargs={"relation": relation})

        if self.adapter.connections.TYPE == "databricks":
            # reference: get_columns_in_relation (dbt/adapters/databricks/impl.py)
            from dbt.adapters.databricks import DatabricksColumn

            rows = columns
            columns = []
            for row in rows:
                if row["col_name"].startswith("#"):
                    break
                columns.append(
                    DatabricksColumn(
                        column=row["col_name"],
                        dtype=row["data_type"],
                        comment=row["comment"],
                    )
                )
            return columns
        else:
            return columns

    def get_model(self, model_id: str, base=False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        node = manifest_dict["nodes"].get(model_id)
        if node is None:
            return {}

        node_name = node["name"]
        with self.adapter.connection_named("model"):
            columns = [column for column in self.get_columns(node_name, base=base)]

        child_map: List[str] = manifest_dict["child_map"][model_id]
        cols_not_null = []
        cols_unique = []

        for child in child_map:
            comps = child.split(".")
            child_type = comps[0]
            child_name = comps[2]

            not_null_prefix = f"not_null_{node_name}_"
            if child_type == "test" and child_name.startswith(not_null_prefix):
                cols_not_null.append(child_name[len(not_null_prefix) :])
            unique_prefix = f"unique_{node_name}_"
            if child_type == "test" and child_name.startswith(unique_prefix):
                cols_unique.append(child_name[len(unique_prefix) :])

        columns_info = {}
        primary_key = None
        for c in columns:
            col_name = c.column
            col = dict(name=col_name, type=c.dtype)
            if col_name in cols_not_null:
                col["not_null"] = True
            if col_name in cols_unique:
                col["unique"] = True
                if not primary_key:
                    primary_key = col_name
            columns_info[col_name] = col

        result = dict(columns=columns_info)
        if primary_key:
            result["primary_key"] = primary_key

        return result

    def load_artifacts(self):
        """
        Load the artifacts from the 'target' and 'target-base' directory
        """
        if self.runtime_config is None:
            raise Exception("Cannot find the dbt project configuration")

        project_root = self.runtime_config.project_root
        target_path = self.runtime_config.target_path
        target_base_path = self.base_path
        self.target_path = os.path.join(project_root, target_path)
        self.base_path = os.path.join(project_root, target_base_path)

        # load the artifacts
        path = os.path.join(project_root, target_path, "manifest.json")
        curr_manifest = load_manifest(path=path)
        if curr_manifest is None:
            raise FileNotFoundError(ENOENT, os.strerror(ENOENT), path)
        path = os.path.join(project_root, target_base_path, "manifest.json")
        base_manifest = load_manifest(path=path)
        if base_manifest is None:
            raise FileNotFoundError(ENOENT, os.strerror(ENOENT), path)

        curr_catalog = load_catalog(path=os.path.join(project_root, target_path, "catalog.json"))
        base_catalog = load_catalog(path=os.path.join(project_root, target_base_path, "catalog.json"))

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
            os.path.join(project_root, target_path, "manifest.json"),
            os.path.join(project_root, target_path, "catalog.json"),
            os.path.join(project_root, target_base_path, "manifest.json"),
            os.path.join(project_root, target_base_path, "catalog.json"),
        ]

    def is_python_model(self, node_id: str, base: Optional[bool] = False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        model = manifest.nodes.get(node_id)
        if hasattr(model, "language"):
            return model.language == "python"

        return False

    def find_node_by_name(self, node_name, base=False) -> Optional[ManifestNode]:
        manifest = self.curr_manifest if base is False else self.base_manifest

        for key, node in manifest.nodes.items():
            if node.name == node_name:
                return node

        return None

    def get_node_name_by_id(self, unique_id):
        if unique_id.startswith("source."):
            if unique_id in self.curr_manifest.sources:
                return self.curr_manifest.sources[unique_id].name
            elif unique_id in self.base_manifest.sources:
                return self.base_manifest.sources[unique_id].name
        elif unique_id.startswith("metric."):
            if unique_id in self.curr_manifest.metrics:
                return self.curr_manifest.metrics[unique_id].name
            elif unique_id in self.base_manifest.metrics:
                return self.base_manifest.metrics[unique_id].name
        elif unique_id.startswith("exposure."):
            if unique_id in self.curr_manifest.exposures:
                return self.curr_manifest.exposures[unique_id].name
            elif unique_id in self.base_manifest.exposures:
                return self.base_manifest.exposures[unique_id].name
        elif unique_id.startswith("semantic_model."):
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

    def generate_sql(
        self,
        sql_template: str,
        base: bool = False,
        context=None,
        provided_manifest=None,
    ):
        if context is None:
            context = {}
        manifest = provided_manifest if provided_manifest is not None else as_manifest(self.get_manifest(base))
        parser = SqlBlockParser(self.runtime_config, manifest, self.runtime_config)

        if dbt_version >= dbt_version.parse("v1.8"):
            from dbt_common.context import (
                get_invocation_context,
                set_invocation_context,
            )

            set_invocation_context({})
            get_invocation_context()._env = dict(os.environ)

        node_id = str("generated_" + uuid.uuid4().hex)
        node = parser.parse_remote(sql_template, node_id)
        process_node(self.runtime_config, manifest, node)

        if dbt_version < dbt_version.parse("v1.8"):
            compiler = self.adapter.get_compiler()
            compiler.compile_node(node, manifest, context)
            return node.compiled_code
        else:
            from dbt.clients import jinja
            from dbt.context.providers import generate_runtime_model_context

            jinja_ctx = generate_runtime_model_context(node, self.runtime_config, manifest)
            jinja_ctx.update(context)
            compiled_code = jinja.get_rendered(sql_template, jinja_ctx, node)
            return compiled_code

    def execute(
        self,
        sql: str,
        auto_begin: bool = False,
        fetch: bool = False,
        limit: Optional[int] = None,
    ) -> Tuple[any, agate.Table]:
        if dbt_version < dbt_version.parse("v1.6"):
            return self.adapter.execute(sql, auto_begin=auto_begin, fetch=fetch)

        return self.adapter.execute(sql, auto_begin=auto_begin, fetch=fetch, limit=limit)

    def build_parent_map(self, nodes: Dict, base: Optional[bool] = False) -> Dict[str, List[str]]:
        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        node_ids = nodes.keys()
        parent_map = {}
        for k, parents in manifest_dict["parent_map"].items():
            if k not in node_ids:
                continue
            parent_map[k] = [parent for parent in parents if parent in node_ids]

        return parent_map

    def build_parent_list_per_node(self, node_id: str, base: Optional[bool] = False) -> List[str]:
        manifest = self.curr_manifest if base is False else self.base_manifest
        manifest_dict = manifest.to_dict()

        if node_id in manifest_dict["parent_map"]:
            return manifest_dict["parent_map"][node_id]

    def get_lineage(self, base: Optional[bool] = False):
        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog
        cache_key = hash((id(manifest), id(catalog)))
        return self.get_lineage_cached(base, cache_key)

    def get_lineage_diff(self) -> LineageDiff:
        cache_key = hash(
            (
                id(self.base_manifest),
                id(self.base_catalog),
                id(self.curr_manifest),
                id(self.curr_catalog),
            )
        )
        return self._get_lineage_diff_cached(cache_key)

    @lru_cache(maxsize=2)
    def get_lineage_cached(self, base: Optional[bool] = False, cache_key=0):
        if base is False:
            perf_tracker = LineagePerfTracker()
            perf_tracker.start_lineage()

        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog

        manifest_metadata = manifest.metadata if manifest is not None else None
        catalog_metadata = catalog.metadata if catalog is not None else None

        manifest_dict = manifest.to_dict()

        nodes = {}

        for node in manifest_dict["nodes"].values():
            unique_id = node["unique_id"]
            resource_type = node["resource_type"]

            if resource_type not in ["model", "seed", "exposure", "snapshot"]:
                continue

            nodes[unique_id] = {
                "id": node["unique_id"],
                "name": node["name"],
                "resource_type": node["resource_type"],
                "package_name": node["package_name"],
                "schema": node["schema"],
                "config": node["config"],
                "checksum": node["checksum"],
                "raw_code": node["raw_code"],
            }

            # List of <type>.<package_name>.<node_name>.<hash>
            # model.jaffle_shop.customer_segments
            # test.jaffle_shop.not_null_customers_customer_id.5c9bf9911d
            # test.jaffle_shop.unique_customers_customer_id.c5af1ff4b1
            child_map: List[str] = manifest_dict["child_map"][unique_id]
            cols_not_null = []
            cols_unique = []

            for child in child_map:
                node_name = node["name"]
                comps = child.split(".")
                if len(comps) < MIN_DBT_NODE_COMPOSITION:
                    # only happens in unittest
                    continue

                child_type = comps[0]
                child_name = comps[2]

                not_null_prefix = f"not_null_{node_name}_"
                if child_type == "test" and child_name.startswith(not_null_prefix):
                    cols_not_null.append(child_name[len(not_null_prefix) :])
                unique_prefix = f"unique_{node_name}_"
                if child_type == "test" and child_name.startswith(unique_prefix):
                    cols_unique.append(child_name[len(unique_prefix) :])

            if catalog is not None and unique_id in catalog.nodes:
                columns = {}
                primary_key = None
                for col_name, col_metadata in catalog.nodes[unique_id].columns.items():
                    col = dict(name=col_name, type=col_metadata.type)
                    if col_name in cols_not_null:
                        col["not_null"] = True
                    if col_name in cols_unique:
                        col["unique"] = True
                        if not primary_key:
                            primary_key = col_name
                    columns[col_name] = col
                nodes[unique_id]["columns"] = columns
                if primary_key:
                    nodes[unique_id]["primary_key"] = primary_key

        for source in manifest_dict["sources"].values():
            unique_id = source["unique_id"]

            nodes[unique_id] = {
                "id": source["unique_id"],
                "name": source["name"],
                "resource_type": source["resource_type"],
                "package_name": source["package_name"],
                "config": source["config"],
            }

            if catalog is not None and unique_id in catalog.sources:
                nodes[unique_id]["columns"] = {
                    col_name: {"name": col_name, "type": col_metadata.type}
                    for col_name, col_metadata in catalog.sources[unique_id].columns.items()
                }

        for exposure in manifest_dict["exposures"].values():
            nodes[exposure["unique_id"]] = {
                "id": exposure["unique_id"],
                "name": exposure["name"],
                "resource_type": exposure["resource_type"],
                "package_name": exposure["package_name"],
                "config": exposure["config"],
            }
        for metric in manifest_dict["metrics"].values():
            nodes[metric["unique_id"]] = {
                "id": metric["unique_id"],
                "name": metric["name"],
                "resource_type": metric["resource_type"],
                "package_name": metric["package_name"],
                "config": metric["config"],
            }

        if "semantic_models" in manifest_dict:
            for semantic_models in manifest_dict["semantic_models"].values():
                nodes[semantic_models["unique_id"]] = {
                    "id": semantic_models["unique_id"],
                    "name": semantic_models["name"],
                    "resource_type": semantic_models["resource_type"],
                    "package_name": semantic_models["package_name"],
                    "config": semantic_models["config"],
                }

        parent_map = self.build_parent_map(nodes, base)

        if base is False:
            perf_tracker.end_lineage()
            perf_tracker.set_total_nodes(len(nodes))
            log_performance("model lineage", perf_tracker.to_dict())
            perf_tracker.reset()

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

        modified_nodes = self.select_nodes(select="state:modified")
        diff = {}
        for node_id in modified_nodes:
            base_node = base.get("nodes", {}).get(node_id)
            curr_node = current.get("nodes", {}).get(node_id)
            if base_node and curr_node:
                diff[node_id] = NodeDiff(change_status="modified")
            elif base_node:
                diff[node_id] = NodeDiff(change_status="removed")
            elif curr_node:
                diff[node_id] = NodeDiff(change_status="added")

        return LineageDiff(
            base=base,
            current=current,
            diff=diff,
        )

    @lru_cache(maxsize=128)
    def get_change_analysis_cached(self, node_id: str):
        breaking_perf_tracker = BreakingPerformanceTracking()
        lineage_diff = self.get_lineage_diff()
        diff = lineage_diff.diff

        if node_id not in diff or diff[node_id].change_status != "modified":
            return diff.get(node_id)

        breaking_perf_tracker.increment_modified_nodes()
        breaking_perf_tracker.start_lineage_diff()

        base = lineage_diff.base
        current = lineage_diff.current

        base_manifest = as_manifest(self.get_manifest(True))
        curr_manifest = as_manifest(self.get_manifest(False))
        breaking_perf_tracker.record_checkpoint("manifest")

        def ref_func(*args):
            if len(args) == 1:
                node = args[0]
            elif len(args) > 1:
                node = args[1]
            else:
                return None
            return node

        def source_func(source_name, table_name):
            source_name = source_name.replace("-", "_")
            return f"__{source_name}__{table_name}"

        jinja_context = dict(
            ref=ref_func,
            source=source_func,
        )

        base_node = base.get("nodes", {}).get(node_id)
        curr_node = current.get("nodes", {}).get(node_id)
        change = NodeChange(category="unknown")
        if (
            curr_node.get("resource_type") in ["model", "snapshot"]
            and curr_node.get("raw_code") is not None
            and base_node.get("raw_code") is not None
        ):
            try:

                def _get_schema(lineage):
                    schema = {}
                    nodes = lineage["nodes"]
                    parent_list = lineage["parent_map"].get(node_id, [])
                    for parent_id in parent_list:
                        parent_node = nodes.get(parent_id)
                        if parent_node is None:
                            continue
                        columns = parent_node.get("columns") or {}
                        name = parent_node.get("name")
                        if parent_node.get("resource_type") == "source":
                            parts = parent_id.split(".")
                            source = parts[2]
                            table = parts[3]
                            source = source.replace("-", "_")
                            name = f"__{source}__{table}"
                        schema[name] = {name: column.get("type") for name, column in columns.items()}
                    return schema

                base_sql = self.generate_sql(
                    base_node.get("raw_code"),
                    context=jinja_context,
                    provided_manifest=base_manifest,
                )
                curr_sql = self.generate_sql(
                    curr_node.get("raw_code"),
                    context=jinja_context,
                    provided_manifest=curr_manifest,
                )
                base_schema = _get_schema(base)
                curr_schema = _get_schema(current)
                dialect = self.adapter.connections.TYPE
                if curr_manifest.metadata.adapter_type is not None:
                    dialect = curr_manifest.metadata.adapter_type

                change = parse_change_category(
                    base_sql,
                    curr_sql,
                    old_schema=base_schema,
                    new_schema=curr_schema,
                    dialect=dialect,
                    perf_tracking=breaking_perf_tracker,
                )

                # Make sure that the case of the column names are the same
                changed_columns = {
                    column.lower(): change_status for column, change_status in (change.columns or {}).items()
                }
                changed_columns_names = set(changed_columns)
                changed_columns_final = {}

                base_columns = base_node.get("columns") or {}
                curr_columns = curr_node.get("columns") or {}
                columns_names = set(base_columns) | set(curr_columns)

                for column_name in columns_names:
                    if column_name.lower() in changed_columns_names:
                        changed_columns_final[column_name] = changed_columns[column_name.lower()]

                change.columns = changed_columns_final
            except Exception:
                # TODO: telemetry
                pass

        breaking_perf_tracker.end_lineage_diff()
        log_performance("change analysis per node", breaking_perf_tracker.to_dict())
        breaking_perf_tracker.reset()
        node_diff = diff.get(node_id)
        node_diff.change = change
        return node_diff

    def get_cll(
        self,
        node_id: Optional[str] = None,
        column: Optional[str] = None,
        change_analysis: Optional[bool] = False,
        no_cll: Optional[bool] = False,
        no_upstream: Optional[bool] = False,
        no_downstream: Optional[bool] = False,
        no_filter: Optional[bool] = False,
    ) -> CllData:
        cll_tracker = LineagePerfTracker()
        cll_tracker.set_params(
            has_node=node_id is not None,
            has_column=column is not None,
            change_analysis=change_analysis,
            no_cll=no_cll,
            no_upstream=no_upstream,
            no_downstream=no_downstream,
        )
        cll_tracker.start_column_lineage()

        manifest = self.curr_manifest
        manifest_dict = manifest.to_dict()

        # Find related model nodes
        if node_id is not None:
            cll_node_ids = {node_id}
        else:
            lineage_diff = self.get_lineage_diff()
            cll_node_ids = set(lineage_diff.diff.keys())

        cll_tracker.set_init_nodes(len(cll_node_ids))

        nodes = {}
        columns = {}
        parent_map = {}
        child_map = {}

        if not no_upstream:
            cll_node_ids = cll_node_ids.union(find_upstream(cll_node_ids, manifest_dict.get("parent_map")))
        if not no_downstream:
            cll_node_ids = cll_node_ids.union(find_downstream(cll_node_ids, manifest_dict.get("child_map")))

        if not no_cll:
            allowed_related_nodes = set()
            for key in ["sources", "nodes", "exposures", "metrics"]:
                attr = getattr(manifest, key)
                allowed_related_nodes.update(set(attr.keys()))
            if hasattr(manifest, "semantic_models"):
                attr = getattr(manifest, "semantic_models")
                allowed_related_nodes.update(set(attr.keys()))
            for cll_node_id in cll_node_ids:
                if cll_node_id not in allowed_related_nodes:
                    continue
                cll_data_one = deepcopy(self.get_cll_cached(cll_node_id, base=False))
                cll_tracker.increment_cll_nodes()
                if cll_data_one is None:
                    continue

                nodes[cll_node_id] = cll_data_one.nodes.get(cll_node_id)
                node_diff = None
                if change_analysis:
                    node_diff = self.get_change_analysis_cached(cll_node_id)
                    cll_tracker.increment_change_analysis_nodes()
                if node_diff is not None:
                    nodes[cll_node_id].change_status = node_diff.change_status
                    if node_diff.change is not None:
                        nodes[cll_node_id].change_category = node_diff.change.category
                for c_id, c in cll_data_one.columns.items():
                    columns[c_id] = c
                    if node_diff is not None:
                        if node_diff.change_status == "added":
                            c.change_status = "added"
                        elif node_diff.change_status == "removed":
                            c.change_status = "removed"
                        elif node_diff.change is not None and node_diff.change.columns is not None:
                            column_diff = node_diff.change.columns.get(c.name)
                            if column_diff:
                                c.change_status = column_diff

                for p_id, parents in cll_data_one.parent_map.items():
                    parent_map[p_id] = parents
        else:
            for cll_node_id in cll_node_ids:
                cll_node = None
                cll_node_columns: Dict[str, CllColumn] = {}

                if cll_node_id in manifest.sources:
                    cll_node = CllNode.build_cll_node(manifest, "sources", cll_node_id)
                    if self.curr_catalog and cll_node_id in self.curr_catalog.sources:
                        cll_node_columns = {
                            column.name: CllColumn(
                                id=f"{cll_node_id}_{column.name}",
                                table_id=cll_node_id,
                                name=column.name,
                                type=column.type,
                            )
                            for column in self.curr_catalog.sources[cll_node_id].columns.values()
                        }
                elif cll_node_id in manifest.nodes:
                    cll_node = CllNode.build_cll_node(manifest, "nodes", cll_node_id)
                    if self.curr_catalog and cll_node_id in self.curr_catalog.nodes:
                        cll_node_columns = {
                            column.name: CllColumn(
                                id=f"{cll_node_id}_{column.name}",
                                table_id=cll_node_id,
                                name=column.name,
                                type=column.type,
                            )
                            for column in self.curr_catalog.nodes[cll_node_id].columns.values()
                        }
                elif cll_node_id in manifest.exposures:
                    cll_node = CllNode.build_cll_node(manifest, "exposures", cll_node_id)
                elif hasattr(manifest, "semantic_models") and cll_node_id in manifest.semantic_models:
                    cll_node = CllNode.build_cll_node(manifest, "semantic_models", cll_node_id)
                elif cll_node_id in manifest.metrics:
                    cll_node = CllNode.build_cll_node(manifest, "metrics", cll_node_id)

                if not cll_node:
                    continue
                nodes[cll_node_id] = cll_node

                node_diff = None
                if change_analysis:
                    node_diff = self.get_change_analysis_cached(cll_node_id)
                    cll_tracker.increment_change_analysis_nodes()
                if node_diff is not None:
                    cll_node.change_status = node_diff.change_status
                    if node_diff.change is not None:
                        cll_node.change_category = node_diff.change.category
                        for c, cll_column in cll_node_columns.items():
                            cll_node.columns[c] = cll_column
                            columns[cll_column.id] = cll_column
                            if node_diff.change.columns and c in node_diff.change.columns:
                                cll_column.change_status = node_diff.change.columns[c]

                parent_map[cll_node_id] = manifest.parent_map.get(cll_node_id, [])

        # build the child map
        for parent_id, parents in parent_map.items():
            for parent in parents:
                if parent not in child_map:
                    child_map[parent] = set()
                child_map[parent].add(parent_id)

        # Find the anchor nodes
        anchor_node_ids = set()
        extra_node_ids = set()
        if node_id is None and column is None:
            if change_analysis:
                # If change analysis is requested, we need to find the nodes that have changes
                lineage_diff = self.get_lineage_diff()
                for nid, nd in lineage_diff.diff.items():
                    if nd.change_status == "added":
                        anchor_node_ids.add(nid)
                        n = lineage_diff.current["nodes"].get(nid)
                        n_columns = n.get("columns", {})
                        for c in n_columns:
                            anchor_node_ids.add(build_column_key(nid, c))
                        continue
                    if nd.change_status == "removed":
                        extra_node_ids.add(nid)
                        continue

                    node_diff = self.get_change_analysis_cached(nid)
                    if node_diff is not None and node_diff.change is not None:
                        extra_node_ids.add(nid)
                        if no_cll:
                            if node_diff.change.category in ["breaking", "partial_breaking", "unknown"]:
                                anchor_node_ids.add(nid)
                        else:
                            if node_diff.change.category in ["breaking", "unknown"]:
                                anchor_node_ids.add(nid)
                        if node_diff.change.columns is not None:
                            for column_name in node_diff.change.columns:
                                anchor_node_ids.add(f"{nid}_{column_name}")
            else:
                lineage_diff = self.get_lineage_diff()
                anchor_node_ids = lineage_diff.diff.keys()
        elif node_id is not None and column is None:
            if change_analysis:
                # If change analysis is requested, we need to find the nodes that have changes
                node_diff = self.get_change_analysis_cached(node_id)
                if node_diff is not None and node_diff.change is not None:
                    extra_node_ids.add(node_id)
                    if no_cll:
                        if node_diff.change.category in ["breaking", "partial_breaking", "unknown"]:
                            anchor_node_ids.add(node_id)
                    else:
                        if node_diff.change.category in ["breaking", "unknown"]:
                            anchor_node_ids.add(node_id)
                    if node_diff.change.columns is not None:
                        for column_name in node_diff.change.columns:
                            anchor_node_ids.add(f"{node_id}_{column_name}")
                else:
                    anchor_node_ids.add(node_id)
            else:
                anchor_node_ids.add(node_id)
                if not no_cll:
                    node = nodes.get(node_id)
                    if node:
                        for column_name in node.columns:
                            column_key = build_column_key(node_id, column_name)
                            anchor_node_ids.add(column_key)
        else:
            anchor_node_ids.add(f"{node_id}_{column}")

        cll_tracker.set_anchor_nodes(len(anchor_node_ids))
        result_node_ids = set(anchor_node_ids)
        if not no_upstream:
            result_node_ids = result_node_ids.union(find_upstream(anchor_node_ids, parent_map))
        if not no_downstream:
            result_node_ids = result_node_ids.union(find_downstream(anchor_node_ids, child_map))

        # Filter the nodes and columns based on the anchor nodes
        if not no_filter:
            nodes = {k: v for k, v in nodes.items() if k in result_node_ids or k in extra_node_ids}
            columns = {k: v for k, v in columns.items() if k in result_node_ids or k in extra_node_ids}

            for node in nodes.values():
                node.columns = {
                    k: v for k, v in node.columns.items() if v.id in result_node_ids or v.id in extra_node_ids
                }

                if change_analysis:
                    node.impacted = node.id in result_node_ids

            parent_map, child_map = filter_dependency_maps(parent_map, child_map, result_node_ids)

        cll_tracker.end_column_lineage()
        cll_tracker.set_total_nodes(len(nodes) + len(columns))
        log_performance("column level lineage", cll_tracker.to_dict())
        cll_tracker.reset()

        return CllData(
            nodes=nodes,
            columns=columns,
            parent_map=parent_map,
            child_map=child_map,
        )

    @lru_cache(maxsize=128)
    def get_cll_cached(self, node_id: str, base: Optional[bool] = False) -> Optional[CllData]:
        cll_tracker = CLLPerformanceTracking()

        node, parent_list = self.get_cll_node(node_id, base=base)
        if node is None:
            return None

        cll_tracker.set_total_nodes(1)
        cll_tracker.start_column_lineage()

        def _apply_all_columns(node: CllNode, transformation_type):
            cll_data = CllData()
            cll_data.nodes[node.id] = node
            cll_data.parent_map[node.id] = set(parent_list)
            for col in node.columns.values():
                column_id = f"{node.id}_{col.name}"
                col.transformation_type = transformation_type
                cll_data.columns[column_id] = col
                cll_data.parent_map[column_id] = set()
            return cll_data

        manifest = as_manifest(self.get_manifest(base))
        catalog = self.curr_catalog if base is False else self.base_catalog
        resource_type = node.resource_type
        if resource_type not in {"model", "seed", "source", "snapshot"}:
            return _apply_all_columns(node, "unknown")

        if resource_type == "source" or resource_type == "seed":
            return _apply_all_columns(node, "source")

        if node.raw_code is None or self.is_python_model(node.id, base=base):
            return _apply_all_columns(node, "unknown")

        if node.name == "metricflow_time_spine":
            return _apply_all_columns(node, "source")

        if not node.columns:
            return _apply_all_columns(node, "unknown")

        table_id_map = {}

        def ref_func(*args):
            node_name: str = None
            project_or_package: str = None

            if len(args) == 1:
                node_name = args[0]
            else:
                project_or_package = args[0]
                node_name = args[1]

            for key, n in manifest.nodes.items():
                if n.name != node_name:
                    continue
                if project_or_package is not None and n.package_name != project_or_package:
                    continue

                # replace id "." to "_"
                unique_id = n.unique_id
                table_name = unique_id.replace(".", "_")
                table_id_map[table_name.lower()] = unique_id
                return table_name

            raise ValueError(f"Cannot find node {node_name} in the manifest")

        def source_func(source_name, name):
            for key, n in manifest.sources.items():
                if n.source_name != source_name:
                    continue
                if n.name != name:
                    continue

                # replace id "." to "_"
                unique_id = n.unique_id
                table_name = unique_id.replace(".", "_")
                table_id_map[table_name.lower()] = unique_id
                return table_name

            raise ValueError(f"Cannot find source {source_name}.{name} in the manifest")

        raw_code = node.raw_code
        jinja_context = dict(
            ref=ref_func,
            source=source_func,
        )

        schema = {}
        if catalog is not None:
            for parent_id in parent_list:
                table_name = parent_id.replace(".", "_")
                columns = {}
                if parent_id in catalog.nodes:
                    for col_name, col_metadata in catalog.nodes[parent_id].columns.items():
                        columns[col_name] = col_metadata.type
                if parent_id in catalog.sources:
                    for col_name, col_metadata in catalog.sources[parent_id].columns.items():
                        columns[col_name] = col_metadata.type
                schema[table_name] = columns

        try:
            compiled_sql = self.generate_sql(raw_code, base=base, context=jinja_context, provided_manifest=manifest)
            dialect = self.adapter.type()
            if self.get_manifest(base).metadata.adapter_type is not None:
                dialect = self.get_manifest(base).metadata.adapter_type
            m2c, c2c_map = cll(compiled_sql, schema=schema, dialect=dialect)
        except RecceException:
            cll_tracker.increment_sqlglot_error_nodes()
            return _apply_all_columns(node, "unknown")
        except Exception:
            cll_tracker.increment_other_error_nodes()
            return _apply_all_columns(node, "unknown")

        # Add cll dependency to the node.
        cll_data = CllData()
        cll_data.nodes[node.id] = node
        cll_data.columns = {f"{node.id}_{col.name}": col for col in node.columns.values()}

        # parent map for node
        depends_on = set(parent_list)
        for d in m2c:
            parent_key = f"{table_id_map[d.node.lower()]}_{d.column}"
            depends_on.add(parent_key)
        cll_data.parent_map[node_id] = depends_on

        # parent map for columns
        for name, column in node.columns.items():
            depends_on = set()
            column_id = f"{node.id}_{name}"
            if name in c2c_map:
                for d in c2c_map[name].depends_on:
                    parent_key = f"{table_id_map[d.node.lower()]}_{d.column}"
                    depends_on.add(parent_key)
                column.transformation_type = c2c_map[name].transformation_type
            cll_data.parent_map[column_id] = set(depends_on)

        cll_tracker.end_column_lineage()
        log_performance("column level lineage per node", cll_tracker.to_dict())
        cll_tracker.reset()
        return cll_data

    def get_cll_node(self, node_id: str, base: Optional[bool] = False) -> Tuple[Optional[CllNode], list[str]]:
        manifest = self.curr_manifest if base is False else self.base_manifest
        catalog = self.curr_catalog if base is False else self.base_catalog
        parent_list = []
        node = None

        # model, seed, snapshot
        if node_id in manifest.nodes:
            found = manifest.nodes[node_id]
            unique_id = found.unique_id
            node = CllNode.build_cll_node(manifest, "nodes", node_id)
            if hasattr(found.depends_on, "nodes"):
                parent_list = found.depends_on.nodes

            if catalog is not None and node is not None and unique_id in catalog.nodes:
                columns = {}
                for col_name, col_metadata in catalog.nodes[unique_id].columns.items():
                    column_id = f"{unique_id}_{col_name}"
                    col = CllColumn(id=column_id, name=col_name, table_id=unique_id, type=col_metadata.type)
                    columns[col_name] = col
                node.columns = columns

        # source
        if node_id in manifest.sources:
            found = manifest.sources[node_id]
            unique_id = found.unique_id
            node = CllNode.build_cll_node(manifest, "sources", node_id)
            parent_list = []

            if catalog is not None and node is not None and unique_id in catalog.sources:
                columns = {}
                for col_name, col_metadata in catalog.sources[unique_id].columns.items():
                    column_id = f"{unique_id}_{col_name}"
                    col = CllColumn(id=column_id, name=col_name, table_id=unique_id, type=col_metadata.type)
                    columns[col_name] = col
                node.columns = columns

        # exposure
        if node_id in manifest.exposures:
            found = manifest.exposures[node_id]
            node = CllNode.build_cll_node(manifest, "exposures", node_id)
            if hasattr(found.depends_on, "nodes"):
                parent_list = found.depends_on.nodes

        if hasattr(manifest, "semantic_models") and node_id in manifest.semantic_models:
            found = manifest.semantic_models[node_id]
            node = CllNode.build_cll_node(manifest, "semantic_models", node_id)
            if hasattr(found.depends_on, "nodes"):
                parent_list = found.depends_on.nodes

        if node_id in manifest.metrics:
            found = manifest.metrics[node_id]
            node = CllNode.build_cll_node(manifest, "metrics", node_id)
            if hasattr(found.depends_on, "nodes"):
                parent_list = found.depends_on.nodes

        return node, parent_list

    def get_manifests_by_id(self, unique_id: str):
        curr_manifest = self.get_manifest(base=False)
        base_manifest = self.get_manifest(base=True)
        if unique_id in curr_manifest.nodes.keys() or unique_id in base_manifest.nodes.keys():
            return {
                "current": curr_manifest.nodes.get(unique_id),
                "base": base_manifest.nodes.get(unique_id),
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
            logger.info("Start monitoring dbt artifacts")

    def stop_monitor_artifacts(self):
        if self.artifacts_files:
            self.artifacts_observer.stop()
            self.artifacts_observer.join()
            logger.info("Stop monitoring artifacts")

    def start_monitor_base_env(self, callback: Callable = None):
        target_base_dir = os.path.join(self.runtime_config.project_root, "target-base")
        base_env_files = {
            os.path.join(target_base_dir, "manifest.json"),
            os.path.join(target_base_dir, "catalog.json"),
        }
        event_handler = EnvironmentEventHandler(self.base_env_observer, base_env_files, callback=callback)
        self.base_env_observer.schedule(event_handler, self.runtime_config.project_root, recursive=True)
        self.base_env_observer.start()
        logger.info("Start monitoring base environment")

    def stop_monitor_base_env(self):
        if self.base_env_observer.is_alive():
            self.base_env_observer.stop()
        self.base_env_observer.join()
        logger.info("Stop monitoring base environment")

    def set_artifacts(
        self,
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
            Path(self.runtime_config.project_root),
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
            if refresh_file_path.endswith("manifest.json"):
                self.curr_manifest = load_manifest(path=refresh_file_path)
                self.manifest = as_manifest(self.curr_manifest)
                self.get_cll_cached.cache_clear()
                self.get_change_analysis_cached.cache_clear()
            elif refresh_file_path.endswith("catalog.json"):
                self.curr_catalog = load_catalog(path=refresh_file_path)
                self.get_cll_cached.cache_clear()
                self.get_change_analysis_cached.cache_clear()
        elif self.base_path and target_type == os.path.basename(self.base_path):
            if refresh_file_path.endswith("manifest.json"):
                self.base_manifest = load_manifest(path=refresh_file_path)
                self.get_change_analysis_cached.cache_clear()
            elif refresh_file_path.endswith("catalog.json"):
                self.base_catalog = load_catalog(path=refresh_file_path)
                self.get_change_analysis_cached.cache_clear()

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
        view_mode: Optional[Literal["all", "changed_models"]] = None,
    ) -> Set[str]:
        import dbt.compilation
        from dbt.compilation import Compiler
        from dbt.graph import (
            NodeSelector,
            SelectionIntersection,
            SelectionUnion,
            parse_difference,
        )

        select_list = [select] if select else None
        exclude_list = [exclude] if exclude else None

        def _parse_difference(include, exclude):
            if dbt_version < "v1.8":
                return parse_difference(include, exclude, "eager")
            else:
                return parse_difference(include, exclude)

        specs = [_parse_difference(select_list, exclude_list)]

        if packages is not None:
            package_spec = SelectionUnion([_parse_difference([f"package:{p}"], None) for p in packages])
            specs.append(package_spec)
        if view_mode and view_mode == "changed_models":
            specs.append(_parse_difference(["1+state:modified+"], None))
        spec = SelectionIntersection(specs)

        manifest = Manifest()
        manifest.metadata.adapter_type = self.adapter.type()
        manifest_prev = self.previous_state.manifest
        manifest_curr = self.manifest

        manifest.nodes = {**manifest_curr.nodes}
        # # mark a node is removed if the node id is no in the curr nodes
        for node_id, node in manifest_prev.nodes.items():
            if node_id not in manifest.nodes:
                node_dict = node.to_dict()
                if "raw_code" in node_dict:
                    node_dict["raw_code"] = "__removed__"
                node_class = type(node)
                removed_node = node_class.from_dict(node_dict)
                manifest.nodes[node_id] = removed_node

        manifest.macros = {**manifest_prev.macros, **manifest_curr.macros}
        manifest.sources = {**manifest_prev.sources, **manifest_curr.sources}
        manifest.exposures = {**manifest_prev.exposures, **manifest_curr.exposures}
        manifest.metrics = {**manifest_prev.metrics, **manifest_curr.metrics}
        if hasattr(manifest_prev, "semantic_models"):
            manifest.semantic_models = {
                **manifest_prev.semantic_models,
                **manifest_curr.semantic_models,
            }

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
        """
        Export the artifacts from the current state
        """
        artifacts = ArtifactsRoot()

        def _load_artifact(artifact):
            return artifact.to_dict() if artifact else None

        artifacts.base = {
            "manifest": _load_artifact(self.base_manifest),
            "catalog": _load_artifact(self.base_catalog),
        }
        artifacts.current = {
            "manifest": _load_artifact(self.curr_manifest),
            "catalog": _load_artifact(self.curr_catalog),
        }
        return artifacts

    def export_artifacts_from_file(self) -> ArtifactsRoot:
        """
        Export the artifacts from the state file. This is the old implementation
        """
        artifacts = ArtifactsRoot()
        target_path = self.runtime_config.target_path
        target_base_path = self.base_path

        def _load_artifact(path):
            if not os.path.isfile(path):
                return None

            with open(path, "r") as f:
                json_content = f.read()
                return json.loads(json_content)

        project_root = self.runtime_config.project_root
        artifacts.base = {
            "manifest": _load_artifact(os.path.join(project_root, target_base_path, "manifest.json")),
            "catalog": _load_artifact(os.path.join(project_root, target_base_path, "catalog.json")),
        }
        artifacts.current = {
            "manifest": _load_artifact(os.path.join(project_root, target_path, "manifest.json")),
            "catalog": _load_artifact(os.path.join(project_root, target_path, "catalog.json")),
        }
        return artifacts

    def import_artifacts(self, artifacts: ArtifactsRoot, merge=True):
        # Merge the artifacts from the state file or cloud
        def _select_artifact(
            original: Union[WritableManifest, CatalogArtifact],
            new: Union[WritableManifest, CatalogArtifact],
        ):
            if merge:
                if not original:
                    return new
                if not new:
                    return original
                return original if original.metadata.generated_at > new.metadata.generated_at else new
            else:
                return new

        self.base_manifest = _select_artifact(self.base_manifest, load_manifest(data=artifacts.base.get("manifest")))
        self.curr_manifest = _select_artifact(self.curr_manifest, load_manifest(data=artifacts.current.get("manifest")))
        self.base_catalog = _select_artifact(self.base_catalog, load_catalog(data=artifacts.base.get("catalog")))
        self.curr_catalog = _select_artifact(self.curr_catalog, load_catalog(data=artifacts.current.get("catalog")))

        self.manifest = as_manifest(self.curr_manifest)
        self.previous_state = previous_state(
            Path(self.base_path),
            Path(self.runtime_config.target_path),
            Path(self.runtime_config.project_root),
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
                "No enough dbt artifacts in the state file. Please use the latest recce to generate the recce state"
            )

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
