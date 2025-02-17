import unittest
from dataclasses import dataclass
from typing import Dict, List, Literal

from sqlglot import parse_one
from sqlglot.expressions import Column, Alias, Func, Binary, Paren, Case, Expression
from sqlglot.optimizer import traverse_scope
from sqlglot.optimizer.qualify import qualify


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
    except Exception as e:
        raise ValueError("Invalid SQL input")

    try:
        expression = qualify(expression, schema=schema)
    except Exception as e:
        pass

    # 第一個 pass: 建立每個 scope 的 column dependency map
    result = {}
    global_lineage = {}
    for scope in traverse_scope(expression):
        scope_lineage = {}
        default_table = scope.expression.args['from'].name if scope.expression.args.get('from') else None

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
                if (column_cll and
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
            if cte_type is not None:
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


class ColumnLevelLineageTest(unittest.TestCase):
    def test_sql(self):
        sql = """
        select a,b from table1
        """
        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'

    def test_sql_with_canonial(self):
        sql = """
        select table1.a from schema1.table1
        """
        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'

        sql = """
        select table1.a from db1.schema1.table1
        """
        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'

    def test_select_star(self):
        sql = """
        select * from table1
        """
        result = cll(sql, {'table1': {'a': 'int', 'b': 'int'}})
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['b'].type == 'passthrough'
        assert result['b'].depends_on[0].node == 'table1'

    def test_source_literal(self):
        # # numeric literal
        # sql = """
        # select 1
        # """
        # result = cll(sql)
        # assert result['1'].type == 'source'
        # assert len(result['1'].depends_on) == 0
        #
        # # string literal
        # sql = """
        # select 'abc' as c
        # """
        # result = cll(sql)
        # assert result['c'].type == 'source'
        # assert len(result['c'].depends_on) == 0

        # timestamp literal
        sql = """
        select timestamp '2021-01-01 00:00:00' as c
        """
        result = cll(sql)
        assert result['c'].type == 'source'
        assert len(result['c'].depends_on) == 0

    def test_source_generative_function(self):
        # numeric literal
        sql = """
        select CURRENT_TIMESTAMP() as c from table1
        """
        result = cll(sql)
        assert result['c'].type == 'source'
        assert len(result['c'].depends_on) == 0

        # uuid
        sql = """
        select UUID() as c from table1
        """
        result = cll(sql)
        assert result['c'].type == 'source'
        assert len(result['c'].depends_on) == 0

    def test_alias(self):
        sql = """
        select a as c from table1
        """
        result = cll(sql)
        assert result['c'].type == 'renamed'
        assert result['c'].depends_on[0].node == 'table1'
        assert result['c'].depends_on[0].column == 'a'

    def test_forward_ref(self):
        sql = """
        select
            a as b,
            b as c
        from table1
        """
        result = cll(sql)
        assert result['b'].type == 'renamed'
        assert result['b'].depends_on[0].node == 'table1'
        assert result['b'].depends_on[0].column == 'a'
        assert result['c'].type == 'renamed'
        assert result['c'].depends_on[0].node == 'table1'
        assert result['c'].depends_on[0].column == 'a'

    def test_transform_case_when(self):
        sql = """
        select case
            when a > 0 then 'a'
            when a > 10 then 'b'
            else 'c'
        end as x from table1
        """
        result = cll(sql)
        assert result['x'].type == 'derived'
        assert result['x'].depends_on[0].node == 'table1'
        assert result['x'].depends_on[0].column == 'a'
        assert len(result['x'].depends_on) == 1

    def test_transform_binary(self):
        sql = """
        select (a+b) * (c+d) as x from table1
        """
        result = cll(sql)
        assert result['x'].type == 'derived'
        assert result['x'].depends_on[0].node == 'table1'
        assert len(result['x'].depends_on) == 4

    def test_transform_binary_predicate(self):
        sql = """
        select a > 0 as x from table1
        """
        result = cll(sql)
        assert result['x'].type == 'derived'
        assert result['x'].depends_on[0].node == 'table1'
        assert result['x'].depends_on[0].column == 'a'

    def test_transform_in(self):
        sql = """
        select a in (1, 2, 3) as x from table1
        """
        result = cll(sql)
        assert result['x'].type == 'derived'
        assert result['x'].depends_on[0].node == 'table1'
        assert result['x'].depends_on[0].column == 'a'

    def test_transform_type_cast(self):
        sql = """
        select cast(a as int) as x from table1
        """
        result = cll(sql)
        assert result['x'].type == 'derived'
        assert result['x'].depends_on[0].node == 'table1'
        assert result['x'].depends_on[0].column == 'a'

    def test_transform_type_cast_operator(self):
        sql = """
        select a::int as x from table1
        """
        result = cll(sql)
        assert result['x'].type == 'derived'
        assert result['x'].depends_on[0].node == 'table1'
        assert result['x'].depends_on[0].column == 'a'

    def test_transform_func(self):
        sql = """
        select date_trunc('month', created_at) as a from table1
        """
        result = cll(sql)
        assert result['a'].type == 'derived'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['a'].depends_on[0].column == 'created_at'

    def test_transform_udf(self):
        sql = """
        select xyz(1, 2, created_at) as a from table1
        """
        result = cll(sql)
        assert result['a'].type == 'derived'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['a'].depends_on[0].column == 'created_at'

    def test_transform_agg_func(self):
        sql = """
        select
            count() as b,
        from table1
        """
        result = cll(sql)
        assert result['b'].type == 'source'
        assert len(result['b'].depends_on) == 0

        sql = """
        select
            count(*) as b,
        from table1
        """
        result = cll(sql)
        assert result['b'].type == 'source'
        assert len(result['b'].depends_on) == 0

        sql = """
        select
            count(a) as b,
        from table1
        """
        result = cll(sql)
        assert result['b'].type == 'derived'
        assert result['b'].depends_on[0].node == 'table1'
        assert result['b'].depends_on[0].column == 'a'

        sql = """
        select
            count(a) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert result['b'].type == 'derived'
        assert result['b'].depends_on[0].node == 'table1'
        assert result['b'].depends_on[0].column == 'a'

    def test_transform_nested_func(self):
        sql = """
        select
            count(xyz(a1 or a2, a1 or a3)) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert result['b'].type == 'derived'
        assert result['b'].depends_on[0].node == 'table1'
        assert result['b'].depends_on[0].column == 'a1'

    def test_transform_udtf(self):
        sql = """
        select
            explode(a) as b,
        from table1
        """
        result = cll(sql)
        assert result['b'].type == 'derived'
        assert result['b'].depends_on[0].node == 'table1'
        assert result['b'].depends_on[0].column == 'a'

    def test_join(self):
        sql = """
        select table1.a, table2.b
        from table1
        join table2 on table1.id = table2.id
        """
        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['b'].type == 'passthrough'
        assert result['b'].depends_on[0].node == 'table2'

        sql = """
                select a, b
                from table1
                join table2 on table1.id = table2.id
                """
        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['b'].type == 'passthrough'
        assert result['b'].depends_on[0].node == 'table1'

    def test_join_with_schema(self):
        sql = """
                select a, b
                from table1
                join table2 on table1.id = table2.id
                """
        result = cll(sql, {'table1': {'id': 'Int', 'a': 'Int'}, 'table2': {'id': 'Int', 'b': 'Int'}})
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['b'].type == 'passthrough'
        assert result['b'].depends_on[0].node == 'table2'

    def test_cte(self):
        sql = """
        with
        cte1 as (
            select a from table1
        ),
        cte2 as (
            select a from cte1
        )
        select * from cte2
        """

        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['a'].depends_on[0].column == 'a'

    def test_cte_with_join(self):
        sql = """
        with
        cte1 as (
            select id, a from table1
        ),
        cte2 as (
            select id, b from table2
        )
        select
            id,
            a,
            b,
            table3.c
        from table3
        left join cte1 on table3.id = cte1.id
        join cte2 on table3.id = cte2.id
        """

        result = cll(sql)
        assert result['id'].type == 'passthrough'
        assert result['id'].depends_on[0].node == 'table3'
        assert result['id'].depends_on[0].column == 'id'
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['a'].depends_on[0].column == 'a'
        assert result['b'].type == 'passthrough'
        assert result['b'].depends_on[0].node == 'table2'
        assert result['b'].depends_on[0].column == 'b'
        assert result['c'].type == 'passthrough'
        assert result['c'].depends_on[0].node == 'table3'
        assert result['c'].depends_on[0].column == 'c'

    def test_cte_with_transform(self):
        sql = """
        with
        cte1 as (
            select
                a,
                b as b2,
                a + b as x
            from table1
        )
        select
            a,
            b2 as b3,
            x as y
        from cte1
        """

        result = cll(sql)
        assert result['a'].type == 'passthrough'
        assert result['a'].depends_on[0].node == 'table1'
        assert result['a'].depends_on[0].column == 'a'
        assert result['b3'].type == 'renamed'
        assert result['b3'].depends_on[0].node == 'table1'
        assert result['b3'].depends_on[0].column == 'b'
        assert result['y'].type == 'derived'
        assert result['y'].depends_on[0].node == 'table1'
        assert result['y'].depends_on[0].column == 'a'
        assert result['y'].depends_on[1].node == 'table1'
        assert result['y'].depends_on[1].column == 'b'

    def test_cte_with_transform2(self):
        sql = """
        with
        cte1 as (
            select
                a + b as x
            from table1
        )
        select
            x as y
        from cte1
        """

        result = cll(sql)
        assert result['y'].type == 'derived'
        assert result['y'].depends_on[0].node == 'table1'
        assert result['y'].depends_on[0].column == 'a'
        assert result['y'].depends_on[1].node == 'table1'
        assert result['y'].depends_on[1].column == 'b'
