from dataclasses import dataclass
from typing import Literal, Optional

import sqlglot.expressions as exp
from sqlglot import parse_one, diff, Dialect
from sqlglot.diff import Insert, Keep
from sqlglot.optimizer import optimize, traverse_scope, Scope

ChangeCategory = Literal['breaking', 'partial_breaking', 'non_breaking', 'unknown']
ColumnChangeStatus = Literal['added', 'removed', 'modified']
VALID_EXPRESSIONS = (
    exp.Where,
    exp.Join,
    exp.Order,
    exp.Group,
    exp.Having,
    exp.Limit,
    exp.Offset,
    exp.Window,
    exp.Union,
    exp.Intersect,
    exp.Except,
    exp.Merge,
    exp.Delete,
    exp.Update,
    exp.Insert,
    exp.Subquery,
)


@dataclass
class ChangeCategoryResult:
    category: ChangeCategory
    changed_columns: Optional[dict[str, ColumnChangeStatus]]

    def __init__(
        self,
        category: ChangeCategory,
        changed_columns: Optional[dict[str, ColumnChangeStatus]] = None
    ):
        self.category = category
        self.changed_columns = changed_columns


CHANGE_CATEGORY_UNKNOWN = ChangeCategoryResult('unknown')
CHANGE_CATEGORY_BREAKING = ChangeCategoryResult('breaking')


def _debug(*args):
    pass
    # print(*args)


def is_breaking_change(old_sql, new_sql, dialect=None):
    result = parse_change_category(old_sql, new_sql, old_schema=None, new_schema=None, dialect=dialect)
    return result.category != 'non_breaking'


def _is_breaking_change(original_sql, modified_sql, dialect=None) -> bool:
    if original_sql == modified_sql:
        return False

    try:
        dialect = Dialect.get(dialect)

        def _parse(sql):
            ast = parse_one(sql, dialect=dialect)
            try:
                ast = optimize(ast, dialect=dialect)
            except Exception:
                # cannot optimize, skip it.
                pass
            return ast

        original_ast = _parse(original_sql)
        modified_ast = _parse(modified_sql)
    except Exception:
        return True

    if not isinstance(original_ast, exp.Select) or not isinstance(modified_ast, exp.Select):
        raise ValueError("Currently only SELECT statements are supported for comparison")

    edits = diff(original_ast, modified_ast, delta_only=True)

    inserted_expressions = {
        e.expression for e in edits if isinstance(e, Insert)
    }

    for edit in edits:
        if isinstance(edit, Insert):
            inserted_expr = edit.expression

            if isinstance(inserted_expr, VALID_EXPRESSIONS):
                return True

            if isinstance(inserted_expr, exp.UDTF):
                return True

            if (
                not isinstance(inserted_expr.parent, exp.Select) and
                inserted_expr.parent not in inserted_expressions
            ):
                return True
        elif not isinstance(edit, Keep):
            return True

    return False


def _diff_select_scope(
    old_scope: Scope,
    new_scope: Scope,
    scope_changes_map: dict[Scope, ChangeCategoryResult]
) -> ChangeCategoryResult:
    assert old_scope.expression.key == 'select'
    assert new_scope.expression.key == 'select'

    result = ChangeCategoryResult('non_breaking')

    # check if the upstream scopes is the same and not breaking
    if old_scope.sources.keys() != new_scope.sources.keys():
        return CHANGE_CATEGORY_BREAKING
    for source_name, source in new_scope.sources.items():
        if scope_changes_map.get(source) is not None:
            change_category = scope_changes_map[source]
            if change_category.category == 'breaking':
                return CHANGE_CATEGORY_BREAKING

    # check if non-select expressions are the same
    old_select = old_scope.expression  # type: exp.Select
    new_select = new_scope.expression  # type: exp.Select
    for arg_key in old_select.args.keys() | new_select.args.keys():
        if arg_key in ['expressions', 'with', 'from']:
            continue

        if old_select.args.get(arg_key) != new_select.args.get(arg_key):
            return CHANGE_CATEGORY_BREAKING

    def source_column_change_status(ref_column: exp.Column) -> Optional[ColumnChangeStatus]:
        table_name = ref_column.table
        column_name = ref_column.name
        source = new_scope.sources.get(table_name, None)  # type: exp.Table | Scope
        if not isinstance(source, Scope):
            return None

        ref_change_category = scope_changes_map.get(source)
        if ref_change_category is None:
            return None

        return ref_change_category.changed_columns.get(column_name)

    # selects
    old_column_map = {projection.alias_or_name: projection for projection in old_select.selects}
    new_column_map = {projection.alias_or_name: projection for projection in new_select.selects}
    changed_columns = {}
    is_distinct = new_select.args.get('distinct') is not None

    for column_name in (old_column_map.keys() | new_column_map.keys()):
        def _has_udtf(expr: exp.Expression) -> bool:
            return expr.find(exp.UDTF) is not None

        def _has_aggregate(expr: exp.Expression) -> bool:
            return expr.find(exp.AggFunc) is not None

        old_column = old_column_map.get(column_name)
        new_column = new_column_map.get(column_name)
        if old_column is None:
            if is_distinct:
                return CHANGE_CATEGORY_BREAKING

            if _has_udtf(new_column):
                return CHANGE_CATEGORY_BREAKING

            changed_columns[column_name] = 'added'
        elif new_column is None:
            if is_distinct:
                return CHANGE_CATEGORY_BREAKING

            if _has_udtf(old_column):
                return CHANGE_CATEGORY_BREAKING

            changed_columns[column_name] = 'removed'
            result.category = 'partial_breaking'
        elif old_column != new_column:
            if is_distinct:
                return CHANGE_CATEGORY_BREAKING

            if _has_udtf(old_column) and _has_udtf(new_column):
                return CHANGE_CATEGORY_BREAKING

            if _has_aggregate(old_column) != _has_aggregate(new_column):
                return CHANGE_CATEGORY_BREAKING

            changed_columns[column_name] = 'modified'
            result.category = 'partial_breaking'
        else:
            ref_columns = new_column.find_all(exp.Column)
            for ref_column in ref_columns:
                if source_column_change_status(ref_column) is not None:
                    if is_distinct:
                        return CHANGE_CATEGORY_BREAKING
                    if _has_udtf(new_column):
                        return CHANGE_CATEGORY_BREAKING

                    result.category = 'partial_breaking'
                    changed_columns[column_name] = 'modified'

    def selected_column_change_status(ref_column: exp.Column) -> Optional[ColumnChangeStatus]:
        column_name = ref_column.name
        return changed_columns.get(column_name)

    # joins clause: Reference the source columns
    if new_select.args.get('joins'):
        joins = new_select.args.get('joins')
        for join in joins:
            if isinstance(join, exp.Join):
                for ref_column in join.find_all(exp.Column):
                    if source_column_change_status(ref_column) is not None:
                        return CHANGE_CATEGORY_BREAKING

    # where clauses: Reference the source columns
    if new_select.args.get('where'):
        where = new_select.args.get('where')
        if isinstance(where, exp.Where):
            for ref_column in where.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    return CHANGE_CATEGORY_BREAKING

    # group by clause: Reference the source columns, column index
    if new_select.args.get('group'):
        group = new_select.args.get('group')
        if isinstance(group, exp.Group):
            for ref_column in group.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    return CHANGE_CATEGORY_BREAKING

    # having clause: Reference the source columns, selected columns
    if new_select.args.get('having'):
        having = new_select.args.get('having')
        if isinstance(having, exp.Having):
            for ref_column in having.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    return CHANGE_CATEGORY_BREAKING
                if selected_column_change_status(ref_column) is not None:
                    return CHANGE_CATEGORY_BREAKING

    # order by clause: Reference the source columns, selected columns, column index
    if new_select.args.get('order'):
        order = new_select.args.get('order')
        if isinstance(order, exp.Order):
            for ref_column in order.find_all(exp.Column):
                if source_column_change_status(ref_column) is not None:
                    return CHANGE_CATEGORY_BREAKING
                if selected_column_change_status(ref_column) is not None:
                    return CHANGE_CATEGORY_BREAKING

    result.changed_columns = changed_columns
    return result


def _diff_union_scope(
    old_scope: Scope,
    new_scope: Scope,
    scope_changes_map: dict[Scope, ChangeCategoryResult]
) -> ChangeCategoryResult:
    assert old_scope.expression.key == 'union'
    assert new_scope.expression.key == 'union'
    assert len(old_scope.union_scopes) == len(new_scope.union_scopes)
    assert new_scope.union_scopes is not None
    assert len(new_scope.union_scopes) > 0

    result = scope_changes_map.get(new_scope.union_scopes[0])
    if result.category in ['breaking', 'unknown']:
        return result

    for sub_scope in new_scope.union_scopes[1:]:
        result_right = scope_changes_map.get(sub_scope)
        if result_right.category in ['breaking', 'unknown']:
            return result_right
        if result_right.category == 'partial_breaking':
            result.category = 'partial_breaking'
        for column_name, column_change_status in result_right.changed_columns.items():
            result.changed_columns[column_name] = column_change_status

    return result


def parse_change_category(
    old_sql,
    new_sql,
    old_schema=None,
    new_schema=None,
    dialect=None,
    optimizer_rules=None,
) -> ChangeCategoryResult:
    if old_sql == new_sql:
        return ChangeCategoryResult('non_breaking')

    try:
        dialect = Dialect.get(dialect)

        def _parse(sql, schema):
            exp = parse_one(sql, dialect=dialect)
            if schema:
                try:
                    kwargs = {}
                    if optimizer_rules is not None:
                        kwargs["rules"] = optimizer_rules
                    exp = optimize(exp, schema=schema, dialect=dialect, **kwargs)
                except Exception as e:
                    # cannot optimize, skip it.
                    _debug(e)
                    pass
            return exp

        old_exp = _parse(old_sql, old_schema)
        new_exp = _parse(new_sql, new_schema)
    except Exception as e:
        _debug(e)
        return CHANGE_CATEGORY_UNKNOWN

    old_scopes = traverse_scope(old_exp)
    new_scopes = traverse_scope(new_exp)
    if len(old_scopes) != len(new_scopes):
        return CHANGE_CATEGORY_BREAKING

    scope_changes_map = {}
    for old_scope, new_scope in zip(old_scopes, new_scopes):
        if old_scope.expression.key != new_scope.expression.key:
            scope_changes_map[new_scope] = CHANGE_CATEGORY_BREAKING
            continue
        if old_scope == new_scope:
            scope_changes_map[new_scope] = ChangeCategoryResult('non_breaking')
            continue

        scope_type = old_scope.expression.key
        if scope_type == 'select':
            # CTE, Subquery, Root
            result = _diff_select_scope(old_scope, new_scope, scope_changes_map)
        elif scope_type == 'union':
            # Union
            result = _diff_union_scope(old_scope, new_scope, scope_changes_map)
        else:
            if old_scope.expression != new_scope.expression:
                result = CHANGE_CATEGORY_BREAKING
            else:
                result = ChangeCategoryResult('non_breaking', changed_columns={})

        if result.category == 'breaking' or result.category == 'unknown':
            return result

        scope_changes_map[new_scope] = result
        if new_scope.is_root:
            return result

    return result
