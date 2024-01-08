import hashlib
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, fields
from typing import Callable, Dict, List, Optional, Union

import agate
import pandas as pd
from dbt.adapters.factory import get_adapter_by_type
from dbt.adapters.sql import SQLAdapter
from dbt.cli.main import dbtRunner
from dbt.config.profile import Profile
from dbt.config.project import Project
from dbt.config.runtime import load_profile, load_project
from dbt.contracts.files import FileHash
from dbt.contracts.graph.manifest import Manifest, WritableManifest
from dbt.contracts.graph.model_config import ContractConfig, NodeConfig
from dbt.contracts.graph.nodes import Contract, DependsOn, ManifestNode, ModelNode, ResultNode, SourceDefinition
from dbt.contracts.graph.unparsed import Docs
from dbt.contracts.results import CatalogArtifact
from dbt.node_types import AccessType, ModelLanguage, NodeType
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from recce.util.cache import LRUCache

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
    row_count_cache = LRUCache(32)

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

        if not parse_result.success:
            sys.exit(1)

        if project_dir is None:
            project_path = os.getcwd()
        else:
            project_path = project_dir

        # The option 'profiles_dir' will be added into dbt global flags when we invoke dbt parse.
        # The function 'load_profile' will use the global flags to load the profile.
        profile = load_profile(project_path, {}, profile_name_override=profile_name, target_override=target)
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
        with adapter.connection_named('recce'):
            sql = self.generate_sql(sql_template, base)
            response, result = adapter.execute(sql, fetch=True, auto_begin=True)
            table: agate.Table = result
            df = pd.DataFrame([row.values() for row in table.rows], columns=table.column_names)
            return df

    def generate_sql(self, sql_template: str, base: bool, context: Dict = None):
        try:
            return generate_compiled_sql(self.get_manifest(base), self.adapter, sql_template, context)
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

    def get_row_count(self, model_name):
        row_count = self.row_count_cache.get(model_name)
        if row_count is not None:
            return row_count

        # Cache miss, query the row count
        base_row_count = None
        curr_row_count = None
        sql_query = 'select count(*) as ROW_COUNT from {{ ref("' + model_name + '") }}'
        try:
            base = self.execute_sql(sql_query, base=True)
        except Exception as e:
            print(e)
            base = None
        try:
            curr = self.execute_sql(sql_query, base=False)
        except Exception:
            curr = None

        if base is not None:
            base_row_count = int(base['ROW_COUNT'].iloc[0])
        if curr is not None:
            curr_row_count = int(curr['ROW_COUNT'].iloc[0])

        # Cache the row_count result
        row_count = dict(base=base_row_count, curr=curr_row_count)
        self.row_count_cache.put(model_name, row_count)
        return row_count

    def get_manifests_by_id(self, unique_id: str):
        curr_manifest = self.get_manifest(base=False)
        base_manifest = self.get_manifest(base=True)
        if unique_id in curr_manifest.nodes.keys() or unique_id in base_manifest.nodes.keys():
            return {
                'current': curr_manifest.nodes.get(unique_id),
                'base': base_manifest.nodes.get(unique_id)
            }
        return None

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
        # clear the cache
        self.row_count_cache.clear()

        # Refresh the artifacts
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

    def get_base_relation(self, model):
        relation_holder = dict()
        with self.adapter.connection_named('test'):
            def callback(x):
                relation_holder['relation'] = x

            tmp = f"""{{{{ config_base_relation(ref("{model}")) }}}}"""
            self.generate_sql(tmp, True, dict(config_base_relation=callback))
        return relation_holder.get('relation')

    def columns_value_mismatched_summary(self, primary_key: str, model: str):
        column_groups = {}
        errors = self.verify_primary_key(primary_key, model)

        if errors:
            columns = ['Column', 'Matched', 'Matched %']
            df = pd.DataFrame([], columns=columns)
            result = dict(
                summary=dict(total=0, added=0, removed=0),
                data=json.loads(df.to_json(orient='table', index=False)),
                raw=column_groups,
                errors=errors
            )
            return result

        def log_callback(data, info=False):

            if isinstance(data, tuple) and len(data) == 4:
                # data example:
                # ('COLUMN_NAME', 'MATCH_STATUS', 'COUNT_RECORDS', 'PERCENT_OF_TOTAL')
                # ('EVENT_ID', '✅: perfect match', 158601510, Decimal('100.00'))
                column_name, column_state, row_count, total_rate = data
                if 'column_name' == data[0].lower():
                    # skip column names
                    return

                # sample data like this:
                # case
                #     when a_query.{{ column_to_compare }} = b_query.{{ column_to_compare }} then '✅: perfect match' -- -> matched
                #     when a_query.{{ column_to_compare }} is null and b_query.{{ column_to_compare }} is null then '✅: both are null' -- -> matched
                #     when a_query.{{ primary_key }} is null then '🤷: ‍missing from a' -- -> row added
                #     when b_query.{{ primary_key }} is null then '🤷: missing from b'    -- -> row removed
                #     when a_query.{{ column_to_compare }} is null then '🤷: value is null in a only' -- -> mismatched
                #     when b_query.{{ column_to_compare }} is null then '🤷: value is null in b only' -- -> mismatched
                #     when a_query.{{ column_to_compare }} != b_query.{{ column_to_compare }} then '🙅: ‍values do not match' -- -> mismatched
                #     else 'unknown' -- this should never happen
                # end as match_status,

                if column_name not in column_groups:
                    column_groups[column_name] = dict(matched=0, added=0, removed=0, mismatched=0, raw=[])
                if 'perfect match' in column_state:
                    column_groups[column_name]['matched'] += row_count
                if 'both are null' in column_state:
                    column_groups[column_name]['matched'] += row_count
                if 'missing from a' in column_state:
                    column_groups[column_name]['added'] += row_count
                if 'missing from b' in column_state:
                    column_groups[column_name]['removed'] += row_count
                if 'value is null in a only' in column_state:
                    column_groups[column_name]['mismatched'] += row_count
                if 'value is null in b only' in column_state:
                    column_groups[column_name]['mismatched'] += row_count
                if 'values do not match' in column_state:
                    column_groups[column_name]['mismatched'] += row_count
                column_groups[column_name]['raw'].append((column_state, row_count))

        def pick_columns_to_compare(c1, c2):
            stat = {}
            for c in c1 + c2:
                if c.name not in stat:
                    stat[c.name] = 1
                else:
                    stat[c.name] = stat[c.name] + 1

            # only check the column both existing
            for c in c1 + c2:
                if c.name not in stat:
                    continue

                both_existing = stat[c.name] == 2
                del stat[c.name]
                if both_existing:
                    yield c
                else:
                    continue

        sql_template = r"""
        {%- set columns_to_compare=pick_columns_to_compare(
            adapter.get_columns_in_relation(ref(model)), adapter.get_columns_in_relation(base_relation))
        -%}

        {% set old_etl_relation_query %}
            select * from {{ base_relation }}
        {% endset %}

        {% set new_etl_relation_query %}
            select * from {{ ref(model) }}
        {% endset %}

        {% if execute %}
            {% for column in columns_to_compare %}
                {{ log_callback('Comparing column "' ~ column.name ~'"', info=True) }}
                {% set audit_query = audit_helper.compare_column_values(
                        a_query=old_etl_relation_query,
                        b_query=new_etl_relation_query,
                        primary_key=primary_key,
                        column_to_compare=column.name
                ) %}

                {% set audit_results = run_query(audit_query) %}

                {% do log_callback(audit_results.column_names, info=True) %}
                    {% for row in audit_results.rows %}
                          {% do log_callback(row.values(), info=True) %}
                    {% endfor %}
            {% endfor %}
        {% endif %}
        """

        with self.adapter.connection_named('test'):
            self.generate_sql(sql_template, False,
                              dict(
                                  model=model,
                                  primary_key=primary_key,
                                  log_callback=log_callback,
                                  base_relation=self.get_base_relation(model),
                                  pick_columns_to_compare=pick_columns_to_compare)
                              )

            data = []
            for k, v in column_groups.items():
                matched = v['matched']
                mismatched = v['mismatched']
                rate_base = matched + mismatched
                rate = None if rate_base == 0 else 100 * (matched / rate_base)
                record = [k, matched, rate]
                data.append(record)

            pk = [v for k, v in column_groups.items() if k.lower() == primary_key.lower()][0]
            added = pk['added']
            removed = pk['removed']
            total = pk['matched'] + added + removed

            columns = ['Column', 'Matched', 'Matched %']
            df = pd.DataFrame(data, columns=columns)

            result = dict(
                summary=dict(total=total, added=added, removed=removed),
                data=json.loads(df.to_json(orient='table', index=False)),
                raw=column_groups,
                errors=errors
            )
            return result

    def verify_primary_key(self, primary_key: str, model: str):
        errors = []

        def callback(check_name, executor, sql, is_base: bool):
            table = executor(sql)
            invalids = len(table.rows)
            if invalids == 1:
                values = [r.values() for r in table.rows][0]
                if values != (0,):
                    errors.append(dict(
                        test=check_name,
                        sql=sql,
                        model=model,
                        column_name=primary_key,
                        base=is_base))
            else:
                # it will never happen unless we use a wrong check sql
                raise BaseException('Cannot verify primary key')

        not_null_query = r"""
        {% set test_not_null_query %}
            SELECT COUNT(*) AS INVALIDS FROM ({{ adapter.dispatch('test_not_null', 'dbt')(ref(model), column_name) }})
        {% endset %}
        {{ callback(check_name, run_query, test_not_null_query, base) }}
        """

        unique_query = r"""
        {% set test_unique_query %}
            SELECT COUNT(*) AS INVALIDS FROM ({{ adapter.dispatch('test_unique', 'dbt')(ref(model), column_name) }})
        {% endset %}
        {{ callback(check_name, run_query, test_unique_query, base) }}
        """

        def validate_audit_helper():
            check_audit_helper = "{{ audit_helper.compare_column_values }}"

            with self.adapter.connection_named('test'):
                try:
                    self.generate_sql(check_audit_helper, False, {})
                except BaseException as e:
                    last_line = str(e).split("\n")[-1].strip()
                    errors.append(dict(
                        test='check_audit_helper',
                        sql=last_line,
                        model='',
                        column_name='',
                        base=False))

        validate_audit_helper()
        if errors:
            return errors

        for base in [True, False]:
            for check_name, query in [('not_null', not_null_query), ('unique', unique_query)]:
                context = dict(
                    model=model,
                    column_name=primary_key,
                    base_relation=self.get_base_relation(model),
                    callback=callback,
                    base=base,
                    check_name=check_name
                )

                with self.adapter.connection_named('test'):
                    self.generate_sql(query, base, context)

        return errors

    def model_profile(self, model: str, base: bool = False):
        sql_template = r"""
        -- depends_on: {{ ref(model) }}

        {% if execute %}
            {{ dbt_profiler.get_profile(relation=ref(model), exclude_measures=["std_dev_population", "std_dev_sample"]) }}
        {% endif %}
        """

        base_sql_template = r"""
        -- depends_on: {{ base_relation }}

        {% if execute %}
            {{ dbt_profiler.get_profile(relation=base_relation, exclude_measures=["std_dev_population", "std_dev_sample"]) }}
        {% endif %}
        """

        self.get_base_relation(model)
        adapter = self.adapter
        with self.adapter.connection_named('test'):
            if base:
                sql = self.generate_sql(base_sql_template, False,
                                        dict(model=model,
                                             base_relation=self.get_base_relation(model))
                                        )
            else:
                sql = self.generate_sql(sql_template, False,
                                        dict(model=model,
                                             base_relation=self.get_base_relation(model))
                                        )

            response, result = adapter.execute(sql, fetch=True, auto_begin=True)
            table: agate.Table = result
            column_names = [c.lower() for c in table.column_names]
            df = pd.DataFrame([row.values() for row in table.rows], columns=column_names)
            return df


dbt_context: Optional[DBTContext] = None


def load_dbt_context(**kwargs) -> DBTContext:
    global dbt_context
    if dbt_context is None:
        dbt_context = DBTContext.load(**kwargs)
    return dbt_context


def default_dbt_context() -> DBTContext:
    global dbt_context
    return dbt_context
