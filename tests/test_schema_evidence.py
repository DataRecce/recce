"""Tests for the run-result evidence predicates in `recce.schema_evidence`."""

import pytest

from recce.schema_evidence import (
    result_is_schema_comparison,
    run_result_is_approvable,
    schema_result_is_approvable,
)


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


def _uncovered(result):
    """A schema-diff frame stripped of its coverage block, so only the column
    shape is left to identify it."""
    return {key: value for key, value in result.items() if key != "schema_coverage"}


@pytest.mark.parametrize(
    "result",
    [
        None,
        {"customers": {"base": 100, "curr": 100}},
        {"nodes": [], "edges": []},
        {**_uncovered(_schema_result()), "columns": _schema_result()["columns"][:2]},
        {
            **_uncovered(_schema_result()),
            "columns": [
                {"key": "node_id", "name": "node_id", "type": "text"},
                {"key": "column", "name": "column", "type": "text"},
                {"key": "change_status", "name": "change_status", "type": "number"},
            ],
        },
    ],
    ids=["none", "row-count", "lineage", "too-few-columns", "wrong-column-type"],
)
def test_results_that_are_neither_shaped_nor_coverage_bearing_are_not_schema_comparisons(result):
    assert result_is_schema_comparison(result) is False


@pytest.mark.parametrize(
    "result",
    [
        _uncovered(_schema_result()),
        _uncovered(_schema_result(data=[["model.project.orders", "customer_id", "added"]])),
    ],
    ids=["empty", "with-changes"],
)
def test_schema_diff_frames_are_recognised_by_their_column_shape(result):
    assert result_is_schema_comparison(result) is True


@pytest.mark.parametrize(
    "result",
    [
        {"data": [], "schema_coverage": _schema_coverage()},
        {"schema_coverage": {"status": "garbage"}},
        {**_schema_result(), "columns": []},
    ],
    ids=["no-columns", "malformed-coverage", "columns-stripped"],
)
def test_a_coverage_claim_alone_makes_a_result_a_schema_comparison(result):
    """A schema result that lost its frame must fail closed, not fall out of
    the gate as "some other check type"."""
    assert result_is_schema_comparison(result) is True
    assert run_result_is_approvable(result) is False


@pytest.mark.parametrize(
    "result",
    [
        {"customers": {"base": 100, "curr": 100}},
        {"customers": {"base": 100, "curr": 200}},
        {"nodes": [], "edges": []},
        {"summary": {}},
        None,
    ],
    ids=["row-count-match", "row-count-mismatch", "lineage", "profile-ish", "none"],
)
def test_non_schema_results_keep_the_passed_equals_approved_gate(result):
    """The schema-coverage contract must not repeal the standing PM decision.

    Only a schema comparison can silently compare nothing and still hand back
    an empty frame, so only a schema comparison has to prove coverage. Every
    other type is gated by its caller on a successful run, exactly as before.
    """
    assert run_result_is_approvable(result) is True


@pytest.mark.parametrize(
    ("result", "approvable"),
    [
        (_schema_result(), True),
        (_schema_result(coverage=_schema_coverage("partial", unchecked_nodes=["a"], unchecked_node_count=1)), False),
        (_schema_result(coverage=_schema_coverage("unknown")), False),
        (_schema_result(data=[["model.project.orders", "customer_id", "added"]], total_row_count=1), False),
    ],
    ids=["complete-empty", "partial", "unknown", "with-changes"],
)
def test_schema_shaped_results_still_face_the_strict_coverage_gate(result, approvable):
    assert run_result_is_approvable(result) is approvable
