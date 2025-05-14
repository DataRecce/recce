import unittest

from recce.util.cll import cll_old as cll


class ColumnLevelLineageTest(unittest.TestCase):
    def test_sql(self):
        sql = """
        select a,b from table1
        """
        result = cll(sql)
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"

    def test_sql_with_canonial(self):
        sql = """
        select table1.a from schema1.table1
        """
        result = cll(sql)
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"

        sql = """
        select table1.a from db1.schema1.table1
        """
        result = cll(sql)
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"

    def test_select_star(self):
        sql = """
        select * from table1
        """
        result = cll(sql, {"table1": {"a": "int", "b": "int"}})
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["b"].type == "passthrough"
        assert result["b"].depends_on[0].node == "table1"

    def test_source_literal(self):
        # numeric literal
        sql = """
        select 1
        """
        result = cll(sql)
        assert result["1"].type == "source"
        assert len(result["1"].depends_on) == 0

        # string literal
        sql = """
        select 'abc' as c
        """
        result = cll(sql)
        assert result["c"].type == "source"
        assert len(result["c"].depends_on) == 0

        # timestamp literal
        sql = """
        select timestamp '2021-01-01 00:00:00' as c
        """
        result = cll(sql)
        assert result["c"].type == "source"
        assert len(result["c"].depends_on) == 0

    def test_source_generative_function(self):
        # numeric literal
        sql = """
        select CURRENT_TIMESTAMP() as c from table1
        """
        result = cll(sql)
        assert result["c"].type == "source"
        assert len(result["c"].depends_on) == 0

        # uuid
        sql = """
        select UUID() as c from table1
        """
        result = cll(sql)
        assert result["c"].type == "source"
        assert len(result["c"].depends_on) == 0

    def test_alias(self):
        sql = """
        select a as c from table1
        """
        result = cll(sql)
        assert result["c"].type == "renamed"
        assert result["c"].depends_on[0].node == "table1"
        assert result["c"].depends_on[0].column == "a"

    def test_alias_table(self):
        sql = """
        select a as c from table1 as table2
        """
        result = cll(sql)
        assert result["c"].type == "renamed"
        assert result["c"].depends_on[0].node == "table1"
        assert result["c"].depends_on[0].column == "a"

        sql = """
        select T1.a, T2.b
        from table1 as T1
        join table2 as T2 on T1.id = T2.id
        """
        result = cll(sql)
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["b"].type == "passthrough"
        assert result["b"].depends_on[0].node == "table2"

        sql = """
        with cte as (
            select a as c from table1 as table2
        )
        select * from cte as final
        """
        result = cll(sql)
        assert result["c"].type == "renamed"
        assert result["c"].depends_on[0].node == "table1"
        assert result["c"].depends_on[0].column == "a"

    def test_inline_alias_table(self):
        sql = """
        select
            t2.id,
            a as c,
            jn.b
        from t1 as t2
        left join (
            select
                id,
                b
            from t3
        ) as jn on t2.id = jn.id
        """
        result = cll(sql)
        assert result["c"].type == "renamed"
        assert result["c"].depends_on[0].node == "t1"
        assert result["c"].depends_on[0].column == "a"
        assert result["b"].type == "passthrough"
        assert result["b"].depends_on[0].node == "t3"
        assert result["b"].depends_on[0].column == "b"

    def test_forward_ref(self):
        sql = """
        select
            a as b,
            b as c
        from table1
        """
        result = cll(sql)
        assert result["b"].type == "renamed"
        assert result["b"].depends_on[0].node == "table1"
        assert result["b"].depends_on[0].column == "a"
        assert result["c"].type == "renamed"
        assert result["c"].depends_on[0].node == "table1"
        assert result["c"].depends_on[0].column == "a"

    def test_transform_case_when(self):
        sql = """
        select case
            when a > 0 then 'a'
            when a > 10 then 'b'
            else 'c'
        end as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "a"
        assert len(result["x"].depends_on) == 1

        sql = """
        select case
            when payment_method = 'gift_card' then amount
            else 0
        end as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert len(result["x"].depends_on) == 2
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "payment_method"
        assert result["x"].depends_on[1].node == "table1"
        assert result["x"].depends_on[1].column == "amount"

    def test_transform_case_when_no_default(self):
        sql = """
        select count(
            case when a = 'apple' then 1
            end
        ) as c from table1;
        """

        result = cll(sql)
        assert result["c"].type == "derived"
        assert result["c"].depends_on[0].node == "table1"
        assert result["c"].depends_on[0].column == "a"
        assert len(result["c"].depends_on) == 1

    def test_transform_binary(self):
        sql = """
        select (a+b) * (c+d) as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert len(result["x"].depends_on) == 4

    def test_transform_binary_predicate(self):
        sql = """
        select a > 0 as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "a"

    def test_transform_in(self):
        sql = """
        select a in (1, 2, 3) as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "a"

    def test_transform_type_cast(self):
        sql = """
        select cast(a as int) as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "a"

    def test_transform_type_cast_operator(self):
        sql = """
        select a::int as x from table1
        """
        result = cll(sql)
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "a"

    def test_transform_func(self):
        sql = """
        select date_trunc('month', created_at) as a from table1
        """
        result = cll(sql)
        assert result["a"].type == "derived"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "created_at"

    def test_transform_udf(self):
        sql = """
        select xyz(1, 2, created_at) as a from table1
        """
        result = cll(sql)
        assert result["a"].type == "derived"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "created_at"

    def test_transform_agg_func(self):
        sql = """
        select
            count() as b,
        from table1
        """
        result = cll(sql)
        assert result["b"].type == "source"
        assert len(result["b"].depends_on) == 0

        sql = """
        select
            count(*) as b,
        from table1
        """
        result = cll(sql)
        assert result["b"].type == "source"
        assert len(result["b"].depends_on) == 0

        sql = """
        select
            count(a) as b,
        from table1
        """
        result = cll(sql)
        assert result["b"].type == "derived"
        assert result["b"].depends_on[0].node == "table1"
        assert result["b"].depends_on[0].column == "a"

        sql = """
        select
            count(a) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert result["b"].type == "derived"
        assert result["b"].depends_on[0].node == "table1"
        assert result["b"].depends_on[0].column == "a"

        sql = """
            with cte as (
                select
                    date_trunc('month', created_at) as d,
                    count(*) as c
                from t1
                group by d
            )
            select
                d,
                sum(c) over (order by d) as c1
            from cte
            order by d
        """

        result = cll(sql)
        assert result["d"].type == "derived"
        assert result["d"].depends_on[0].node == "t1"
        assert result["d"].depends_on[0].column == "created_at"
        assert result["c1"].type == "source"
        assert len(result["c1"].depends_on) == 0

    def test_transform_nested_func(self):
        sql = """
        select
            count(xyz(a1 or a2, a1 or a3)) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert result["b"].type == "derived"
        assert result["b"].depends_on[0].node == "table1"
        assert result["b"].depends_on[0].column == "a1"

    def test_transform_udtf(self):
        sql = """
        select
            explode(a) as b,
        from table1
        """
        result = cll(sql)
        assert result["b"].type == "derived"
        assert result["b"].depends_on[0].node == "table1"
        assert result["b"].depends_on[0].column == "a"

    def test_join(self):
        sql = """
        select table1.a, table2.b
        from table1
        join table2 on table1.id = table2.id
        """
        result = cll(sql)
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["b"].type == "passthrough"
        assert result["b"].depends_on[0].node == "table2"

    def test_join_with_schema(self):
        sql = """
                select a, b
                from table1
                join table2 on table1.id = table2.id
                """
        result = cll(sql, {"table1": {"id": "Int", "a": "Int"}, "table2": {"id": "Int", "b": "Int"}})
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["b"].type == "passthrough"
        assert result["b"].depends_on[0].node == "table2"

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
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"

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
        assert result["id"].type == "passthrough"
        assert result["id"].depends_on[0].node == "table3"
        assert result["id"].depends_on[0].column == "id"
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["b"].type == "passthrough"
        assert result["b"].depends_on[0].node == "table2"
        assert result["b"].depends_on[0].column == "b"
        assert result["c"].type == "passthrough"
        assert result["c"].depends_on[0].node == "table3"
        assert result["c"].depends_on[0].column == "c"

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
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["b3"].type == "renamed"
        assert result["b3"].depends_on[0].node == "table1"
        assert result["b3"].depends_on[0].column == "b"
        assert result["y"].type == "derived"
        assert result["y"].depends_on[0].node == "table1"
        assert result["y"].depends_on[0].column == "a"
        assert result["y"].depends_on[1].node == "table1"
        assert result["y"].depends_on[1].column == "b"

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
        assert result["y"].type == "derived"
        assert result["y"].depends_on[0].node == "table1"
        assert result["y"].depends_on[0].column == "a"
        assert result["y"].depends_on[1].node == "table1"
        assert result["y"].depends_on[1].column == "b"

    def test_cte_with_transform3(self):
        sql = """
        with
        cte1 as (
            select
                a,
                b
            from table1
        ),
        cte2 as (
            select
                a,
                sum(b) as b1
            from cte1
            group by a
        )
        select * from cte2
        """

        result = cll(sql)
        assert result["a"].type == "passthrough"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["b1"].type == "derived"
        assert result["b1"].depends_on[0].node == "table1"
        assert result["b1"].depends_on[0].column == "b"

    def test_cte_with_transform4(self):
        sql = """
        with
        cte1 as (
            select
                id,
                count(distinct a) as x
            from table1
            group by 1
        ),
        cte2 as (
            select
                id,
                x
            from cte1
        )

        select * from cte2
        """

        result = cll(sql)
        assert result["id"].type == "passthrough"
        assert result["id"].depends_on[0].node == "table1"
        assert result["x"].type == "derived"
        assert result["x"].depends_on[0].node == "table1"
        assert result["x"].depends_on[0].column == "a"

    def test_union(self):
        sql = """
        select a, b from table1
        union
        select a, b from table2
        """
        result = cll(sql)
        assert result["a"].type == "derived"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["a"].depends_on[1].node == "table2"
        assert result["a"].depends_on[1].column == "a"
        assert result["b"].type == "derived"
        assert result["b"].depends_on[0].node == "table1"
        assert result["b"].depends_on[0].column == "b"
        assert result["b"].depends_on[1].node == "table2"
        assert result["b"].depends_on[1].column == "b"

    def test_union_cte(self):
        sql = """
        with cte1 as (
            select a from table1
            union
            select a from table2
        )
        select * from cte1
        """
        result = cll(sql)
        assert result["a"].type == "derived"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["a"].depends_on[1].node == "table2"
        assert result["a"].depends_on[1].column == "a"

    def test_union_all(self):
        sql = """
        select a from table1
        union all
        select a from table2
        """
        result = cll(sql)
        assert result["a"].type == "derived"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["a"].depends_on[1].node == "table2"
        assert result["a"].depends_on[1].column == "a"

    def test_intersect(self):
        sql = """
        select a from table1
        intersect
        select a from table2
        """
        result = cll(sql)
        assert result["a"].type == "derived"
        assert result["a"].depends_on[0].node == "table1"
        assert result["a"].depends_on[0].column == "a"
        assert result["a"].depends_on[1].node == "table2"
        assert result["a"].depends_on[1].column == "a"

    def test_where(self):
        from recce.util.cll import cll as cll_new

        sql = """
        select a, b
        from table1
        where a > 0
        """
        result = cll_new(sql)
        result.depends_on[0] == "table1"
