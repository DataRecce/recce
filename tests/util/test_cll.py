import unittest
from dataclasses import dataclass
from typing import Dict

from sqlglot import parse_one
from sqlglot.expressions import Column, Alias, Func, Binary, Paren, Case, Expression
from sqlglot.optimizer import traverse_scope
from sqlglot.optimizer.qualify import qualify


@dataclass
class ColumnLevelDependencyColumn:
    type: str


@dataclass
class ColumnLevelDependencyModel:
    columns: Dict[str, ColumnLevelDependencyColumn]


ColumnLevelDependency = Dict[str, ColumnLevelDependencyModel]


def _cll_expression(expression, default_table):
    # given an expression, return the columns depends on
    # [{node: table, column: column}, ...]

    if isinstance(expression, Column):
        column = expression
        return [{"node": column.table or default_table, "column": column.name}]
    elif isinstance(expression, Paren):
        return _cll_expression(expression.this, default_table)
    elif isinstance(expression, Binary):
        depends_on = []
        if expression.left:
            depends_on_left = _cll_expression(expression.left, default_table)
            depends_on.extend(depends_on_left)
        if expression.right:
            depends_on_right = _cll_expression(expression.right, default_table)
            depends_on.extend(depends_on_right)
        return depends_on
    elif isinstance(expression, Case):
        ifs = expression.args['ifs']
        default = expression.args['default']
        depends_on = []
        for expr in ifs:
            depends_on_one = _cll_expression(expr, default_table)
            depends_on.extend(depends_on_one)
        depends_on.extend(_cll_expression(default, default_table))
        return depends_on

    elif isinstance(expression, Func):
        if expression.expressions:
            depends_on = []
            for expr in expression.expressions:
                depends_on_one = _cll_expression(expr, default_table)
                depends_on.extend(depends_on_one)
            return depends_on
        if expression.this:
            return _cll_expression(expression.this, default_table)
        return []
    elif expression.this and isinstance(expression.this, Expression):
        return _cll_expression(expression.this, default_table)
    else:
        return []


def cll(sql, schema=None):
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
        if len(scope.expression.args.get('joins', [])) > 0:
            default_table = None

        for select in scope.expression.selects:
            # instance of Column
            col_depends_on = []
            if isinstance(select, Column):
                column = select
                col_depends_on = [
                    {"node": column.table or default_table, "column": column.name}
                ]
            elif isinstance(select, Alias):
                alias = select
                col_expression = alias.this
                col_depends_on = _cll_expression(col_expression, default_table)

            flatten_col_depends_on = []
            for col_dep in col_depends_on:
                col_dep_node = col_dep['node']
                col_dep_column = col_dep['column']
                cte_scope = scope.cte_sources.get(col_dep_node)
                if cte_scope is not None:
                    cte_cll = global_lineage[cte_scope]
                    flatten_col_depends_on.extend(cte_cll.get(col_dep_column))
                else:
                    flatten_col_depends_on.append(col_dep)

            scope_lineage[select.alias_or_name] = flatten_col_depends_on

        global_lineage[scope] = scope_lineage
        if not scope.is_cte:
            result = scope_lineage

    # 第二個 pass: 解析全域層級的 dependency map，確保 external table 的 dependency
    # for column, depends_on in scope_lineage.items():
    #     global_lineage[column] = {
    #         "type": "transform" if len(depends_on) > 1 else "original",
    #         "depends_on": depends_on,
    #     }
    return result


class ColumnLevelLineageTest(unittest.TestCase):
    def test_sql(self):
        sql = """
        select a,b from table1
        """
        result = cll(sql)
        assert (result['a'][0]['node'] == 'table1')
        assert (result['b'][0]['node'] == 'table1')

    def test_sql_with_canonial(self):
        sql = """
        select table1.a from schema1.table1
        """
        result = cll(sql)
        assert (result['a'][0]['node'] == 'table1')

        sql = """
        select table1.a from db1.schema1.table1
        """
        result = cll(sql)
        assert (result['a'][0]['node'] == 'table1')

    def test_select_star(self):
        sql = """
        select * from table1
        """
        result = cll(sql, {'table1': {'a': 'int', 'b': 'int'}})
        assert (result['a'][0]['node'] == 'table1')
        assert (result['b'][0]['node'] == 'table1')

    def test_source_literal(self):
        # numeric literal
        sql = """
        select 1
        """
        result = cll(sql)
        assert len(result['1']) == 0

        # string literal
        sql = """
        select 'abc' as c
        """
        result = cll(sql)
        assert len(result['c']) == 0

        # timestamp literal
        sql = """
        select timestamp '2021-01-01 00:00:00' as c
        """
        result = cll(sql)
        assert len(result['c']) == 0

    def test_source_generative_function(self):
        # numeric literal
        sql = """
        select CURRENT_TIMESTAMP() as c from table1
        """
        result = cll(sql)
        assert len(result['c']) == 0

        # uuid
        sql = """
        select UUID() as c from table1
        """
        result = cll(sql)
        assert len(result['c']) == 0

    def test_alias(self):
        sql = """
        select a as c from table1
        """
        result = cll(sql)
        assert result['c'][0]['node'] == 'table1'
        assert result['c'][0]['column'] == 'a'

    def test_forward_ref(self):
        sql = """
        select
            a as b,
            b as c
        from table1
        """
        result = cll(sql)
        assert result['b'][0]['node'] == 'table1'
        assert result['b'][0]['column'] == 'a'
        assert result['c'][0]['node'] == 'table1'
        assert result['c'][0]['column'] == 'a'

    def test_transform_case_when(self):
        sql = """
        select case
            when a > 0 then 'a'
            when a > 10 then 'b'
            else 'c'
        end as x from table1
        """
        result = cll(sql)
        assert result['x'][0]['node'] == 'table1'
        assert result['x'][0]['column'] == 'a'
        # assert len(result['x']) == 1

    def test_transform_binary(self):
        sql = """
        select (a+b) * (c+d) as x from table1
        """
        result = cll(sql)
        assert result['x'][0]['node'] == 'table1'
        assert len(result['x']) == 4

    def test_transform_binary_predicate(self):
        sql = """
        select a > 0 as x from table1
        """
        result = cll(sql)
        assert result['x'][0]['node'] == 'table1'
        assert result['x'][0]['column'] == 'a'

    def test_transform_in(self):
        sql = """
        select a in (1, 2, 3) as x from table1
        """
        result = cll(sql)
        assert result['x'][0]['node'] == 'table1'
        assert result['x'][0]['column'] == 'a'

    def test_transform_type_cast(self):
        sql = """
        select cast(a as int) as x from table1
        """
        result = cll(sql)
        assert result['x'][0]['node'] == 'table1'
        assert result['x'][0]['column'] == 'a'

    def test_transform_type_cast_operator(self):
        sql = """
        select a::int as x from table1
        """
        result = cll(sql)
        assert result['x'][0]['node'] == 'table1'
        assert result['x'][0]['column'] == 'a'

    def test_transform_func(self):
        sql = """
        select date_trunc('month', created_at) as a from table1
        """
        result = cll(sql)
        assert result['a'][0]['node'] == 'table1'
        assert result['a'][0]['column'] == 'created_at'

    def test_transform_udf(self):
        sql = """
        select xyz(1, 2, created_at) as a from table1
        """
        result = cll(sql)
        assert result['a'][0]['node'] == 'table1'
        assert result['a'][0]['column'] == 'created_at'

    def test_transform_agg_func(self):
        sql = """
        select
            count() as b,
        from table1
        """
        result = cll(sql)
        assert len(result['b']) == 0

        sql = """
        select
            count(*) as b,
        from table1
        """
        result = cll(sql)
        assert len(result['b']) == 0

        sql = """
        select
            count(a) as b,
        from table1
        """
        result = cll(sql)
        assert result['b'][0]['node'] == 'table1'
        assert result['b'][0]['column'] == 'a'

        sql = """
        select
            count(a) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert result['b'][0]['node'] == 'table1'
        assert result['b'][0]['column'] == 'a'

    def test_transform_nested_func(self):
        sql = """
        select
            count(xyz(a1 or a2, a1 or a3)) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert result['b'][0]['node'] == 'table1'
        assert result['b'][0]['column'] == 'a1'

    def test_transform_udtf(self):
        sql = """
        select
            explode(a) as b,
        from table1
        """
        result = cll(sql)
        assert result['b'][0]['node'] == 'table1'
        assert result['b'][0]['column'] == 'a'

    def test_join(self):
        sql = """
        select table1.a, table2.b
        from table1
        join table2 on table1.id = table2.id
        """
        result = cll(sql)
        assert (result['a'][0]['node'] == 'table1')
        assert (result['b'][0]['node'] == 'table2')

        sql = """
                select a, b
                from table1
                join table2 on table1.id = table2.id
                """
        result = cll(sql)
        assert result['a'][0]['node'] is None
        assert result['b'][0]['node'] is None

    def test_join_with_schema(self):
        sql = """
                select a, b
                from table1
                join table2 on table1.id = table2.id
                """
        result = cll(sql, {'table1': {'id': 'Int', 'a': 'Int'}, 'table2': {'id': 'Int', 'b': 'Int'}})
        assert result['a'][0]['node'] == 'table1'
        assert result['b'][0]['node'] == 'table2'

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
        assert result['a'][0]['node'] == 'table1'
        assert result['a'][0]['column'] == 'a'
