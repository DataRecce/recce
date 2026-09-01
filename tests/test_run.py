import logging
from unittest.mock import patch

from recce.models.types import Run, RunType
from recce.run import run_should_be_approved, schema_diff_should_be_approved


def _make_run(result=None, error=None, run_type=RunType.ROW_COUNT_DIFF):
    """Helper to create a Run with minimal required fields."""
    return Run(type=run_type, result=result, error=error)


class TestRunShouldBeApproved:
    """Tests for run_should_be_approved handling None values and edge cases."""

    def test_approve_matching_counts(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 100}})
        assert run_should_be_approved(run) is True

    def test_reject_mismatched_counts(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 200}})
        assert run_should_be_approved(run) is False

    def test_reject_none_base(self):
        run = _make_run(result={"customers": {"base": None, "curr": 100}})
        assert run_should_be_approved(run) is False

    def test_reject_none_curr(self):
        run = _make_run(result={"customers": {"base": 100, "curr": None}})
        assert run_should_be_approved(run) is False

    def test_reject_both_none(self):
        """Critical: both-None must NOT be auto-approved (None != None is False)."""
        run = _make_run(result={"customers": {"base": None, "curr": None}})
        assert run_should_be_approved(run) is False

    def test_reject_none_result(self):
        run = _make_run(result=None)
        assert run_should_be_approved(run) is False

    def test_reject_error(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 100}}, error="some error")
        assert run_should_be_approved(run) is False

    def test_reject_non_row_count_type(self):
        run = _make_run(result={"customers": {"base": 100, "curr": 100}}, run_type=RunType.QUERY_DIFF)
        assert run_should_be_approved(run) is False

    def test_approve_multiple_nodes_all_matching(self):
        run = _make_run(
            result={
                "customers": {"base": 100, "curr": 100},
                "orders": {"base": 200, "curr": 200},
            }
        )
        assert run_should_be_approved(run) is True

    def test_reject_multiple_nodes_one_none(self):
        run = _make_run(
            result={
                "customers": {"base": 100, "curr": 100},
                "orders": {"base": None, "curr": 200},
            }
        )
        assert run_should_be_approved(run) is False


class TestSchemaDiffShouldBeApproved:
    """Tests for schema_diff_should_be_approved error classification (DRC-2754)."""

    @patch("recce.run.default_context")
    def test_expected_table_not_found_logs_warning(self, mock_ctx, caplog):
        """TABLE_NOT_FOUND errors should be logged as warning, not error."""
        mock_ctx.return_value.adapter.select_nodes.side_effect = Exception("Object 'MY_TABLE' does not exist")
        with caplog.at_level(logging.WARNING, logger="recce.run"):
            result = schema_diff_should_be_approved({"select": "state:modified"})
        assert result is False
        assert "schema_diff approval check skipped (expected)" in caplog.text

    @patch("recce.run.default_context")
    def test_expected_permission_denied_logs_warning(self, mock_ctx, caplog):
        """PERMISSION_DENIED errors should be logged as warning, not error."""
        mock_ctx.return_value.adapter.select_nodes.side_effect = Exception(
            "Insufficient privileges to operate on table"
        )
        with caplog.at_level(logging.WARNING, logger="recce.run"):
            result = schema_diff_should_be_approved({"select": "state:modified"})
        assert result is False
        assert "schema_diff approval check skipped (expected)" in caplog.text

    @patch("recce.run.default_context")
    def test_unexpected_error_logs_error(self, mock_ctx, caplog):
        """Unexpected errors should be logged as error with exc_info."""
        mock_ctx.return_value.adapter.select_nodes.side_effect = Exception("Connection refused")
        with caplog.at_level(logging.ERROR, logger="recce.run"):
            result = schema_diff_should_be_approved({"select": "state:modified"})
        assert result is False
        assert "schema_diff approval check failed (unexpected)" in caplog.text

    @patch("recce.run.default_context")
    def test_stale_explicit_node_id_is_not_auto_approved(self, mock_ctx):
        stale_id = "model.project.misspelled_orders"
        mock_ctx.return_value.get_lineage.return_value = {"nodes": {}}

        result = schema_diff_should_be_approved({"node_id": stale_id})

        assert result is False

    @patch("recce.run.default_context")
    def test_selector_matching_zero_nodes_is_not_auto_approved(self, mock_ctx):
        """A selector that matched nothing compared nothing.

        The columns diff is trivially empty because there was nothing to
        difference, which is absence of evidence, not a verified clean result.
        """
        node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}},
        }
        mock_ctx.return_value.adapter.select_nodes.return_value = set()
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {"model.project.orders": node}},
            {"nodes": {"model.project.orders": node}},
        ]

        assert schema_diff_should_be_approved({"select": "tag:nonexistent"}) is False

    @patch("recce.run.default_context")
    def test_explicit_empty_node_id_list_is_not_auto_approved(self, mock_ctx):
        mock_ctx.return_value.get_lineage.return_value = {"nodes": {}}

        assert schema_diff_should_be_approved({"node_id": []}) is False

    @patch("recce.run.default_context")
    def test_complete_covered_explicit_node_is_auto_approved(self, mock_ctx):
        node_id = "model.project.orders"
        node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}},
        }
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {node_id: node}},
            {"nodes": {node_id: node}},
        ]

        result = schema_diff_should_be_approved({"node_id": node_id})

        assert result is True

    @patch("recce.run.default_context")
    def test_two_sided_node_missing_from_one_catalog_is_not_auto_approved(self, mock_ctx):
        """The core bug shape: a model in BOTH manifests that the current
        catalog does not describe. Its columns look dropped, but nothing
        verified them, so the check must not be approved as reviewed."""
        node_id = "model.project.orders"
        base_node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}, "gone": {"type": "TEXT"}},
        }
        # The real adapter shape for a model absent from catalog.json: no
        # "columns" key at all.
        current_node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "unchecked",
        }
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {node_id: base_node}},
            {"nodes": {node_id: current_node}},
        ]

        assert schema_diff_should_be_approved({"node_id": node_id}) is False

    @patch("recce.run.default_context")
    def test_one_uncovered_node_blocks_approval_of_a_clean_sibling(self, mock_ctx):
        """AC3 + AC8: partial coverage blocks approval even when every node the
        comparison could verify came back diff-free. A clean verified half is
        not evidence about the unverified half."""
        covered_id = "model.project.covered"
        uncovered_id = "model.project.uncovered"
        covered = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}},
        }
        mock_ctx.return_value.adapter.select_nodes.return_value = {covered_id, uncovered_id}
        mock_ctx.return_value.get_lineage.side_effect = [
            {
                "nodes": {
                    covered_id: covered,
                    uncovered_id: {**covered, "columns": {"id": {"type": "INTEGER"}}},
                }
            },
            {
                "nodes": {
                    covered_id: covered,
                    uncovered_id: {
                        "resource_type": "model",
                        "config": {"materialized": "table"},
                        "catalog_status": "unchecked",
                    },
                }
            },
        ]

        assert schema_diff_should_be_approved({"select": "state:modified"}) is False

    @patch("recce.run.default_context")
    def test_covered_column_drop_is_not_auto_approved(self, mock_ctx):
        """AC5: a removal both catalogs describe is a real difference. Complete
        coverage is necessary for approval, never sufficient."""
        node_id = "model.project.orders"
        node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
        }
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {node_id: {**node, "columns": {"id": {"type": "INTEGER"}, "gone": {"type": "TEXT"}}}}},
            {"nodes": {node_id: {**node, "columns": {"id": {"type": "INTEGER"}}}}},
        ]

        assert schema_diff_should_be_approved({"node_id": node_id}) is False

    @patch("recce.run.default_context")
    def test_dropped_model_is_not_auto_approved_as_unchanged(self, mock_ctx):
        """AC5: a model present only on the base side is a real removal.

        The node is not two-sided, so it carries no column-level comparison —
        but its absence is verified structural evidence, not an unchecked node.
        Approving it would tell the reviewer a dropped model has no schema
        differences.
        """
        node_id = "model.project.dropped"
        base_node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}, "gone": {"type": "TEXT"}},
        }
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {node_id: base_node}},
            {"nodes": {}},
        ]

        assert schema_diff_should_be_approved({"node_id": node_id}) is False

    @patch("recce.run.default_context")
    def test_added_model_is_not_auto_approved_as_unchanged(self, mock_ctx):
        """AC5: the mirror case — a model that exists only on the current side."""
        node_id = "model.project.added"
        current_node = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}},
        }
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {}},
            {"nodes": {node_id: current_node}},
        ]

        assert schema_diff_should_be_approved({"node_id": node_id}) is False

    @patch("recce.run.default_context")
    def test_ephemeral_model_stays_auto_approvable(self, mock_ctx):
        """A non-relation cannot carry catalog columns, so its exclusion is
        genuinely not-applicable and must not block approval the way a
        one-sided relation does.

        Selected alongside a real covered model, so approval rests on that
        model rather than on an empty comparison: an ephemeral model on its own
        covers nothing and is unknown, not clean.
        """
        ephemeral_id = "model.project.ephemeral"
        ephemeral = {
            "resource_type": "model",
            "config": {"materialized": "ephemeral"},
            "columns": {},
        }
        covered_id = "model.project.orders"
        covered = {
            "resource_type": "model",
            "config": {"materialized": "table"},
            "catalog_status": "covered",
            "columns": {"id": {"type": "INTEGER"}},
        }
        nodes = {ephemeral_id: ephemeral, covered_id: covered}
        mock_ctx.return_value.get_lineage.side_effect = [{"nodes": nodes}, {"nodes": nodes}]

        assert schema_diff_should_be_approved({"node_id": [ephemeral_id, covered_id]}) is True

    @patch("recce.run.default_context")
    def test_selection_of_only_non_relations_is_not_auto_approved(self, mock_ctx):
        """The other half of the rule above: with nothing comparable in the
        selection there is no evidence to approve on."""
        node_id = "model.project.ephemeral"
        node = {
            "resource_type": "model",
            "config": {"materialized": "ephemeral"},
            "columns": {},
        }
        mock_ctx.return_value.get_lineage.side_effect = [
            {"nodes": {node_id: node}},
            {"nodes": {node_id: node}},
        ]

        assert schema_diff_should_be_approved({"node_id": node_id}) is False
