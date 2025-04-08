from dataclasses import dataclass
from typing import Literal, Optional

import sqlglot.expressions as exp
from sqlglot import parse_one, diff, Dialect
from sqlglot.diff import Insert, Keep
from sqlglot.optimizer import optimize, traverse_scope, Scope

ChangeCategory = Literal['breaking', 'partial_breaking', 'non_breaking']
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


BREAKING = ChangeCategoryResult('breaking')
NON_BREAKING = ChangeCategoryResult('non_breaking')


def _debug(*args):
    pass
    # print(*args)


def is_breaking_change(old_sql, new_sql, dialect=None):
    # return _is_breaking_change(original_sql, modified_sql, dialect=dialect)
    result = parse_change_category(old_sql, new_sql, old_schema=None, new_schema=None, dialect=dialect)
    return result.category == 'breaking'


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


def _diff_scope(
    old_scope: Scope,
    new_scope: Scope,
    scope_changes_map: dict[Scope, ChangeCategoryResult]
) -> ChangeCategoryResult:
    result = ChangeCategoryResult('non_breaking')
    if old_scope == new_scope:
        return ChangeCategoryResult('non_breaking')

    if not isinstance(old_scope.expression, exp.Select) or not isinstance(new_scope.expression, exp.Select):
        raise ValueError("Currently only SELECT statements are supported for comparison")

    old_select = old_scope.expression  # type: exp.Select
    new_select = new_scope.expression  # type: exp.Select

    for arg_key in old_select.args.keys() | new_select.args.keys():
        if arg_key in ['expressions', 'with']:
            continue

        if old_select.args.get(arg_key) != new_select.args.get(arg_key):
            return BREAKING

    # selects
    old_column_map = {projection.alias_or_name: projection for projection in old_select.selects}
    new_column_map = {projection.alias_or_name: projection for projection in new_select.selects}
    changed_columns = {}

    for column_name in (old_column_map.keys() | new_column_map.keys()):
        def _has_udtf(expresion: exp.Expression) -> bool:
            for expr in expresion.walk():
                if isinstance(expr, exp.UDTF):
                    return True
            return False

        old_column = old_column_map.get(column_name)
        new_column = new_column_map.get(column_name)
        if old_column is None:

            if _has_udtf(new_column):
                return BREAKING

            changed_columns[column_name] = 'added'
        elif new_column is None:
            if _has_udtf(old_column):
                return BREAKING

            changed_columns[column_name] = 'removed'
            result.category = 'partial_breaking'
        elif old_column != new_column:
            if _has_udtf(old_column) and _has_udtf(new_column):
                return BREAKING

            changed_columns[column_name] = 'modified'
            result.category = 'partial_breaking'
        else:
            ref_columns = new_column.find_all(exp.Column)
            for ref_column in ref_columns:
                table_name = ref_column.table
                column_name = ref_column.name
                source = new_scope.sources.get(table_name, None)  # type: exp.Table | Scope
                if not isinstance(source, Scope):
                    continue

                change_category = scope_changes_map.get(source)
                if not change_category:
                    continue

                if change_category.category == 'breaking':
                    return BREAKING

                if change_category.category == 'partial_breaking':
                    if change_category.changed_columns.get(column_name) is not None:
                        result.category = 'partial_breaking'
                        changed_columns[column_name] = 'modified'

    # where
    for arg_key in new_select.args.keys():
        arg_value = new_select.args[arg_key]
        if arg_value is None:
            continue

        if isinstance(arg_value, exp.Expression):
            for column in arg_value.find_all(exp.Column):
                if changed_columns.get(column.name) is not None:
                    return BREAKING

    result.changed_columns = changed_columns
    return result


def parse_change_category(old_sql, new_sql, old_schema=None, new_schema=None, dialect=None) -> ChangeCategoryResult:
    if old_sql == new_sql:
        return ChangeCategoryResult('non_breaking')

    try:
        dialect = Dialect.get(dialect)

        def _parse(sql, schema):
            exp = parse_one(sql, dialect=dialect)
            if schema:
                try:
                    exp = optimize(exp, schema=schema, dialect=dialect)
                except Exception:
                    # cannot optimize, skip it.
                    pass
            return exp

        old_exp = _parse(old_sql, old_schema)
        new_exp = _parse(new_sql, new_schema)
    except Exception as e:
        _debug(e)
        return BREAKING

    old_scopes = traverse_scope(old_exp)
    new_scopes = traverse_scope(new_exp)
    if len(old_scopes) != len(new_scopes):
        return BREAKING

    scope_changes_map = {}
    for old_scope, new_scope in zip(old_scopes, new_scopes):
        result = _diff_scope(old_scope, new_scope, scope_changes_map)
        scope_changes_map[new_scope] = result
        if new_scope.is_root:
            return result

    return result
    # return NON_BREAKING
