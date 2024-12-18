import os
import unittest

from recce.adapter.dbt_adapter import load_manifest, DbtAdapter, DbtVersion
from recce.core import RecceContext, set_default_context
from recce.summary import generate_summary_metadata, _build_lineage_graph, generate_mermaid_lineage_graph

current_dir = os.path.dirname(os.path.abspath(__file__))
base_manifest_dir = os.path.join(current_dir, 'data', 'manifest', 'base')
pr2_manifest_dir = os.path.join(current_dir, 'data', 'manifest', 'pr2')  # Pull Request 2l

dbt_version = DbtVersion()


@unittest.skipIf(dbt_version < '1.8.1', "Dbt version is less than 1.8.1")
def test_generate_summary_metadata():
    manifest = load_manifest(path=os.path.join(current_dir, 'manifest.json'))
    assert manifest is not None
    dbt_adapter = DbtAdapter(curr_manifest=manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage()

    # Summary with no changes
    generate_summary_metadata(curr_lineage, base_lineage)

    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, 'manifest.json'))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, 'manifest.json'))
    dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage(base=True)
    generate_summary_metadata(curr_lineage, base_lineage)


@unittest.skipIf(dbt_version < 'v1.8.1', "Dbt version is less than 1.8.1")
def test_build_lineage_graph():
    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, 'manifest.json'))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, 'manifest.json'))
    dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage(base=True)

    lineage_graph = _build_lineage_graph(curr_lineage, base_lineage)
    assert len(lineage_graph.modified_set) == 1


@unittest.skipIf(dbt_version < 'v1.8.1', "Dbt version is less than 1.8.1")
def test_generate_mermaid_lineage_graph():
    set_default_context(RecceContext())
    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, 'manifest.json'))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, 'manifest.json'))
    dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage(base=True)
    graph = _build_lineage_graph(curr_lineage, base_lineage)
    mermaid_content, is_empty_graph, is_partial_graph = generate_mermaid_lineage_graph(graph)
    assert is_empty_graph is False
    assert is_partial_graph is False
