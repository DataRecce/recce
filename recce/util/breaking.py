from sqlglot.optimizer import optimize


def is_breaking_change(original_sql, modified_sql, dialect=None):
    if original_sql == modified_sql:
        return False

    try:
        from sqlglot import parse_one, diff
        from sqlglot.diff import Insert, Keep
        import sqlglot.expressions as exp
    except ImportError:
        return True

    try:
        original_ast = optimize(parse_one(original_sql, dialect=dialect))
        modified_ast = optimize(parse_one(modified_sql, dialect=dialect))
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

            if isinstance(inserted_expr, VALID_EXPRESSIONS):
                return True

            if (
                not isinstance(inserted_expr.parent, exp.Select) and
                inserted_expr.parent not in inserted_expressions
            ):
                return True
        elif not isinstance(edit, Keep):
            return True

    return False
