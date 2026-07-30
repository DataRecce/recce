import os
from datetime import datetime
from types import SimpleNamespace
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
    base_lineage = {
        "manifest_metadata": SimpleNamespace(generated_at=datetime(2024, 1, 2, 3, 4, 5)),
        "catalog_metadata": SimpleNamespace(generated_at=datetime(2024, 1, 2, 4, 5, 6)),
    }
    current_lineage = {
        "manifest_metadata": SimpleNamespace(generated_at=datetime(2025, 6, 7, 8, 9, 10)),
        "catalog_metadata": None,
    }

    summary = generate_summary_metadata(base_lineage, current_lineage)

    assert summary == (
        "|        |Manifest            |Catalog             |\n"
        "|--------|--------------------|--------------------|\n"
        "|Base    |2024-01-02 03:04:05 |2024-01-02 04:05:06 |\n"
        "|Current |2025-06-07 08:09:10 |N/A                 |"
    )


@pytest.mark.parametrize(
    "missing_metadata",
    [
        pytest.param(None, id="none-metadata"),
        pytest.param({}, id="sqlmesh-empty-metadata"),
    ],
)
def test_generate_summary_metadata_without_artifact_timestamps(missing_metadata):
    """
    Metadata with no generated_at renders N/A instead of raising.

    Both shapes are real: the dbt adapter returns None for an artifact it does
    not have (a project with no catalog), and the SQLMesh adapter returns {} for
    manifest_metadata and catalog_metadata alike (sqlmesh_adapter.get_lineage).
    Since get_lineage_diff feeds get_lineage output straight into this function,
    dereferencing generated_at unguarded made `recce summary` raise
    AttributeError on every SQLMesh project.
    """
    lineage = {"manifest_metadata": missing_metadata, "catalog_metadata": missing_metadata}

    summary = generate_summary_metadata(lineage, lineage)

    assert summary == (
        "|        |Manifest|Catalog|\n"
        "|--------|--------|-------|\n"
        "|Base    |N/A     |N/A    |\n"
        "|Current |N/A     |N/A    |"
    )


def test_generate_summary_metadata_accepts_adapter_lineage():
    """
    The literal shapes above are only worth anything if they are the shapes an
    adapter really hands over, so run the dbt adapter's own get_lineage output
    through it — the coupling that catches a metadata shape change at its source.
    """
    dbt_version = DbtVersion()
    if dbt_version < "1.8.1":
        pytest.skip("Dbt version is less than 1.8.1")

    manifest = load_manifest(path=os.path.join(current_dir, "manifest.json"))
    assert manifest is not None
    single_env_adapter = DbtAdapter(curr_manifest=manifest)
    single_env_lineage = single_env_adapter.get_lineage()

    single_env_summary = generate_summary_metadata(single_env_lineage, single_env_lineage)
    # A real manifest timestamp on both rows; no catalog on either.
    assert single_env_summary.count("N/A") == 2
    assert single_env_lineage["catalog_metadata"] is None

    base_manifest = load_manifest(path=os.path.join(base_manifest_dir, "manifest.json"))
    curr_manifest = load_manifest(path=os.path.join(pr2_manifest_dir, "manifest.json"))
    diff_adapter = DbtAdapter(curr_manifest=curr_manifest, base_manifest=base_manifest)

    diff_summary = generate_summary_metadata(diff_adapter.get_lineage(base=True), diff_adapter.get_lineage())
    # Two distinct manifests, so the two Manifest cells must differ.
    base_row, current_row = diff_summary.splitlines()[2:4]
    assert base_row != current_row
    assert diff_summary.count("N/A") == 2


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

        graph_no_diff = _build_lineage_graph(base_lineage, curr_lineage)
        graph_with_none = _build_lineage_graph(base_lineage, curr_lineage, None)
        assert graph_no_diff.modified_set == graph_with_none.modified_set
