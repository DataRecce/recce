import os
from unittest.mock import patch

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, DbtVersion, load_manifest
from recce.core import RecceContext, set_default_context
from recce.models.types import NodeDiff
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


def _make_node_with_checksum(node_id, name, checksum="abc123"):
    """Helper to create a Node with checksum data (both base and current)."""
    node_data = {
        "name": name,
        "resource_type": "model",
        "package_name": "test",
        "checksum": {"checksum": checksum},
    }
    node = Node(node_id, node_data, "both")
    node.base_data = node_data
    node.current_data = node_data
    return node


def _make_both_node(node_id="model.test.my_model", name="my_model"):
    """Helper to create a Node present in both base and current (data_from='both')."""
    node = _make_node_with_checksum(node_id, name, checksum="same")
    return node


class TestNodeApplyDiff:
    def test_apply_diff_sets_forced_change_status(self):
        node = _make_both_node()
        assert node.change_status is None  # same checksum → no change
        node.apply_diff(NodeDiff(change_status="modified"))
        assert node.change_status == "modified"

    def test_apply_diff_overrides_checksum_based_none(self):
        node = _make_node_with_checksum("model.test.m", "m", checksum="same")
        assert node.change_status is None  # same checksum → no change
        node.apply_diff(NodeDiff(change_status="modified"))
        assert node.change_status == "modified"


class TestWhatChanged:
    @patch("recce.summary._get_node_row_count_diff", return_value=(None, None))
    def test_modified_shows_code(self, _mock):
        node = _make_both_node()
        node.apply_diff(NodeDiff(change_status="modified"))
        changes = node._what_changed()
        assert "Code" in changes


class TestBuildLineageGraphWithDiff:
    def _make_lineage(self, node_ids):
        nodes = {}
        for nid in node_ids:
            name = nid.split(".")[-1]
            nodes[nid] = {
                "id": nid,
                "name": name,
                "resource_type": "model",
                "package_name": "test",
                "checksum": {"checksum": "same_checksum"},
                "raw_code": "SELECT 1",
            }
        return {"nodes": nodes, "parent_map": {}}

    def test_diff_marks_state_modified_nodes(self):
        base = self._make_lineage(["model.test.a", "model.test.b"])
        current = self._make_lineage(["model.test.a", "model.test.b"])

        # Without diff: node a and b have same checksum → no change
        graph = _build_lineage_graph(base, current)
        assert graph.nodes["model.test.a"].change_status is None
        assert graph.nodes["model.test.b"].change_status is None

        # With diff from state:modified: node b surfaces as modified
        diff = {"model.test.b": NodeDiff(change_status="modified")}
        graph = _build_lineage_graph(base, current, diff)
        assert "model.test.b" in graph.modified_set
        assert graph.nodes["model.test.a"].change_status is None

    @patch("recce.summary._get_node_row_count_diff", return_value=(None, None))
    def test_diff_node_shows_code_label(self, _mock):
        base = self._make_lineage(["model.test.a"])
        current = self._make_lineage(["model.test.a"])
        diff = {"model.test.a": NodeDiff(change_status="modified")}
        graph = _build_lineage_graph(base, current, diff)
        changes = graph.nodes["model.test.a"]._what_changed()
        assert "Code" in changes

    def test_no_diff_preserves_existing_behavior(self):
        """Passing diff=None should behave identically to the original implementation."""
        dbt_version = DbtVersion()
        if dbt_version < "1.8.1":
            pytest.skip("Dbt version is less than 1.8.1")

        base_manifest_path = os.path.join(current_dir, "data", "manifest", "base", "manifest.json")
        pr2_manifest_path = os.path.join(current_dir, "data", "manifest", "pr2", "manifest.json")
        base_manifest = load_manifest(path=base_manifest_path)
        curr_manifest = load_manifest(path=pr2_manifest_path)
        dbt_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)
        curr_lineage = dbt_adapter.get_lineage()
        base_lineage = dbt_adapter.get_lineage(base=True)

        graph_no_diff = _build_lineage_graph(curr_lineage, base_lineage)
        graph_with_none = _build_lineage_graph(curr_lineage, base_lineage, None)
        assert graph_no_diff.modified_set == graph_with_none.modified_set
