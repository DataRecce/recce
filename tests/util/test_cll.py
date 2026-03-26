import unittest
from typing import List, Tuple

import pytest

from recce.exceptions import RecceException
from recce.util.cll import CllResult, cll, get_cll_cache


def assert_model(result: CllResult, depends_on: List[Tuple[str, str]]):
    m2c, _ = result
    assert len(m2c) == len(depends_on), "depends_on length mismatch"
    for i in range(len(depends_on)):
        node, column = depends_on[i]
        anode = m2c[i].node
        acolumn = m2c[i].column

        assert (
            anode == node and acolumn == column
        ), f"depends_on mismatch at index {i}: expected ({node}, {column}), got ({anode}, {acolumn})"


def assert_column(result: CllResult, column_name: str, transformation_type, depends_on: List[Tuple[str, str]]):
    _, c2c_map = result
    entry = c2c_map.get(column_name)
    assert entry is not None, f"Column {column_name} not found in result"
    assert (
        entry.transformation_type == transformation_type
    ), f"Column {column_name} type mismatch: expected {transformation_type}, got {entry.transformation_type}"
    assert len(entry.depends_on) == len(depends_on), "depends_on length mismatch"
    for i in range(len(depends_on)):
        node, column = depends_on[i]
        anode = entry.depends_on[i].node
        acolumn = entry.depends_on[i].column

        assert (
            anode == node and acolumn == column
        ), f"depends_on mismatch at index {i}: expected ({node}, {column}), got ({anode}, {acolumn})"


class ColumnLevelLineageTest(unittest.TestCase):
    def test_sql(self):
        sql = """
        select a,b from table1
        """
        result = cll(sql)
        assert_model(result, [])
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b", "passthrough", [("table1", "b")])

        sql = """
        select c from table1 where c > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "c")])
        assert_column(result, "c", "passthrough", [("table1", "c")])

    def test_sql_with_canonial(self):
        sql = """
        select table1.a from schema1.table1
        """
        result = cll(sql)
        assert_model(result, [])
        assert_column(result, "a", "passthrough", [("table1", "a")])

        sql = """
        select table1.a from db1.schema1.table1 where dbt.schema1.table1.a > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])
        assert_column(result, "a", "passthrough", [("table1", "a")])

    def test_select_star(self):
        sql = """
        select * from table1
        """
        result = cll(sql, {"table1": {"a": "int", "b": "int"}})
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b", "passthrough", [("table1", "b")])

    def test_source_literal(self):
        # numeric literal
        sql = """
        select 1
        """
        result = cll(sql)
        assert_column(result, "1", "source", [])

        # string literal
        sql = """
        select 'abc' as c
        """
        result = cll(sql)
        assert_column(result, "c", "source", [])

        # timestamp literal
        sql = """
        select timestamp '2021-01-01 00:00:00' as c
        """
        result = cll(sql)
        assert_column(result, "c", "source", [])

        # condition from source literal
        sql = """
        select 1 as a from table1 where a > 0
        """
        result = cll(sql)
        assert_column(result, "a", "source", [])

    def test_source_generative_function(self):
        # numeric literal
        sql = """
        select CURRENT_TIMESTAMP() as c from table1
        """
        result = cll(sql)
        assert_column(result, "c", "source", [])

        # uuid
        sql = """
        select UUID() as c from table1
        """
        result = cll(sql)
        assert_column(result, "c", "source", [])

    def test_alias(self):
        sql = """
        select a as c from table1
        """
        result = cll(sql)
        assert_column(result, "c", "renamed", [("table1", "a")])

    def test_alias_table(self):
        sql = """
        select a as c from table1 as table2
        """
        result = cll(sql)
        assert_column(result, "c", "renamed", [("table1", "a")])

        sql = """
        select T1.a, T2.b
        from table1 as T1
        join table2 as T2 on T1.id = T2.id
        """
        result = cll(sql)
        assert_model(result, [("table1", "id"), ("table2", "id")])
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b", "passthrough", [("table2", "b")])

        sql = """
        with cte as (
            select a as c from table1 as table2
        )
        select * from cte as final
        """
        result = cll(sql)
        assert_column(result, "c", "renamed", [("table1", "a")])

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
        assert_column(result, "c", "renamed", [("t1", "a")])
        assert_column(result, "b", "passthrough", [("t3", "b")])

    def test_forward_ref(self):
        sql = """
        select
            a as b,
            b as c
        from table1
        """
        result = cll(sql)
        assert_column(result, "b", "renamed", [("table1", "a")])
        assert_column(result, "c", "renamed", [("table1", "a")])

    def test_transform_case_when(self):
        sql = """
        select case
            when a > 0 then 'a'
            when a > 10 then 'b'
            else 'c'
        end as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "a")])

        sql = """
        select case
            when payment_method = 'gift_card' then amount
            else 0
        end as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "payment_method"), ("table1", "amount")])

    def test_transform_case_when_no_default(self):
        sql = """
        select count(
            case when a = 'apple' then 1
            end
        ) as c from table1;
        """

        result = cll(sql)
        assert_column(result, "c", "derived", [("table1", "a")])

    def test_transform_binary(self):
        sql = """
        select (a+b) * (c+d) as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "a"), ("table1", "b"), ("table1", "c"), ("table1", "d")])

    def test_transform_binary_predicate(self):
        sql = """
        select a > 0 as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "a")])

    def test_transform_in(self):
        sql = """
        select a in (1, 2, 3) as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "a")])

    def test_transform_type_cast(self):
        sql = """
        select cast(a as int) as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "a")])

    def test_transform_type_cast_operator(self):
        sql = """
        select a::int as x from table1
        """
        result = cll(sql)
        assert_column(result, "x", "derived", [("table1", "a")])

    def test_transform_func(self):
        sql = """
        select date_trunc('month', created_at) as a from table1
        """
        result = cll(sql)
        assert_column(result, "a", "derived", [("table1", "created_at")])

    def test_transform_udf(self):
        sql = """
        select xyz(1, 2, created_at) as a from table1
        """
        result = cll(sql)
        assert_column(result, "a", "derived", [("table1", "created_at")])

    def test_transform_agg_func(self):
        sql = """
        select
            count() as b,
        from table1
        """
        result = cll(sql)
        assert_column(result, "b", "source", [])

        sql = """
        select
            count(*) as b,
        from table1
        """
        result = cll(sql)
        assert_column(result, "b", "source", [])

        sql = """
        select
            count(a) as b,
        from table1
        """
        result = cll(sql)
        assert_column(result, "b", "derived", [("table1", "a")])

        sql = """
        select
            count(a) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert_column(result, "b", "derived", [("table1", "a")])

    def test_transform_agg_func_source(self):
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
        assert_column(result, "d", "derived", [("t1", "created_at")])
        assert_column(result, "c1", "derived", [("t1", "created_at")])

    def test_transform_nested_func(self):
        sql = """
        select
            count(xyz(a1 or a2, a1 or a3)) as b,
        from table1
        group by c
        """
        result = cll(sql)
        assert_column(result, "b", "derived", [("table1", "a1"), ("table1", "a2"), ("table1", "a3")])

    def test_transform_udtf(self):
        sql = """
        select
            explode(a) as b,
        from table1
        """
        result = cll(sql)
        assert_column(result, "b", "derived", [("table1", "a")])

    def test_join(self):
        sql = """
        select table1.a, table2.b
        from table1
        join table2 on table1.id = table2.id
        """
        result = cll(sql)
        assert_model(result, [("table1", "id"), ("table2", "id")])
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b", "passthrough", [("table2", "b")])

    def test_join_with_schema(self):
        sql = """
                select a, b
                from table1
                join table2 on table1.id = table2.id
                """
        result = cll(sql, {"table1": {"id": "Int", "a": "Int"}, "table2": {"id": "Int", "b": "Int"}})
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b", "passthrough", [("table2", "b")])

    def test_cte(self):
        sql = """
        with
        cte1 as (
            select a from table1
        ),
        cte2 as (
            select a from cte1
        )
        select * from cte2 where a > 0
        """

        result = cll(sql)
        assert_model(result, [("table1", "a")])
        assert_column(result, "a", "passthrough", [("table1", "a")])

    def test_cte_with_join(self):
        sql = """
        with
        cte1 as (
            select id, a from table1 where d > 0
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
        assert_model(result, [("table3", "id"), ("table1", "id"), ("table2", "id"), ("table1", "d")])
        assert_column(result, "id", "passthrough", [("table3", "id")])
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b", "passthrough", [("table2", "b")])
        assert_column(result, "c", "passthrough", [("table3", "c")])

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
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b3", "renamed", [("table1", "b")])
        assert_column(result, "y", "derived", [("table1", "a"), ("table1", "b")])

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
        assert_column(result, "y", "derived", [("table1", "a"), ("table1", "b")])

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
        assert_column(result, "a", "passthrough", [("table1", "a")])
        assert_column(result, "b1", "derived", [("table1", "b")])

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
        assert_column(result, "id", "passthrough", [("table1", "id")])
        assert_column(result, "x", "derived", [("table1", "a")])

    def test_union(self):
        sql = """
        select a, b from table1 where c > 0
        union
        select a, b from table2
        """
        result = cll(sql)
        assert_model(result, [("table1", "c")])
        assert_column(result, "a", "derived", [("table1", "a"), ("table2", "a")])
        assert_column(result, "b", "derived", [("table1", "b"), ("table2", "b")])

    def test_union_cte(self):
        sql = """
        with cte1 as (
            select a from table1 where c > 0
            union
            select a from table2
        )
        select * from cte1
        """
        result = cll(sql)
        assert_model(result, [("table1", "c")])
        assert_column(result, "a", "derived", [("table1", "a"), ("table2", "a")])

    def test_union_all(self):
        sql = """
        select a from table1 where c > 0
        union all
        select a from table2
        """
        result = cll(sql)
        assert_model(result, [("table1", "c")])
        assert_column(result, "a", "derived", [("table1", "a"), ("table2", "a")])

    def test_intersect(self):
        sql = """
        select a from table1 where c > 0
        intersect
        select a from table2
        """
        result = cll(sql)
        assert_model(result, [("table1", "c")])
        assert_column(result, "a", "derived", [("table1", "a"), ("table2", "a")])

    def test_where(self):
        sql = """
        select a, b
        from table1
        where a > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])

        sql = """
        select a, b
        from table1
        where a + b > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

        sql = """
        select a, b
        from table1
        where a > 0 and b > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

        sql = """
        with cte as (
            select a, b
            from table1
            where a > 0 and b > 0
        )
        select * from cte
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

    def test_group_by(self):
        sql = """
        select a, sum(b) as b
        from table1
        group by a
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])

        sql = """
        select a as a2, sum(b) as b
        from table1
        group by a2
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])

        sql = """
        select a, sum(b) as b
        from table1
        group by 1
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])

        sql = """
        with CTE as (
            select a, sum(b) as b
            from table1
            group by a
        )
        select * from CTE
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])

    def test_having(self):
        sql = """
        select a, sum(b) as b
        from table1
        group by a
        having sum(b) > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

        sql = """
        with CTE as (
            select a, sum(b) as b
            from table1
            group by a
            having sum(b) > 0
        )
        select * from CTE
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

    def test_having_by_selected_column(self):
        sql = """
        select a, sum(b) as c
        from table1
        group by a
        having c > 0
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

        sql = """
        with CTE as (
            select a, sum(b) as c
            from table1
            group by a
            having c > 0
        )
        select * from CTE
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b")])

    def test_order_by(self):
        sql = """
        select a, b
        from table1
        order by a, b, c desc
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b"), ("table1", "c")])

        sql = """
        select a, b
        from table1
        order by 1, 2, c desc
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "b"), ("table1", "c")])

        sql = """
        select a, b
        from table1
        order by c+d, func(e), 1 desc
        """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "c"), ("table1", "d"), ("table1", "e")])

        sql = """
        with CTE as (
            select a, b
            from table1
            order by a desc
        )
        select * from CTE
        """
        result = cll(sql)
        assert_model(result, [("table1", "a")])

    def test_subquery(self):
        sql = """
        select * from (
            select a from table1 where b > 100
        ) as t
        """
        result = cll(sql)
        assert_model(result, [("table1", "b")])
        assert_column(result, "a", "passthrough", [("table1", "a")])

    def test_recursive_cte(self):
        sql = """
        with recursive category_tree as (
            select
                category_id,
                category_name,
                parent_category_id,
                category_name as root_category,
                category_name as full_path,
                0 as depth
            from stg_categories
            where parent_category_id is null

            union all

            select
                c.category_id,
                c.category_name,
                c.parent_category_id,
                ct.root_category,
                ct.full_path || ' > ' || c.category_name as full_path,
                ct.depth + 1 as depth
            from stg_categories c
            inner join category_tree ct on c.parent_category_id = ct.category_id
        )
        select * from category_tree
        """
        schema = {
            "stg_categories": {
                "category_id": "int",
                "category_name": "varchar",
                "parent_category_id": "int",
            }
        }
        result = cll(sql, schema=schema)
        # All columns should trace back to stg_categories, not to the CTE alias.
        # UNION ALL marks columns as "derived" when they have deps in both branches.
        # Exception: depth has no column deps (literal 0), so stays "source".
        assert_column(result, "category_id", "derived", [("stg_categories", "category_id")])
        assert_column(result, "category_name", "derived", [("stg_categories", "category_name")])
        assert_column(result, "parent_category_id", "derived", [("stg_categories", "parent_category_id")])
        assert_column(result, "root_category", "derived", [("stg_categories", "category_name")])
        assert_column(result, "full_path", "derived", [("stg_categories", "category_name")])
        # depth: base case is `0` (source literal), recursive case is `ct.depth + 1`
        # which resolves through the base case to no upstream deps.
        # _cll_set_scope keeps "source" when no column deps exist.
        assert_column(result, "depth", "source", [])

    def test_recursive_cte_m2c_propagation(self):
        """Model-to-column deps from the base case's WHERE clause should propagate
        through the recursive branch to the outer query."""
        sql = """
        with recursive nums as (
            select id, val from t1 where active = true
            union all
            select n.id, n.val from t1 n inner join nums on n.parent_id = nums.id
        )
        select * from nums
        """
        schema = {
            "t1": {"id": "int", "val": "int", "active": "bool", "parent_id": "int"},
        }
        result = cll(sql, schema=schema)
        m2c, _ = result
        m2c_set = {(d.node, d.column) for d in m2c}
        # The base case WHERE active = true should appear in model deps
        assert ("t1", "active") in m2c_set
        # The join condition parent_id = nums.id should appear
        assert ("t1", "parent_id") in m2c_set

    def test_unresolvable_column_does_not_crash_entire_model(self):
        """When one column can't be resolved (e.g. correlated scalar subquery),
        only that column should degrade — other columns should still trace correctly."""
        sql = """
        select
            id,
            name,
            (select count(*) from t2 where t2.fk = t1.id) as child_count
        from t1
        """
        result = cll(sql, schema={"t1": {"id": "int", "name": "varchar"}, "t2": {"fk": "int"}})
        # Resolvable columns still trace correctly
        assert_column(result, "id", "passthrough", [("t1", "id")])
        assert_column(result, "name", "passthrough", [("t1", "name")])
        # child_count resolves correctly — correlated subquery doesn't crash the model
        assert_column(result, "child_count", "derived", [("t2", "fk"), ("t1", "id")])

    def test_where_in_subquery(self):
        sql = """
        select a from table1 where user_id in (
            select user_id from table2 where status is not null
        )
        """
        result = cll(sql)
        assert_model(result, [("table1", "user_id"), ("table2", "status"), ("table2", "user_id")])

        sql = """
            select a from table1 group by a having user_id in (
                select user_id from table2
            )
            """
        result = cll(sql)
        assert_model(result, [("table1", "a"), ("table1", "user_id"), ("table2", "user_id")])


class CllCacheTest(unittest.TestCase):
    def setUp(self):
        import os

        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        # Re-init cache without disk for tests
        from recce.util import cll as cll_module

        cll_module._cll_cache = cll_module.CllCache()

    def tearDown(self):
        import os

        os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        from recce.util import cll as cll_module

        cll_module._cll_cache = cll_module._init_cll_cache()

    def test_cache_hit_same_sql(self):
        """Same SQL should be served from cache on second call."""
        sql = "select a, b from table1"
        result1 = cll(sql)
        result2 = cll(sql)

        stats = get_cll_cache().stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["size"] == 1

        # Results should be equal but independent (deep copied)
        assert_column(result1, "a", "passthrough", [("table1", "a")])
        assert_column(result2, "a", "passthrough", [("table1", "a")])

    def test_cache_miss_different_sql(self):
        """Different SQL should not hit cache."""
        cll("select a from table1")
        cll("select b from table2")

        stats = get_cll_cache().stats
        assert stats["hits"] == 0
        assert stats["misses"] == 2
        assert stats["size"] == 2

    def test_cache_hit_different_schema(self):
        """Same SQL with different schema should hit cache (key is sql+dialect only)."""
        sql = "select a from table1"
        cll(sql, schema={"table1": {"a": "INT"}})
        cll(sql, schema={"table1": {"a": "VARCHAR"}})

        stats = get_cll_cache().stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1

    def test_cache_miss_different_dialect(self):
        """Same SQL but different dialect should not hit cache."""
        sql = "select a from table1"
        cll(sql, dialect="duckdb")
        cll(sql, dialect="snowflake")

        stats = get_cll_cache().stats
        assert stats["hits"] == 0
        assert stats["misses"] == 2

    def test_cache_clear(self):
        """Clearing cache should reset everything."""
        cll("select a from table1")
        assert get_cll_cache().stats["size"] == 1

        get_cll_cache().clear()
        assert get_cll_cache().stats["size"] == 0
        assert get_cll_cache().stats["hits"] == 0
        assert get_cll_cache().stats["misses"] == 0

    def test_cached_result_is_independent_copy(self):
        """Mutating a cached result should not affect future cache hits."""
        sql = "select a, b from table1"
        result1 = cll(sql)
        # Mutate result1
        m2c1, c2c1 = result1
        c2c1["a"].transformation_type = "MUTATED"

        result2 = cll(sql)
        _, c2c2 = result2
        assert c2c2["a"].transformation_type == "passthrough"

    def test_error_caching(self):
        """Failed CLL should be cached so the same SQL doesn't retry."""
        bad_sql = "THIS IS NOT SQL"

        with pytest.raises(RecceException):
            cll(bad_sql)

        stats1 = get_cll_cache().stats
        assert stats1["misses"] == 1
        assert stats1["hits"] == 0

        # Second call should hit cache (re-raise cached error)
        with pytest.raises(RecceException):
            cll(bad_sql)

        stats2 = get_cll_cache().stats
        assert stats2["hits"] == 1
        assert stats2["misses"] == 1

    def test_disk_persistence(self):
        """Cache should survive across CllCache instances when using disk."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            # First instance: compute and store
            cache1 = CllCache(cache_dir=tmpdir)
            sql = "select a, b from table1"
            result = cll(sql)
            cache1.put(sql, None, result)
            assert cache1.stats["size"] == 1

            # Second instance: should load from disk
            cache2 = CllCache(cache_dir=tmpdir)
            loaded = cache2.get(sql, None)
            assert loaded is not CllCache._SENTINEL
            m2c, c2c = loaded
            assert "a" in c2c
            assert c2c["a"].transformation_type == "passthrough"
            assert cache2.stats["hits"] == 1

    def test_disk_persistence_errors(self):
        """Cached errors should also persist to disk."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            cache1 = CllCache(cache_dir=tmpdir)
            cache1.put_error("BAD SQL", None, RecceException("fail"))

            cache2 = CllCache(cache_dir=tmpdir)
            with pytest.raises(RecceException, match="cached"):
                cache2.get("BAD SQL", None)
