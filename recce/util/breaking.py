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


def is_breaking_change(old_sql, new_sql, dialect=None):
    # return _is_breaking_change(original_sql, modified_sql, dialect=dialect)
    result = _diff_model(old_sql, new_sql, old_schema=None, new_schema=None, dialect=dialect)
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


def _diff_scope(old_scope: Scope, new_scope: Scope) -> ChangeCategoryResult:
    if old_scope == new_scope:
        return ChangeCategoryResult('non_breaking')

    if not isinstance(old_scope.expression, exp.Select) or not isinstance(new_scope.expression, exp.Select):
        raise ValueError("Currently only SELECT statements are supported for comparison")

    edits = diff(old_scope.expression, new_scope.expression, delta_only=True)
    inserted_expressions = {
        e.expression for e in edits if isinstance(e, Insert)
    }

    for edit in edits:
        if isinstance(edit, Insert):
            inserted_expr = edit.expression

            if isinstance(inserted_expr, VALID_EXPRESSIONS):
                return BREAKING

            if isinstance(inserted_expr, exp.UDTF):
                return BREAKING

            if (
                not isinstance(inserted_expr.parent, exp.Select) and
                inserted_expr.parent not in inserted_expressions
            ):
                return BREAKING
        elif not isinstance(edit, Keep):
            return BREAKING

    return NON_BREAKING


def _diff_model(old_sql, new_sql, old_schema, new_schema, dialect=None) -> ChangeCategoryResult:
    if old_sql == new_sql:
        return ChangeCategoryResult('non_breaking')

    try:
        dialect = Dialect.get(dialect)

        def _parse(sql, schema):
            exp = parse_one(sql, dialect=dialect)
            try:
                exp = optimize(exp, schema=schema, dialect=dialect)
            except Exception:
                # cannot optimize, skip it.
                pass
            return exp

        old_exp = _parse(old_sql, old_schema)
        new_exp = _parse(new_sql, new_schema)
    except Exception:
        return BREAKING

    old_scopes = traverse_scope(old_exp)
    new_scopes = traverse_scope(new_exp)
    if len(old_scopes) != len(new_scopes):
        return BREAKING

    for old_scope, new_scope in zip(old_scopes, new_scopes):
        result = _diff_scope(old_scope, new_scope)
        if result.category == 'breaking':
            return BREAKING

    return NON_BREAKING
