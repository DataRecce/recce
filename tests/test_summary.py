import os
from unittest.mock import patch

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, DbtVersion, load_manifest
from recce.core import RecceContext, set_default_context
from recce.summary import (
    MERMAID_NODE_SHAPES,
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


def _make_node(node_id="model.test.my_model", name="my_model", resource_type="model"):
    """Helper to create a Node with minimal data."""
    return Node(node_id, {"name": name, "resource_type": resource_type, "package_name": "test"})


class TestGetShapeBrackets:
    def test_default_returns_rectangle(self):
        node = _make_node()
        assert node._get_shape_brackets({}) == MERMAID_NODE_SHAPES["rectangle"]

    def test_known_shape_name(self):
        node = _make_node(resource_type="source")
        assert node._get_shape_brackets({"source": "cylinder"}) == MERMAID_NODE_SHAPES["cylinder"]

    def test_unknown_shape_falls_back_to_rectangle(self):
        node = _make_node()
        assert node._get_shape_brackets({"model": "nonexistent_shape"}) == MERMAID_NODE_SHAPES["rectangle"]

    def test_unmatched_resource_type_uses_rectangle(self):
        node = _make_node(resource_type="model")
        assert node._get_shape_brackets({"source": "cylinder"}) == MERMAID_NODE_SHAPES["rectangle"]


class TestGetNodeStr:
    def test_default_shape_is_rectangle(self):
        node = _make_node()
        result = node.get_node_str()
        open_b, _ = MERMAID_NODE_SHAPES["rectangle"]
        assert result.startswith(f"{node.id}{open_b}{node.name}")

    def test_cylinder_shape_for_source(self):
        node = _make_node(node_id="source.test.my_source", name="my_source", resource_type="source")
        result = node.get_node_str(node_shapes={"source": "cylinder"})
        open_b, _ = MERMAID_NODE_SHAPES["cylinder"]
        assert result.startswith(f"{node.id}{open_b}{node.name}")

    def test_model_unaffected_by_source_shape(self):
        node = _make_node()
        result = node.get_node_str(node_shapes={"source": "cylinder"})
        open_b, _ = MERMAID_NODE_SHAPES["rectangle"]
        assert result.startswith(f"{node.id}{open_b}{node.name}")

    def test_none_node_shapes_uses_rectangle(self):
        node = _make_node()
        result = node.get_node_str(node_shapes=None)
        open_b, _ = MERMAID_NODE_SHAPES["rectangle"]
        assert result.startswith(f"{node.id}{open_b}{node.name}")

    def test_all_supported_shapes(self):
        for shape_name, (open_b, _) in MERMAID_NODE_SHAPES.items():
            node = _make_node()
            result = node.get_node_str(node_shapes={"model": shape_name})
            assert result.startswith(f"{node.id}{open_b}{node.name}")


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

    @patch("recce.summary._get_node_row_count_diff")
    def test_returns_na_when_base_table_not_found(self, mock_get_diff):
        """When base is None due to table_not_found, return 'N/A (table_not_found)'."""
        mock_get_diff.return_value = (
            {"some": "diff"},
            {"base": None, "curr": 100, "base_meta": {"status": "table_not_found"}, "curr_meta": {"status": "ok"}},
        )
        node = _make_node()
        result = node._cal_row_count_delta_percentage()
        assert result == "N/A (table_not_found)"

    @patch("recce.summary._get_node_row_count_diff")
    def test_returns_na_when_curr_permission_denied(self, mock_get_diff):
        """When curr is None due to permission_denied, return 'N/A (permission_denied)'."""
        mock_get_diff.return_value = (
            {"some": "diff"},
            {"base": 100, "curr": None, "base_meta": {"status": "ok"}, "curr_meta": {"status": "permission_denied"}},
        )
        node = _make_node()
        result = node._cal_row_count_delta_percentage()
        assert result == "N/A (permission_denied)"

    @patch("recce.summary._get_node_row_count_diff")
    def test_none_without_meta_still_returns_none(self, mock_get_diff):
        """When base/curr is None but no meta status, return None (backward compat)."""
        mock_get_diff.return_value = ({"some": "diff"}, {"base": None, "curr": 100})
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None

    @patch("recce.summary._get_node_row_count_diff")
    def test_non_dict_meta_returns_none_gracefully(self, mock_get_diff):
        """When meta is not a dict (e.g., a string), function should return None, not crash."""
        mock_get_diff.return_value = (
            {"some": "diff"},
            {"base": None, "curr": 100, "base_meta": "unexpected_string", "curr_meta": {"status": "ok"}},
        )
        node = _make_node()
        assert node._cal_row_count_delta_percentage() is None
