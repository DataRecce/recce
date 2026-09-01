import logging
from unittest.mock import patch

import pytest

from recce.models.types import Run, RunType
from recce.run import (
    run_should_be_approved,
    schema_diff_should_be_approved,
    schema_result_is_approvable,
)


def _make_run(result=None, error=None, run_type=RunType.ROW_COUNT_DIFF):
    """Helper to create a Run with minimal required fields."""
    return Run(type=run_type, result=result, error=error)


def _schema_coverage(
    status="complete",
    *,
    unchecked_nodes=None,
    unchecked_node_count=0,
    more=False,
):
    return {
        "status": status,
        "unchecked_nodes": [] if unchecked_nodes is None else unchecked_nodes,
        "unchecked_node_count": unchecked_node_count,
        "more": more,
    }


def _schema_result(*, data=None, coverage=None, frame_more=False, total_row_count=0):
    return {
        "columns": [
            {"key": "node_id", "name": "node_id", "type": "text"},
            {"key": "column", "name": "column", "type": "text"},
            {"key": "change_status", "name": "change_status", "type": "text"},
        ],
        "data": [] if data is None else data,
        "limit": 100,
        "more": frame_more,
        "total_row_count": total_row_count,
        "schema_coverage": _schema_coverage() if coverage is None else coverage,
    }


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
        one-sided relation does."""
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

        assert schema_diff_should_be_approved({"node_id": node_id}) is True


@pytest.mark.parametrize("coverage", ["partial", "unknown", None])
def test_schema_result_is_not_approvable_without_complete_coverage(coverage):
    result = {"data": []}
    if coverage is not None:
        result["schema_coverage"] = {"status": coverage}

    assert schema_result_is_approvable(result) is False


def test_schema_result_is_not_approvable_when_verified_diff_has_a_mismatch():
    result = _schema_result(data=[["model.project.orders", "customer_id", "added"]])

    assert schema_result_is_approvable(result) is False


def test_complete_empty_schema_result_is_approvable():
    result = _schema_result()

    assert schema_result_is_approvable(result) is True


def test_complete_schema_result_allows_additive_coverage_fields():
    coverage = {**_schema_coverage(), "computed_at": "2026-08-28T00:00:00Z"}

    assert schema_result_is_approvable(_schema_result(coverage=coverage)) is True


@pytest.mark.parametrize(
    "coverage",
    [
        {"status": "complete"},
        _schema_coverage(
            unchecked_nodes=["model.project.orders"],
            unchecked_node_count=1,
        ),
        _schema_coverage(more=True),
    ],
    ids=["missing-fields", "unchecked-node", "more-marker"],
)
def test_complete_contradictory_schema_coverage_is_not_approvable(coverage):
    assert schema_result_is_approvable(_schema_result(coverage=coverage)) is False


@pytest.mark.parametrize(
    "result",
    [
        {"data": [], "schema_coverage": _schema_coverage()},
        {**_schema_result(), "columns": []},
        _schema_result(frame_more=True),
    ],
    ids=["missing-columns", "wrong-schema", "more-rows"],
)
def test_malformed_or_incomplete_empty_dataframe_is_not_approvable(result):
    assert schema_result_is_approvable(result) is False


@pytest.mark.parametrize(
    "total_row_count",
    [1, True, "0", None],
    ids=["nonzero", "boolean", "string", "missing"],
)
def test_empty_schema_result_requires_exact_zero_total_row_count(total_row_count):
    result = _schema_result(total_row_count=total_row_count)

    assert schema_result_is_approvable(result) is False
