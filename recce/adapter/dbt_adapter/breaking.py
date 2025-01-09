def is_breaking_change(original_sql, modified_sql):
    if original_sql == modified_sql:
        return False

    try:
        from sqlglot import parse_one, diff
        from sqlglot.diff import Insert, Keep
        import sqlglot.expressions as exp
    except ImportError:
        return True
    original_ast = parse_one(original_sql)
    modified_ast = parse_one(modified_sql)
    if not isinstance(original_ast, exp.Select) or not isinstance(modified_ast, exp.Select):
        raise ValueError("Currently only SELECT statements are supported for comparison")

    edits = diff(original_ast, modified_ast)

    inserted_expressions = {
        e.expression for e in edits if isinstance(e, Insert)
    }

    for edit in edits:
        if isinstance(edit, Insert):
            inserted_expr = edit.expression

            if isinstance(inserted_expr, exp.Where):
                return True

            if (
                not isinstance(inserted_expr.parent, exp.Select)
                and inserted_expr.parent not in inserted_expressions
            ):
                return True
        elif not isinstance(edit, Keep):
            return True

    return False
