import os
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from recce.adapter.dbt_adapter import DbtAdapter, DbtVersion, load_manifest
from recce.core import RecceContext, set_default_context
from recce.models.types import Check, NodeDiff
from recce.summary import (
    MERMAID_NODE_SHAPES,
    Node,
    _build_lineage_graph,
    generate_check_content,
    generate_check_summary,
    generate_mermaid_lineage_graph,
    generate_summary_metadata,
)
from tests.dbt_flags import temporarily_set_state_modified_compare_flag

current_dir = os.path.dirname(os.path.abspath(__file__))
base_manifest_dir = os.path.join(current_dir, "data", "manifest", "base")
pr2_manifest_dir = os.path.join(current_dir, "data", "manifest", "pr2")  # Pull Request 2l


@pytest.fixture
def dbt_state_modified_flag():
    """Supply the dbt 1.12 flag absent from the repository's older fixtures."""
    restore = temporarily_set_state_modified_compare_flag()
    yield
    restore()


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


def test_generate_summary_metadata_accepts_adapter_lineage(dbt_state_modified_flag):
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


def test_build_lineage_graph(dbt_state_modified_flag):
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


def test_generate_mermaid_lineage_graph(dbt_state_modified_flag):
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

    def test_no_diff_preserves_existing_behavior(self, dbt_state_modified_flag):
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


def _catalogued_schema_node(name, columns, catalog_status="covered"):
    return {
        "name": name,
        "resource_type": "model",
        "config": {"materialized": "table"},
        "catalog_status": catalog_status,
        "columns": columns,
    }


def _generate_schema_check_summary(base_lineage, current_lineage, node_ids):
    check = Check(
        name="schema coverage",
        description="schema evidence",
        type="schema_diff",
        params={"node_id": node_ids},
    )
    with (
        patch("recce.summary.CheckDAO.list", return_value=[check]),
        patch("recce.summary.RunDAO.list", return_value=[]),
    ):
        return generate_check_summary(base_lineage, current_lineage)


def _render_check_summary(checks, statistics):
    graph = SimpleNamespace(checks=checks)
    with patch("recce.summary.get_node_name_by_id", side_effect=lambda node_id: node_id.rsplit(".", 1)[-1]):
        return generate_check_content(graph, statistics)


def test_partial_schema_coverage_preserves_verified_removal_before_incomplete_scope():
    verified_id = "model.project.verified"
    unchecked_id = "model.project.not_rebuilt"
    base_lineage = {
        "nodes": {
            verified_id: _catalogued_schema_node(
                "verified",
                {"id": {"type": "integer"}, "removed": {"type": "text"}},
            ),
            unchecked_id: _catalogued_schema_node(
                "not_rebuilt",
                {"id": {"type": "integer"}, "not_removed": {"type": "text"}},
            ),
        }
    }
    current_lineage = {
        "nodes": {
            verified_id: _catalogued_schema_node("verified", {"id": {"type": "integer"}}),
            unchecked_id: _catalogued_schema_node(
                "not_rebuilt",
                {"id": {"type": "integer"}},
                catalog_status="unchecked",
            ),
        }
    }

    checks, statistics = _generate_schema_check_summary(
        base_lineage,
        current_lineage,
        [verified_id, unchecked_id],
    )

    assert statistics == {"total": 1, "mismatch": 1, "failed": 0, "incomplete": 1}
    assert len(checks) == 1
    assert checks[0].changed_nodes == ["verified"]
    assert checks[0].schema_coverage.model_dump() == {
        "status": "partial",
        "unchecked_nodes": [unchecked_id],
        "unchecked_node_count": 1,
        "more": False,
    }

    markdown = _render_check_summary(checks, statistics)
    mismatch_section, incomplete_section = markdown.split(":warning: **Schema comparison incomplete", 1)
    assert "verified" in mismatch_section
    assert "not_rebuilt" not in mismatch_section
    assert unchecked_id in incomplete_section
    assert markdown.index("verified") < markdown.index(unchecked_id)
    assert "1 unchecked node" in incomplete_section
    assert "dbt docs generate" in incomplete_section


@pytest.mark.parametrize("dropped", [True, False], ids=["removed-model", "added-model"])
def test_one_sided_model_is_a_mismatch_not_a_coverage_gap(dropped: bool):
    """AC5 at the surface that renders the PR summary.

    A model on only one manifest side is a verified structural change. The
    summary must report it as a mismatch and must NOT report a coverage gap —
    nothing here needs a regenerated catalog. Only two-sided nodes are tested
    elsewhere, so a refactor that treats one-sided nodes as out of scope would
    delete the removal from the summary entirely.
    """
    one_sided_id = "model.project.dropped_orders"
    healthy_id = "model.project.healthy"
    columns = {"id": {"type": "integer"}, "amount": {"type": "numeric"}}
    one_sided = {one_sided_id: _catalogued_schema_node("dropped_orders", columns)}
    healthy = {healthy_id: _catalogued_schema_node("healthy", {"id": {"type": "integer"}})}

    base_lineage = {"nodes": {**healthy, **(one_sided if dropped else {})}}
    current_lineage = {"nodes": {**healthy, **({} if dropped else one_sided)}}

    checks, statistics = _generate_schema_check_summary(
        base_lineage,
        current_lineage,
        [one_sided_id, healthy_id],
    )

    assert statistics == {"total": 1, "mismatch": 1, "failed": 0, "incomplete": 0}
    assert len(checks) == 1
    assert checks[0].changed_nodes == ["dropped_orders"]
    assert checks[0].schema_coverage.model_dump() == {
        "status": "complete",
        "unchecked_nodes": [],
        "unchecked_node_count": 0,
        "more": False,
    }

    markdown = _render_check_summary(checks, statistics)
    assert "Checks of Data Mismatch Detected" in markdown
    assert "dropped_orders" in markdown
    assert ":warning: **Schema comparison incomplete" not in markdown


def test_incomplete_schema_coverage_without_verified_change_is_not_a_clean_pass():
    checked_id = "model.project.checked"
    unchecked_id = "model.project.not_rebuilt"
    columns = {"id": {"type": "integer"}}
    base_lineage = {
        "nodes": {
            checked_id: _catalogued_schema_node("checked", columns),
            unchecked_id: _catalogued_schema_node("not_rebuilt", columns),
        }
    }
    current_lineage = {
        "nodes": {
            checked_id: _catalogued_schema_node("checked", columns),
            unchecked_id: _catalogued_schema_node("not_rebuilt", columns, catalog_status="unchecked"),
        }
    }

    checks, statistics = _generate_schema_check_summary(
        base_lineage,
        current_lineage,
        [checked_id, unchecked_id],
    )

    assert statistics == {"total": 1, "mismatch": 0, "failed": 0, "incomplete": 1}
    assert len(checks) == 1
    markdown = _render_check_summary(checks, statistics)
    assert "Checks of Data Mismatch Detected" not in markdown
    assert "Incomplete Schema Comparisons" in markdown
    assert ":warning: **Schema comparison incomplete" in markdown
    assert unchecked_id in markdown


def test_missing_catalog_legacy_input_reports_unknown_schema_coverage():
    checks, statistics = _generate_schema_check_summary(
        {},
        {"nodes": {}},
        ["model.project.legacy"],
    )

    assert statistics == {"total": 1, "mismatch": 0, "failed": 0, "incomplete": 1}
    assert len(checks) == 1
    assert checks[0].schema_coverage.model_dump() == {
        "status": "unknown",
        "unchecked_nodes": [],
        "unchecked_node_count": 0,
        "more": False,
    }
    markdown = _render_check_summary(checks, statistics)
    assert "unchecked scope could not be determined" in markdown
    assert "dbt docs generate" in markdown


def test_stale_selected_node_id_reports_incomplete_schema_coverage():
    stale_id = "model.project.misspelled_orders"

    checks, statistics = _generate_schema_check_summary(
        {"nodes": {}},
        {"nodes": {}},
        [stale_id],
    )

    assert statistics == {"total": 1, "mismatch": 0, "failed": 0, "incomplete": 1}
    assert len(checks) == 1
    assert checks[0].schema_coverage.model_dump() == {
        "status": "partial",
        "unchecked_nodes": [stale_id],
        "unchecked_node_count": 1,
        "more": False,
    }
    markdown = _render_check_summary(checks, statistics)
    assert stale_id in markdown
    assert "Schema comparison incomplete" in markdown


def test_complete_schema_coverage_without_changes_remains_silent():
    node_id = "model.project.healthy"
    columns = {"id": {"type": "integer"}}
    lineage = {"nodes": {node_id: _catalogued_schema_node("healthy", columns)}}

    checks, statistics = _generate_schema_check_summary(lineage, lineage, [node_id])

    assert checks == []
    assert statistics == {"total": 1, "mismatch": 0, "failed": 0, "incomplete": 0}
    markdown = _render_check_summary(checks, statistics)
    assert "Schema comparison incomplete" not in markdown
    assert "Checks of Data Mismatch Detected" not in markdown
