import os
from unittest.mock import patch

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, DbtVersion, load_manifest
from recce.core import RecceContext, set_default_context
from recce.summary import (
    Node,
    _build_lineage_graph,
    generate_mermaid_lineage_graph,
    generate_summary_metadata,
)

current_dir = os.path.dirname(os.path.abspath(__file__))
base_manifest_dir = os.path.join(current_dir, "data", "manifest", "base")
pr2_manifest_dir = os.path.join(current_dir, "data", "manifest", "pr2")  # Pull Request 2l


def test_generate_summary_metadata():
    dbt_version = DbtVersion()
    if dbt_version < "1.8.1":
        pytest.skip("Dbt version is less than 1.8.1")

    manifest = load_manifest(path=os.path.join(current_dir, "manifest.json"))
    assert manifest is not None
    dbt_adapter = DbtAdapter(curr_manifest=manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage()

    # Summary with no changes
    generate_summary_metadata(curr_lineage, base_lineage)

    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, "manifest.json"))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, "manifest.json"))
    dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage(base=True)
    generate_summary_metadata(curr_lineage, base_lineage)


def test_build_lineage_graph():
    dbt_version = DbtVersion()
    if dbt_version < "1.8.1":
        pytest.skip("Dbt version is less than 1.8.1")

    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, "manifest.json"))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, "manifest.json"))
    dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage(base=True)

    lineage_graph = _build_lineage_graph(curr_lineage, base_lineage)
    # Modified nodes: 3
    # - int_customer_orders: added
    # - int_customer_payments: added
    # - customers: modified
    assert len(lineage_graph.modified_set) == 3


def test_generate_mermaid_lineage_graph():
    dbt_version = DbtVersion()
    if dbt_version < "1.8.1":
        pytest.skip("Dbt version is less than 1.8.1")

    set_default_context(RecceContext())
    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, "manifest.json"))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, "manifest.json"))
    dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
    curr_lineage = dbt_adapter.get_lineage()
    base_lineage = dbt_adapter.get_lineage(base=True)
    graph = _build_lineage_graph(curr_lineage, base_lineage)
    mermaid_content, is_empty_graph, is_partial_graph = generate_mermaid_lineage_graph(graph)
    assert is_empty_graph is False
    assert is_partial_graph is False


def _make_node(node_id="model.test.my_model", name="my_model"):
    """Helper to create a Node with minimal data."""
    return Node(node_id, {"name": name, "resource_type": "model", "package_name": "test"})


class TestCalRowCountDeltaPercentage:
    """Tests for Node._cal_row_count_delta_percentage handling None and edge cases."""

    @patch("recce.summary._get_node_row_count_diff")
    def test_none_base_returns_none(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": None, "curr": 100})
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None

    @patch("recce.summary._get_node_row_count_diff")
    def test_none_curr_returns_none(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": 100, "curr": None})
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None

    @patch("recce.summary._get_node_row_count_diff")
    def test_both_none_returns_none(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": None, "curr": None})
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None

    @patch("recce.summary._get_node_row_count_diff")
    def test_zero_current_returns_none(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": 100, "curr": 0})
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None

    @patch("recce.summary._get_node_row_count_diff")
    def test_growth(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": 100, "curr": 200})
        node = _make_node()
        result = node._cal_row_count_delta_percentage()
        assert "🔼" in result
        assert "50.0%" in result

    @patch("recce.summary._get_node_row_count_diff")
    def test_shrinkage(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": 200, "curr": 100})
        node = _make_node()
        result = node._cal_row_count_delta_percentage()
        assert "🔽" in result
        assert "100.0%" in result

    @patch("recce.summary._get_node_row_count_diff")
    def test_equal_counts_returns_none(self, mock_get_diff):
        mock_get_diff.return_value = ({"some": "diff"}, {"base": 100, "curr": 100})
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None

    @patch("recce.summary._get_node_row_count_diff")
    def test_no_diff_returns_none(self, mock_get_diff):
        mock_get_diff.return_value = (None, None)
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None
