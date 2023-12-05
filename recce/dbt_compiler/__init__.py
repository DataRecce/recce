import hashlib
import time
from dataclasses import fields
from typing import Dict, List, Union

from dbt.contracts.files import FileHash
from dbt.contracts.graph.manifest import Manifest, WritableManifest
from dbt.contracts.graph.model_config import ContractConfig, NodeConfig, OnConfigurationChangeOption
from dbt.contracts.graph.nodes import Contract, DependsOn, ModelNode
from dbt.contracts.graph.unparsed import Docs
from dbt.node_types import AccessType, ModelLanguage, NodeType


def _fake_node(package_name: str, raw_code: str, depends_nodes: List):
    node_config = NodeConfig(_extra={}, enabled=True, alias=None, schema=None, database=None, tags=[], meta={},
                             group=None, materialized='view', incremental_strategy=None, persist_docs={}, post_hook=[],
                             pre_hook=[], quoting={}, column_types={}, full_refresh=None, unique_key=None,
                             on_schema_change='ignore',
                             on_configuration_change=OnConfigurationChangeOption.Apply, grants={}, packages=[],
                             docs=Docs(show=True, node_color=None), contract=ContractConfig(enforced=False))

    sha256 = hashlib.sha256(package_name.encode())
    file_hash = FileHash(name='sha256', checksum=sha256.hexdigest())
    return ModelNode(database='', schema='', name='',
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
                     deprecation_date=None, defer_relation=None)


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
