"""Evidence predicates for auto-approving a run result.

The classifier half of the contract lives in `recce.artifact_health`: it turns
two manifest sides into a `SchemaCoverage`. This module is the reader half — it
takes a serialised run result back off the wire and decides whether it carries
enough verified evidence to mark a check reviewed.

Kept out of `recce.run` so the CLI summary path and the MCP server share one
definition without the MCP server importing the CLI module, and kept out of
`recce.artifact_health` so the classifier stays free of any dependency on the
rest of the package.
"""

from collections.abc import Mapping
from typing import Any

from recce.models.types import SchemaCoveragePayload
from recce.tasks.dataframe import DataFrame

#: The exact frame a schema_diff produces. Both the local and cloud backends
#: emit these three text columns and nothing else, which is what makes a result
#: identifiable as a schema comparison after serialisation.
SCHEMA_DIFF_COLUMNS = {
    "node_id": "text",
    "column": "text",
    "change_status": "text",
}


def _canonical_schema_coverage(result: Mapping[str, Any] | None) -> SchemaCoveragePayload | None:
    if not isinstance(result, Mapping):
        return None
    raw_coverage = result.get("schema_coverage")
    if not isinstance(raw_coverage, Mapping):
        return None
    required_fields = {"status", "unchecked_nodes", "unchecked_node_count", "more"}
    if not required_fields.issubset(raw_coverage):
        return None
    unchecked_nodes = raw_coverage.get("unchecked_nodes")
    unchecked_node_count = raw_coverage.get("unchecked_node_count")
    more = raw_coverage.get("more")
    if (
        not isinstance(unchecked_nodes, list)
        or any(not isinstance(node_id, str) for node_id in unchecked_nodes)
        or not isinstance(unchecked_node_count, int)
        or isinstance(unchecked_node_count, bool)
        or unchecked_node_count < len(unchecked_nodes)
        or not isinstance(more, bool)
    ):
        return None
    try:
        coverage = SchemaCoveragePayload.model_validate(raw_coverage)
    except (TypeError, ValueError):
        return None

    has_unchecked_nodes = coverage.unchecked_node_count > 0
    sample_is_truncated = coverage.unchecked_node_count > len(coverage.unchecked_nodes)
    invariants_hold = (
        has_unchecked_nodes and coverage.more == sample_is_truncated
        if coverage.status == "partial"
        else not has_unchecked_nodes and not coverage.unchecked_nodes and not coverage.more
    )
    return coverage if invariants_hold else None


def result_schema_coverage_status(result: Mapping[str, Any] | None) -> str:
    coverage = _canonical_schema_coverage(result)
    return coverage.status if coverage is not None else "unknown"


def result_is_schema_comparison(result: Mapping[str, Any] | None) -> bool:
    """Whether this result is a schema comparison, and so bound by the coverage
    contract.

    Only a schema comparison can silently compare nothing and still hand back
    an empty result, so only a schema comparison has to prove coverage before
    an empty result reads as "nothing changed". Row-count, value, profile and
    lineage results carry their evidence in their own shape, so the gate has to
    tell them apart.

    Two markers, either one sufficient:

    * a `schema_coverage` block — whatever else is wrong with the payload, a
      result making a coverage claim is answerable for it; and
    * the exact three-column frame a schema_diff emits, matched on column keys,
      names and types together, so a frame that merely happens to carry three
      text columns is not mistaken for one of ours.

    The first marker is what keeps a truncated or malformed schema result
    failing closed instead of slipping out of the gate as "some other type".
    """
    if not isinstance(result, Mapping):
        return False
    if "schema_coverage" in result:
        return True
    columns = result.get("columns")
    if not isinstance(columns, list) or len(columns) != len(SCHEMA_DIFF_COLUMNS):
        return False
    actual: list[tuple[Any, Any, Any]] = []
    for column in columns:
        if not isinstance(column, Mapping):
            return False
        actual.append((column.get("key"), column.get("name"), column.get("type")))
    expected = [(name, name, type_name) for name, type_name in SCHEMA_DIFF_COLUMNS.items()]
    return actual == expected


def verified_schema_diff_is_empty(result: Mapping[str, Any] | None) -> bool:
    if not isinstance(result, Mapping):
        return False
    limit = result.get("limit")
    total_row_count = result.get("total_row_count")
    if (
        not isinstance(result.get("columns"), list)
        or not isinstance(result.get("data"), list)
        or not isinstance(limit, int)
        or isinstance(limit, bool)
        or limit <= 0
        or result.get("more") is not False
        or not isinstance(total_row_count, int)
        or isinstance(total_row_count, bool)
        or total_row_count != 0
    ):
        return False
    try:
        frame = DataFrame.model_validate(result)
    except (TypeError, ValueError):
        return False

    expected_columns = [(name, name, type_name) for name, type_name in SCHEMA_DIFF_COLUMNS.items()]
    actual_columns = [(column.key, column.name, column.type.value) for column in frame.columns]
    return actual_columns == expected_columns and not frame.data and frame.more is False and frame.total_row_count == 0


def schema_result_is_approvable(result: Mapping[str, Any] | None) -> bool:
    return result_schema_coverage_status(result) == "complete" and verified_schema_diff_is_empty(result)


def run_result_is_approvable(result: Mapping[str, Any] | None) -> bool:
    """The evidence half of the auto-approve gate, applied by result type.

    A schema comparison must carry complete coverage and an empty diff: an
    empty frame means "no column changes" only when the comparison actually
    looked at something. Every other result type keeps the pre-existing rule
    that a successful run is itself the evidence (PM decision: Passed =
    Approved), so row-count, value, profile and lineage checks are unaffected.

    Callers still apply their own gates around this — the run must have
    succeeded, and where it applies the caller must have asked to approve.
    """
    if result_is_schema_comparison(result):
        return schema_result_is_approvable(result)
    return True
