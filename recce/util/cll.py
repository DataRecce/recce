from dataclasses import dataclass
from typing import Dict, List, Literal

from sqlglot import parse_one
from sqlglot.errors import SqlglotError, OptimizeError
from sqlglot.expressions import Column, Alias, Func, Binary, Paren, Case, Expression, If, Union, Intersect
from sqlglot.optimizer import traverse_scope
from sqlglot.optimizer.qualify import qualify

from recce.exceptions import RecceException


@dataclass
class ColumnLevelDependsOn:
    node: str
    column: str


@dataclass
class ColumnLevelDependencyColumn:
    type: Literal['source', 'passthrough', 'renamed', 'derived']
    depends_on: List[ColumnLevelDependsOn]


def _cll_expression(expression, default_table) -> ColumnLevelDependencyColumn:
    # given an expression, return the columns depends on
    # [{node: table, column: column}, ...]

    if isinstance(expression, Column):
        column = expression
        return ColumnLevelDependencyColumn(
            type='passthrough',
            depends_on=[ColumnLevelDependsOn(column.table or default_table, column.name)]
        )
    elif isinstance(expression, Paren):
        return _cll_expression(expression.this, default_table)
    elif isinstance(expression, Binary):
        depends_on = []
        if expression.left:
            depends_on_left = _cll_expression(expression.left, default_table).depends_on
            depends_on.extend(depends_on_left)
        if expression.right:
            depends_on_right = _cll_expression(expression.right, default_table).depends_on
            depends_on.extend(depends_on_right)
        type = 'derived' if depends_on else 'source'
        return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)
    elif isinstance(expression, Case):
        ifs = expression.args['ifs']
        default = expression.args['default']
        depends_on = []
        for expr in ifs:
            depends_on_one = _cll_expression(expr, default_table).depends_on
            depends_on.extend(depends_on_one)
        depends_on.extend(_cll_expression(default, default_table).depends_on)
        type = 'derived' if depends_on else 'source'
        return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)
    elif isinstance(expression, If):
        depends_on = []
        if expression.this:
            depends_on_one = _cll_expression(expression.this, default_table).depends_on
            depends_on.extend(depends_on_one)
        if expression.args.get('true'):
            depends_on_one = _cll_expression(expression.args.get('true'), default_table).depends_on
            depends_on.extend(depends_on_one)
        if expression.args.get('false'):
            depends_on_one = _cll_expression(expression.args.get('false'), default_table).depends_on
            depends_on.extend(depends_on_one)
        type = 'derived' if depends_on else 'source'
        return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)
    elif isinstance(expression, Func):
        if expression.expressions:
            depends_on = []
            for expr in expression.expressions:
                depends_on_one = _cll_expression(expr, default_table).depends_on
                depends_on.extend(depends_on_one)
            type = 'derived' if depends_on else 'source'
            return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)
        if expression.this:
            depends_on = _cll_expression(expression.this, default_table).depends_on
            type = 'derived' if depends_on else 'source'
            return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)

        return ColumnLevelDependencyColumn(type='source', depends_on=[])
    elif expression.this and isinstance(expression.this, Expression):
        depends_on = _cll_expression(expression.this, default_table).depends_on
        type = 'derived' if depends_on else 'source'
        return ColumnLevelDependencyColumn(type=type, depends_on=depends_on)
    else:
        depends_on = []
        return ColumnLevelDependencyColumn(type='source', depends_on=depends_on)


def cll(sql, schema=None) -> Dict[str, ColumnLevelDependencyColumn]:
    # given a sql, return the columns depends on
    # {
    #   'column1': {
    #      'transformation_type': 'transform' or 'original',
    #      'depends_on': {
    #           {node: model_id, column: column}, ...]
    #      }
    try:
        expression = parse_one(sql)
    except SqlglotError as e:
        raise RecceException(f'Failed to parse SQL: {str(e)}')

    try:
        expression = qualify(expression, schema=schema)
    except OptimizeError as e:
        raise RecceException(f'Failed to optimize SQL: {str(e)}')
    except SqlglotError as e:
        raise RecceException(f'Failed to qualify SQL: {str(e)}')

    result = {}
    global_lineage = {}
    for scope in traverse_scope(expression):
        scope_lineage = {}
        default_table = scope.expression.args['from'].name if scope.expression.args.get('from') else None

        if isinstance(scope.expression, Union) or isinstance(scope.expression, Intersect):
            for union_scope in scope.union_scopes:
                for k, v in global_lineage[union_scope].items():
                    if k not in scope_lineage:
                        scope_lineage[k] = v
                    else:
                        scope_lineage[k].depends_on.extend(v.depends_on)
                        scope_lineage[k].type = 'derived'
        else:
            for select in scope.expression.selects:
                # instance of Column
                if isinstance(select, Column):
                    # 'select a'
                    column = select
                    column_cll = _cll_expression(column, default_table)
                elif isinstance(select, Alias):
                    # 'select a as b'
                    # 'select CURRENT_TIMESTAMP() as create_at'
                    alias = select
                    col_expression = alias.this
                    column_cll = _cll_expression(col_expression, default_table)
                    if (
                        column_cll and
                        column_cll.type == 'passthrough' and
                        column_cll.depends_on[0].column != alias.alias_or_name
                    ):
                        column_cll.type = 'renamed'
                else:
                    # 'select 1'
                    column_cll = ColumnLevelDependencyColumn(type='source', depends_on=[])

                cte_type = None
                flatten_col_depends_on = []
                for col_dep in column_cll.depends_on:
                    col_dep_node = col_dep.node
                    col_dep_column = col_dep.column
                    cte_scope = scope.cte_sources.get(col_dep_node)
                    if cte_scope is not None:
                        cte_cll = global_lineage[cte_scope]
                        if cte_cll is None or cte_cll.get(col_dep_column) is None:
                            # In dbt-duckdb, the external source is compiled as `read_csv('..') rather than a table.
                            continue
                        cte_type = cte_cll.get(col_dep_column).type
                        flatten_col_depends_on.extend(cte_cll.get(col_dep_column).depends_on)
                    else:
                        flatten_col_depends_on.append(col_dep)

                # deduplicate
                dedup_col_depends_on = []
                dedup_set = set()
                for col_dep in flatten_col_depends_on:
                    node_col = col_dep.node + '.' + col_dep.column
                    if node_col not in dedup_set:
                        dedup_col_depends_on.append(col_dep)
                        dedup_set.add(node_col)

                # transformation type
                type = column_cll.type
                if type == 'derived':
                    # keep current scope type
                    pass
                elif cte_type is not None:
                    if len(dedup_col_depends_on) > 1:
                        type = 'derived'
                    elif len(dedup_col_depends_on) == 0:
                        type = 'source'
                    else:
                        if isinstance(select, Column):
                            type = cte_type
                        elif isinstance(select, Alias):
                            alias = select
                            if column_cll.depends_on[0].column == alias.alias_or_name:
                                type = cte_type
                            else:
                                type = 'renamed' if cte_type == 'passthrough' else cte_type
                        else:
                            type = 'source'

                scope_lineage[select.alias_or_name] = ColumnLevelDependencyColumn(
                    type=type,
                    depends_on=dedup_col_depends_on
                )

        global_lineage[scope] = scope_lineage
        if not scope.is_cte:
            result = scope_lineage

    return result
