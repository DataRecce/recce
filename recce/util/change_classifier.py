import time
from dataclasses import dataclass
from typing import Optional

import sqlglot.expressions as exp
from sqlglot import Dialect, parse_one
from sqlglot.errors import SqlglotError
from sqlglot.optimizer import Scope, traverse_scope
from sqlglot.optimizer.qualify import qualify

from recce.models.types import (  # noqa: F401  (re-exported for callers importing from this module)
    CHANGE_CATEGORY_ALIASES,
    CHANGE_CATEGORY_ALIASES_INVERSE,
    ChangeStatus,
    NodeChange,
    normalize_change_category,
    to_v2_change_category,
)

CHANGE_CATEGORY_UNKNOWN = NodeChange(category="unknown")
CHANGE_CATEGORY_BREAKING = NodeChange(category="breaking")

# DRC-3553: dual-vocabulary aliasing window.
#
# The wire/enum values stay LEGACY (breaking / non_breaking / partial_breaking /
# unknown) during this deprecation window. The v2 vocabulary
# (model_wide / column / additive / unknown) is accepted on input and can be
# emitted on output opt-in via the `Accept-Vocabulary: v2` HTTP header. Legacy
# values are removed in the next Recce release; until then both vocabularies
# parse so Cloud and OSS can roll over independently.
#
# The alias maps + normalizer are defined in recce.models.types (the low-level
# models module) and re-exported here so callers can keep importing them from
# the classifier without a circular import.


# HTTP header that opts a response into the v2 change-category vocabulary.
ACCEPT_VOCABULARY_HEADER = "accept-vocabulary"
ACCEPT_VOCABULARY_V2 = "v2"


def wants_v2_vocabulary(headers) -> bool:
    """Return True if the request opts into the v2 vocabulary.

    ``headers`` is anything dict-like with case-insensitive lookup (e.g.
    Starlette/FastAPI ``request.headers``). Absent header -> legacy (False).
    """
    if headers is None:
        return False
    value = headers.get(ACCEPT_VOCABULARY_HEADER)
    return bool(value) and value.strip().lower() == ACCEPT_VOCABULARY_V2


def translate_merged_lineage_to_v2(lineage: dict) -> dict:
    """In-place translate a serialized merged-lineage dict's change categories to v2.

    Touches ``nodes[*].change.category`` (the only place a category label is
    emitted in the merged-lineage wire format). Node ``change_status`` values
    (added/removed/modified) are a separate vocabulary and are left untouched.
    Returns the same dict for convenience.
    """
    if not isinstance(lineage, dict):
        return lineage
    nodes = lineage.get("nodes")
    if isinstance(nodes, dict):
        for node in nodes.values():
            if not isinstance(node, dict):
                continue
            change = node.get("change")
            if isinstance(change, dict) and "category" in change:
                change["category"] = to_v2_change_category(change["category"])
    return lineage


@dataclass
class BreakingPerformanceTracking:
    lineage_diff_start = None
    lineage_diff_elapsed = None
    modified_nodes = 0
    sqlglot_error_nodes = 0
    other_error_nodes = 0
    checkpoints = {}

    def start_lineage_diff(self):
        self.lineage_diff_start = time.perf_counter_ns()

    def record_checkpoint(self, label: str):
        if self.lineage_diff_start is None:
            return

        self.checkpoints[label] = (time.perf_counter_ns() - self.lineage_diff_start) / 1000000

    def end_lineage_diff(self):
        if self.lineage_diff_start is None:
            return
        self.lineage_diff_elapsed = (time.perf_counter_ns() - self.lineage_diff_start) / 1000000

    def increment_modified_nodes(self):
        self.modified_nodes += 1

    def increment_sqlglot_error_nodes(self):
        self.sqlglot_error_nodes += 1

    def increment_other_error_nodes(self):
        self.other_error_nodes += 1

    def to_dict(self):
        return {
            "lineage_diff_elapsed_ms": self.lineage_diff_elapsed,
            "modified_nodes": self.modified_nodes,
            "sqlglot_error_nodes": self.sqlglot_error_nodes,
            "other_error_nodes": self.other_error_nodes,
            "checkpoints": self.checkpoints,
        }

    def reset(self):
        self.lineage_diff_start = None
        self.lineage_diff_elapsed = None
        self.modified_nodes = 0
        self.sqlglot_error_nodes = 0
        self.other_error_nodes = 0
        self.checkpoints = {}


def _diff_select_scope(old_scope: Scope, new_scope: Scope, scope_changes_map: dict[Scope, NodeChange]) -> NodeChange:
    assert old_scope.expression.key == "select"
    assert new_scope.expression.key == "select"

    change_category = "non_breaking"
    changed_columns = {}

    # check if the upstream scopes is not breaking
    for source_name, source in new_scope.sources.items():
        if scope_changes_map.get(source) is not None:
            change = scope_changes_map[source]
            if change.category == "breaking":
                change_category = "breaking"

    # check if the upstream scopes sources table are the same
    if len(old_scope.sources) != len(new_scope.sources):
        change_category = "breaking"
    else:
        old_source_tables = [s.name for s in old_scope.sources.values() if isinstance(s, exp.Table)]
        new_source_tables = [s.name for s in new_scope.sources.values() if isinstance(s, exp.Table)]
        if sorted(old_source_tables) != sorted(new_source_tables):
            change_category = "breaking"

    # check if non-select expressions are the same
    old_select = old_scope.expression  # type: exp.Select
    new_select = new_scope.expression  # type: exp.Select
    for arg_key in old_select.args.keys() | new_select.args.keys():
        if arg_key in ["expressions", "with", "from", "with_", "from_"]:
            continue

        if old_select.args.get(arg_key) != new_select.args.get(arg_key):
            change_category = "breaking"

    # Track per-CTE-source which changed columns we successfully traced through
    # a projection. Anything in the source's changed-columns set that is *not*
    # observed here represents an unresolvable change (typically because qualify
    # was skipped and column refs lack a table qualifier).
    traced_source_columns: dict[Scope, set[str]] = {}

    def source_column_change_status(ref_column: exp.Column) -> Optional[ChangeStatus]:
        table_name = ref_column.table
        column_name = ref_column.name
        source = new_scope.sources.get(table_name, None)  # type: exp.Table | Scope
        if not isinstance(source, Scope):
            return None

        ref_change_category = scope_changes_map.get(source)
        if ref_change_category is None:
            return None

        status = ref_change_category.columns.get(column_name)
        if status is not None:
            traced_source_columns.setdefault(source, set()).add(column_name)
        return status

    def _unresolvable_cte_change() -> bool:
        # When qualify is skipped (no parent schema), column refs through CTEs
        # don't carry a table qualifier, so source_column_change_status can't
        # trace inner-scope changes back to outer projections. Detect that
        # state by checking whether any CTE-source *modification* was never
        # observed by the per-projection analysis — added/removed source
        # columns surface through the outer projection list directly, but
        # modifications require traceability via qualified column refs. Only
        # consider sources actually selected by this scope — unused CTEs in
        # the WITH clause are inert.
        for _, src in new_scope.selected_sources.values():
            if not isinstance(src, Scope):
                continue
            src_change = scope_changes_map.get(src)
            if src_change is None:
                continue
            # Category-level signal (e.g. breaking CTE) with no traceable
            # column attribution is also unresolvable.
            if src_change.category == "breaking" and not src_change.columns:
                return True
            if src_change.columns:
                traced = traced_source_columns.get(src, set())
                for col, status in src_change.columns.items():
                    if status == "modified" and col not in traced:
                        return True
        return False

    # selects
    old_column_map = {projection.alias_or_name: projection for projection in old_select.selects}
    new_column_map = {projection.alias_or_name: projection for projection in new_select.selects}
    is_distinct = new_select.args.get("distinct") is not None

    for column_name in old_column_map.keys() | new_column_map.keys():

        def _has_udtf(expr: exp.Expression) -> bool:
            return expr.find(exp.UDTF) is not None

        def _has_aggregate(expr: exp.Expression) -> bool:
            return expr.find(exp.AggFunc) is not None

        def _has_star(expr: exp.Expression) -> bool:
            return expr.find(exp.Star) is not None

        old_column = old_column_map.get(column_name)
        new_column = new_column_map.get(column_name)
        if old_column is None:
            if is_distinct:
                change_category = "breaking"
            elif _has_udtf(new_column):
                change_category = "breaking"

            changed_columns[column_name] = "added"
        elif new_column is None:
            if is_distinct:
                change_category = "breaking"
            elif _has_udtf(old_column):
                change_category = "breaking"

            changed_columns[column_name] = "removed"
            if change_category != "breaking":
                change_category = "partial_breaking"
        elif old_column != new_column:
            if is_distinct:
                change_category = "breaking"
            elif _has_udtf(old_column) and _has_udtf(new_column):
                change_category = "breaking"
            elif _has_aggregate(old_column) != _has_aggregate(new_column):
                change_category = "breaking"

            changed_columns[column_name] = "modified"
            if change_category != "breaking":
                change_category = "partial_breaking"
        else:
            if _has_star(new_column):
                for source_name, (_, source) in new_scope.selected_sources.items():
                    change = scope_changes_map.get(source)
                    if change is not None:
                        if change.category == "breaking":
                            change_category = "breaking"
                        for sub_column_name in change.columns.keys():
                            column_change_status = change.columns[sub_column_name]
                            changed_columns[sub_column_name] = column_change_status
                            if change_category != "breaking" and column_change_status in ["removed", "modified"]:
                                change_category = "partial_breaking"
                continue

            ref_columns = new_column.find_all(exp.Column)
            for ref_column in ref_columns:
                if source_column_change_status(ref_column) is not None:
                    if is_distinct:
                        change_category = "breaking"
                    elif _has_udtf(new_column):
                        change_category = "breaking"

                    if change_category != "breaking":
                        change_category = "partial_breaking"
                    changed_columns[column_name] = "modified"

    def selected_column_change_status(ref_column: exp.Column) -> Optional[ChangeStatus]:
        column_name = ref_column.name
        return changed_columns.get(column_name)

    # joins clause: Reference the source columns
    if new_select.args.get("joins"):
        joins = new_select.args.get("joins")
        for join in joins:
            if isinstance(join, exp.Join):
                for ref_column in join.find_all(exp.Column):
                    if source_column_change_status(ref_column) is not None:
                        change_category = "breaking"

    # where clauses: Reference the source columns
    if new_select.args.get("where"):
        where = new_select.args.get("where")
        if isinstance(where, exp.Where):
            for ref_column in where.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    change_category = "breaking"

    # group by clause: Reference the source columns, column index
    if new_select.args.get("group"):
        group = new_select.args.get("group")
        if isinstance(group, exp.Group):
            for ref_column in group.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    change_category = "breaking"

    # having clause: Reference the source columns, selected columns
    if new_select.args.get("having"):
        having = new_select.args.get("having")
        if isinstance(having, exp.Having):
            for ref_column in having.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    change_category = "breaking"
                elif selected_column_change_status(ref_column) is not None:
                    change_category = "breaking"

    # order by clause: Reference the source columns, selected columns, column index
    if new_select.args.get("order"):
        order = new_select.args.get("order")
        if isinstance(order, exp.Order):
            for ref_column in order.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    change_category = "breaking"
                elif selected_column_change_status(ref_column) is not None:
                    change_category = "breaking"

    # Loud-fail: a CTE/subquery source has a real change that we never tied
    # to any outer projection. Without that link we cannot tell which outer
    # columns are affected, so any outer column we haven't already classified
    # must surface as "unknown" rather than silently reporting "no-change".
    # This fires even in mixed-edit cases (some outer projections resolve to
    # added/removed/modified while an unresolvable inner change coexists);
    # we tag the unresolved ones per-column rather than all-or-nothing.
    # See DRC-3409.
    if change_category != "breaking" and _unresolvable_cte_change():
        for column_name in new_column_map.keys():
            if column_name not in changed_columns:
                changed_columns[column_name] = "unknown"
        if change_category == "non_breaking":
            change_category = "unknown"

    return NodeChange(category=change_category, columns=changed_columns)


def _diff_union_scope(old_scope: Scope, new_scope: Scope, scope_changes_map: dict[Scope, NodeChange]) -> NodeChange:
    assert old_scope.expression.key == "union"
    assert new_scope.expression.key == "union"
    assert len(old_scope.union_scopes) == len(new_scope.union_scopes)
    assert new_scope.union_scopes is not None
    assert len(new_scope.union_scopes) > 0

    result_left = scope_changes_map.get(new_scope.union_scopes[0])
    change_category = result_left.category
    changed_columns = result_left.columns.copy()

    for sub_scope in new_scope.union_scopes[1:]:
        result_right = scope_changes_map.get(sub_scope)
        if change_category == "partial_breaking":
            if result_right.category in ["breaking"]:
                change_category = result_right.category
        elif change_category == "non_breaking":
            if result_right.category in ["breaking", "partial_breaking"]:
                change_category = result_right.category
        for column_name, column_change_status in result_right.columns.items():
            changed_columns[column_name] = column_change_status

    return NodeChange(category=change_category, columns=changed_columns)


def parse_change_category(
    old_sql,
    new_sql,
    old_schema=None,
    new_schema=None,
    dialect=None,
    perf_tracking: BreakingPerformanceTracking = None,
) -> NodeChange:
    if old_sql == new_sql:
        return NodeChange(category="non_breaking")

    try:
        dialect = Dialect.get(dialect)

        def _parse(sql, schema):
            exp = parse_one(sql, dialect=dialect)
            if schema:
                try:
                    exp = qualify(exp, schema=schema, dialect=dialect)
                except Exception:
                    # cannot optimize, skip it.
                    pass
            return exp

        old_exp = _parse(old_sql, old_schema)
        new_exp = _parse(new_sql, new_schema)
    except SqlglotError:
        if perf_tracking:
            perf_tracking.increment_sqlglot_error_nodes()
        return CHANGE_CATEGORY_UNKNOWN
    except Exception:
        if perf_tracking:
            perf_tracking.increment_other_error_nodes()
        return CHANGE_CATEGORY_UNKNOWN

    old_scopes = traverse_scope(old_exp)
    new_scopes = traverse_scope(new_exp)
    if len(old_scopes) != len(new_scopes):
        return NodeChange(category="breaking", columns={})

    scope_changes_map = {}
    for old_scope, new_scope in zip(old_scopes, new_scopes):
        if old_scope.expression.key != new_scope.expression.key:
            scope_changes_map[new_scope] = NodeChange(category="breaking")
            continue
        if old_scope == new_scope:
            scope_changes_map[new_scope] = NodeChange(category="non_breaking")
            continue

        scope_type = old_scope.expression.key
        if scope_type == "select":
            # CTE, Subquery, Root
            result = _diff_select_scope(old_scope, new_scope, scope_changes_map)
        elif scope_type == "union":
            # Union
            result = _diff_union_scope(old_scope, new_scope, scope_changes_map)
        else:
            if old_scope.expression != new_scope.expression:
                result = NodeChange(category="breaking", columns={})
            else:
                result = NodeChange(category="non_breaking", columns={})

        if result.category == "unknown":
            return result

        scope_changes_map[new_scope] = result
        if new_scope.is_root:
            return result

    return result
