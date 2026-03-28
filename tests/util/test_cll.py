import os
import unittest
from typing import Dict, List, Optional, Tuple

import pytest

from recce.exceptions import RecceException
from recce.models.types import CllColumn, CllColumnDep
from recce.util.cll import CllCache, CllResult, _normalize_sql_for_cache, cll, get_cll_cache


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

    def test_cache_hit_ignores_db_schema(self):
        """SQL differing only in db/schema qualifiers should share a cache entry."""
        sql_bare = "select a from table1 where table1.b > 0"
        sql_qualified = "select a from db1.schema1.table1 where db1.schema1.table1.b > 0"

        result1 = cll(sql_bare)
        result2 = cll(sql_qualified)

        stats = get_cll_cache().stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1

        # Both results should be correct
        assert_column(result1, "a", "passthrough", [("table1", "a")])
        assert_column(result2, "a", "passthrough", [("table1", "a")])

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
        """Cache should survive across CllCache instances when using SQLite."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")

            # First instance: compute and store
            cache1 = CllCache(db_path=db_path)
            sql = "select a, b from table1"
            result = cll(sql)
            cache1.put(sql, None, result)
            assert cache1.stats["size"] == 1

            # Second instance: should load from SQLite
            cache2 = CllCache(db_path=db_path)
            loaded = cache2.get(sql, None)
            assert loaded is not CllCache._SENTINEL
            m2c, c2c = loaded
            assert "a" in c2c
            assert c2c["a"].transformation_type == "passthrough"
            assert cache2.stats["hits"] == 1

    def test_disk_persistence_errors(self):
        """Cached errors should also persist to SQLite."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")

            cache1 = CllCache(db_path=db_path)
            cache1.put_error("BAD SQL", None, RecceException("fail"))

            cache2 = CllCache(db_path=db_path)
            with pytest.raises(RecceException, match="cached"):
                cache2.get("BAD SQL", None)


class CllCacheFeatureTest(unittest.TestCase):
    """Tests for TTL eviction, auto-populate, and cache versioning."""

    def test_ttl_eviction(self):
        """Entries older than TTL should be evicted."""
        import tempfile
        import time as _time

        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path, ttl_seconds=5)

            # Insert an entry with last_accessed in the past (10s ago)
            sql = "select a from table1"
            result = cll(sql)
            cache.put(sql, None, result)

            # Manually backdate last_accessed
            import sqlite3

            conn = sqlite3.connect(db_path)
            conn.execute("UPDATE cll_cache SET last_accessed = ?", (_time.time() - 10,))
            conn.commit()
            conn.close()

            # Evict — should remove the entry
            deleted = cache.evict_stale()
            assert deleted == 1

            # Verify it's gone from SQLite
            cache2 = CllCache(db_path=db_path, ttl_seconds=5)
            loaded = cache2.get(sql, None)
            assert loaded is CllCache._SENTINEL

    def test_ttl_keeps_recent_entries(self):
        """Entries accessed recently should survive eviction."""
        import tempfile

        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path, ttl_seconds=3600)

            sql = "select a from table1"
            result = cll(sql)
            cache.put(sql, None, result)

            deleted = cache.evict_stale()
            assert deleted == 0

            # Entry should still be accessible
            cache2 = CllCache(db_path=db_path, ttl_seconds=3600)
            loaded = cache2.get(sql, None)
            assert loaded is not CllCache._SENTINEL

    def test_last_accessed_updated_on_get(self):
        """Reading an entry should update its last_accessed timestamp."""
        import tempfile
        import time as _time

        import sqlite3 as _sqlite3

        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            sql = "select a from table1"
            result = cll(sql)
            key = CllCache._make_key(sql, None)
            cache.put(sql, None, result)

            # Backdate to 1 hour ago
            conn = _sqlite3.connect(db_path)
            old_time = _time.time() - 3600
            conn.execute("UPDATE cll_cache SET last_accessed = ?", (old_time,))
            conn.commit()
            conn.close()

            # Read via a new cache instance (forces SQLite read)
            cache2 = CllCache(db_path=db_path)
            cache2.get(sql, None)

            # Verify last_accessed was updated to ~now
            conn = _sqlite3.connect(db_path)
            row = conn.execute("SELECT last_accessed FROM cll_cache WHERE key = ?", (key,)).fetchone()
            conn.close()
            assert row[0] > old_time + 3000  # should be much more recent

    def test_version_mismatch_still_hits(self):
        """Entry written by a different sqlglot version should still hit.

        sqlglot version should not affect CLL results for the same SQL —
        the version column is stored for diagnostics only, not for invalidation.
        """
        import tempfile

        import sqlite3 as _sqlite3

        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            sql = "select a from table1"
            result = cll(sql)
            cache.put(sql, None, result)

            # Tamper: change the stored version to a fake one
            key = CllCache._make_key(sql, None)
            conn = _sqlite3.connect(db_path)
            conn.execute("UPDATE cll_cache SET sqlglot_version = 'old.0.0' WHERE key = ?", (key,))
            conn.commit()
            conn.close()

            # New cache instance should still hit (version is diagnostic only)
            cache2 = CllCache(db_path=db_path)
            loaded = cache2.get(sql, None)
            assert loaded is not CllCache._SENTINEL
            assert cache2.stats["hits"] == 1

    def test_version_match_is_cache_hit(self):
        """Entry with matching sqlglot version should hit normally."""
        import tempfile

        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            sql = "select a from table1"
            result = cll(sql)
            cache.put(sql, None, result)

            # New instance with same sqlglot version — should hit
            cache2 = CllCache(db_path=db_path)
            loaded = cache2.get(sql, None)
            assert loaded is not CllCache._SENTINEL
            assert cache2.stats["hits"] == 1

    def test_cache_off_by_default(self):
        """Cache should be off by default (experimental mode)."""
        from recce.util.cll import _is_content_cache_enabled

        old_env = os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        try:
            assert _is_content_cache_enabled() is False
        finally:
            if old_env is not None:
                os.environ["ENABLE_CLL_CONTENT_CACHE"] = old_env

    def test_enable_cache_env_var(self):
        """ENABLE_CLL_CONTENT_CACHE=1 should turn on caching."""
        from recce.util.cll import _is_content_cache_enabled

        old_env = os.environ.get("ENABLE_CLL_CONTENT_CACHE")
        try:
            os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
            assert _is_content_cache_enabled() is True
        finally:
            if old_env is not None:
                os.environ["ENABLE_CLL_CONTENT_CACHE"] = old_env
            else:
                os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)

    def test_schema_migration_adds_columns(self):
        """Opening an old-format DB should auto-add new columns."""
        import tempfile

        import sqlite3 as _sqlite3

        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")

            # Create an old-format table (no sqlglot_version, no last_accessed)
            sql = "select a from table1"
            key = CllCache._make_key(sql, None)
            value = '{"m2c":[], "c2c":{"a":{"name":"a","transformation_type":"passthrough","depends_on":[{"node":"table1","column":"a"}]}}}'

            conn = _sqlite3.connect(db_path)
            conn.execute("CREATE TABLE cll_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            conn.execute("INSERT INTO cll_cache (key, value) VALUES (?, ?)", (key, value))
            conn.commit()
            conn.close()

            # Opening with CllCache should migrate
            cache = CllCache(db_path=db_path)

            # Verify columns were added
            conn = _sqlite3.connect(db_path)
            columns = {row[1] for row in conn.execute("PRAGMA table_info(cll_cache)").fetchall()}
            conn.close()
            assert "sqlglot_version" in columns
            assert "last_accessed" in columns

            # Old entry with empty version should still be readable (backwards compat)
            loaded = cache.get(sql, None)
            assert loaded is not CllCache._SENTINEL


def _assert_cll_results_equal(result_a: CllResult, result_b: CllResult, msg: str = ""):
    """Assert two CllResult tuples are semantically identical."""
    m2c_a, c2c_a = result_a
    m2c_b, c2c_b = result_b

    prefix = f"[{msg}] " if msg else ""

    # Compare m2c (model-to-column deps)
    assert len(m2c_a) == len(m2c_b), f"{prefix}m2c length mismatch: {len(m2c_a)} vs {len(m2c_b)}"
    for i, (a, b) in enumerate(zip(m2c_a, m2c_b)):
        assert a.node == b.node and a.column == b.column, (
            f"{prefix}m2c[{i}] mismatch: ({a.node}, {a.column}) vs ({b.node}, {b.column})"
        )

    # Compare c2c (column-to-column deps)
    assert set(c2c_a.keys()) == set(c2c_b.keys()), (
        f"{prefix}c2c keys differ: {set(c2c_a.keys())} vs {set(c2c_b.keys())}"
    )
    for col_name in c2c_a:
        col_a = c2c_a[col_name]
        col_b = c2c_b[col_name]
        assert col_a.transformation_type == col_b.transformation_type, (
            f"{prefix}c2c[{col_name}].transformation_type: {col_a.transformation_type} vs {col_b.transformation_type}"
        )
        assert len(col_a.depends_on) == len(col_b.depends_on), (
            f"{prefix}c2c[{col_name}].depends_on length: {len(col_a.depends_on)} vs {len(col_b.depends_on)}"
        )
        for j, (da, db) in enumerate(zip(col_a.depends_on, col_b.depends_on)):
            assert da.node == db.node and da.column == db.column, (
                f"{prefix}c2c[{col_name}].depends_on[{j}]: ({da.node}, {da.column}) vs ({db.node}, {db.column})"
            )


class CllCacheCorrectnessTest(unittest.TestCase):
    """Verify that CLL cache produces identical output with and without caching.

    For every test case:
      1. Compute CLL with cache disabled (ground truth).
      2. Compute CLL with cache enabled — first call is a miss.
      3. Compute CLL with cache enabled — second call is a hit.
      4. Assert all three results are identical.
    """

    def _cll_with_and_without_cache(
        self,
        sql: str,
        schema: Optional[dict] = None,
        dialect: Optional[str] = None,
        label: str = "",
    ) -> CllResult:
        """Run cll() without cache, then twice with cache, assert all equal."""
        from recce.util import cll as cll_module

        # 1. Without cache
        os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        cll_module._cll_cache = CllCache()
        result_nocache = cll(sql, schema=schema, dialect=dialect)

        # 2. With cache — miss
        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()
        result_miss = cll(sql, schema=schema, dialect=dialect)
        stats_after_miss = get_cll_cache().stats
        assert stats_after_miss["misses"] == 1, f"[{label}] expected 1 miss"
        assert stats_after_miss["hits"] == 0, f"[{label}] expected 0 hits after miss"

        # 3. With cache — hit
        result_hit = cll(sql, schema=schema, dialect=dialect)
        stats_after_hit = get_cll_cache().stats
        assert stats_after_hit["hits"] == 1, f"[{label}] expected 1 hit"

        # Assert all three are identical
        _assert_cll_results_equal(result_nocache, result_miss, f"{label} nocache vs miss")
        _assert_cll_results_equal(result_nocache, result_hit, f"{label} nocache vs hit")

        return result_nocache

    def setUp(self):
        self._orig_env = os.environ.get("ENABLE_CLL_CONTENT_CACHE")

    def tearDown(self):
        from recce.util import cll as cll_module

        if self._orig_env is not None:
            os.environ["ENABLE_CLL_CONTENT_CACHE"] = self._orig_env
        else:
            os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        cll_module._cll_cache = cll_module._init_cll_cache()

    # ----------------------------------------------------------------
    # Category 1: Basic correctness — same SQL, cached vs uncached
    # ----------------------------------------------------------------

    def test_simple_select(self):
        self._cll_with_and_without_cache(
            "select a, b from table1",
            label="simple_select",
        )

    def test_select_with_where(self):
        self._cll_with_and_without_cache(
            "select a, b from table1 where a > 0 and b < 100",
            label="select_with_where",
        )

    def test_select_with_schema(self):
        self._cll_with_and_without_cache(
            "select * from table1",
            schema={"table1": {"a": "int", "b": "varchar"}},
            label="select_star_with_schema",
        )

    def test_select_with_alias(self):
        self._cll_with_and_without_cache(
            "select a as x, b as y from table1",
            label="alias",
        )

    def test_derived_columns(self):
        self._cll_with_and_without_cache(
            "select a + b as total, cast(c as int) as c_int from table1",
            label="derived",
        )

    def test_join(self):
        self._cll_with_and_without_cache(
            "select t1.a, t2.b from table1 t1 join table2 t2 on t1.id = t2.id",
            label="join",
        )

    def test_group_by_having(self):
        self._cll_with_and_without_cache(
            "select a, sum(b) as total from table1 group by a having sum(b) > 10",
            label="group_by_having",
        )

    def test_order_by(self):
        self._cll_with_and_without_cache(
            "select a, b from table1 order by a desc, c",
            label="order_by",
        )

    # ----------------------------------------------------------------
    # Category 2: Normalization safety — db/schema qualifiers stripped
    # ----------------------------------------------------------------

    def test_normalization_bare_vs_qualified(self):
        """SQL differing only in db/schema qualifiers should produce identical CLL."""
        from recce.util import cll as cll_module

        sql_bare = "select a from table1 where b > 0"
        sql_qualified = "select a from mydb.myschema.table1 where mydb.myschema.table1.b > 0"

        # Compute ground truth without cache
        os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        cll_module._cll_cache = CllCache()
        result_bare = cll(sql_bare)
        result_qualified = cll(sql_qualified)

        _assert_cll_results_equal(result_bare, result_qualified, "bare vs fully-qualified")

    def test_normalization_different_schemas_same_table(self):
        """Tables that differ only in schema prefix should produce same CLL."""
        from recce.util import cll as cll_module

        sql_a = "select x from schema_a.orders"
        sql_b = "select x from schema_b.orders"

        os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        cll_module._cll_cache = CllCache()
        result_a = cll(sql_a)
        result_b = cll(sql_b)

        _assert_cll_results_equal(result_a, result_b, "schema_a vs schema_b")

    def test_normalization_cache_sharing(self):
        """After caching sql with schema prefix, same SQL with different schema should hit cache.

        Note: normalization strips db/catalog from Table and Column nodes, but
        preserves table-qualified column refs (e.g., t1.c stays as t1.c).
        So both SQL variants must use the same column reference style to share cache.
        """
        from recce.util import cll as cll_module

        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()

        # Both use table-qualified column refs — only db/schema differs
        sql_schema_a = "select a, b from dev.public.t1 where dev.public.t1.c > 0"
        sql_schema_b = "select a, b from prod.analytics.t1 where prod.analytics.t1.c > 0"

        result_a = cll(sql_schema_a)
        result_b = cll(sql_schema_b)

        stats = get_cll_cache().stats
        assert stats["misses"] == 1, "second SQL should share cache after normalization"
        assert stats["hits"] == 1, "second SQL should be a cache hit"

        _assert_cll_results_equal(result_a, result_b, "normalization sharing")

    def test_normalization_column_in_where_clause(self):
        """Qualified column references in WHERE should normalize identically."""
        from recce.util import cll as cll_module

        sql_bare = "select a from t1 where t1.b = 1"
        sql_qualified = "select a from db.schema.t1 where db.schema.t1.b = 1"

        os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        cll_module._cll_cache = CllCache()
        result_bare = cll(sql_bare)
        result_qualified = cll(sql_qualified)

        _assert_cll_results_equal(result_bare, result_qualified, "where clause normalization")

    # ----------------------------------------------------------------
    # Category 3: Normalization edge cases
    # ----------------------------------------------------------------

    def test_normalization_preserves_table_name_distinction(self):
        """Different table names must NOT normalize to the same cache key."""
        from recce.util import cll as cll_module

        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()

        result_orders = cll("select a from orders")
        result_customers = cll("select a from customers")

        stats = get_cll_cache().stats
        assert stats["misses"] == 2, "different tables must be separate cache entries"
        assert stats["hits"] == 0

    def test_normalization_function_preserves_table_names(self):
        """_normalize_sql_for_cache strips db/schema but keeps table name."""
        from sqlglot import parse_one as p

        expr = p("select a from mydb.myschema.orders where mydb.myschema.orders.b > 0")
        normalized = _normalize_sql_for_cache(expr)
        # Should reference 'orders' not 'mydb.myschema.orders'
        assert "mydb" not in normalized
        assert "myschema" not in normalized
        assert "orders" in normalized

    def test_normalization_does_not_mutate_original(self):
        """_normalize_sql_for_cache should operate on a copy."""
        from sqlglot import parse_one as p

        expr = p("select a from mydb.myschema.table1")
        original_sql = expr.sql()
        _normalize_sql_for_cache(expr)
        assert expr.sql() == original_sql, "Original AST should be unchanged"

    # ----------------------------------------------------------------
    # Category 4: Dialect handling
    # ----------------------------------------------------------------

    def test_dialect_duckdb(self):
        self._cll_with_and_without_cache(
            'select a, b from "table1" where a > 0',
            dialect="duckdb",
            label="duckdb",
        )

    def test_dialect_snowflake(self):
        self._cll_with_and_without_cache(
            "select a, b from table1 where a > 0",
            dialect="snowflake",
            label="snowflake",
        )

    def test_dialect_bigquery(self):
        self._cll_with_and_without_cache(
            "select a, b from `project.dataset.table1` where a > 0",
            dialect="bigquery",
            label="bigquery",
        )

    def test_dialect_postgres(self):
        self._cll_with_and_without_cache(
            'select a, b from "table1" where a::int > 0',
            dialect="postgres",
            label="postgres",
        )

    def test_dialect_redshift(self):
        self._cll_with_and_without_cache(
            "select a, b from table1 where a > 0",
            dialect="redshift",
            label="redshift",
        )

    def test_different_dialects_do_not_share_cache(self):
        """Same SQL under different dialects must be separate cache entries."""
        from recce.util import cll as cll_module

        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()

        sql = "select a from table1"
        cll(sql, dialect="duckdb")
        cll(sql, dialect="snowflake")

        stats = get_cll_cache().stats
        assert stats["misses"] == 2
        assert stats["hits"] == 0

    # ----------------------------------------------------------------
    # Category 5: Complex SQL patterns
    # ----------------------------------------------------------------

    def test_cte_chain(self):
        self._cll_with_and_without_cache(
            """
            with cte1 as (
                select a, b from table1 where c > 0
            ),
            cte2 as (
                select a, sum(b) as total from cte1 group by a
            )
            select * from cte2
            """,
            label="cte_chain",
        )

    def test_recursive_cte(self):
        self._cll_with_and_without_cache(
            """
            with recursive nums as (
                select 1 as n
                union all
                select n + 1 from nums where n < 10
            )
            select * from nums
            """,
            label="recursive_cte",
        )

    def test_recursive_cte_with_table(self):
        self._cll_with_and_without_cache(
            """
            with recursive category_tree as (
                select category_id, parent_id, name
                from categories
                where parent_id is null
                union all
                select c.category_id, c.parent_id, c.name
                from categories c
                inner join category_tree ct on c.parent_id = ct.category_id
            )
            select * from category_tree
            """,
            schema={"categories": {"category_id": "int", "parent_id": "int", "name": "varchar"}},
            label="recursive_cte_table",
        )

    def test_union(self):
        self._cll_with_and_without_cache(
            """
            select a, b from table1 where c > 0
            union
            select a, b from table2
            """,
            label="union",
        )

    def test_union_all(self):
        self._cll_with_and_without_cache(
            """
            select a from table1
            union all
            select a from table2
            union all
            select a from table3
            """,
            label="union_all_3way",
        )

    def test_intersect(self):
        self._cll_with_and_without_cache(
            """
            select a from table1
            intersect
            select a from table2
            """,
            label="intersect",
        )

    def test_subquery_in_from(self):
        self._cll_with_and_without_cache(
            """
            select * from (
                select a, b from table1 where c > 0
            ) as sub
            """,
            label="subquery_from",
        )

    def test_subquery_in_where(self):
        self._cll_with_and_without_cache(
            """
            select a from table1 where user_id in (
                select user_id from table2 where status is not null
            )
            """,
            label="subquery_where",
        )

    def test_window_function(self):
        self._cll_with_and_without_cache(
            """
            select
                a,
                row_number() over (partition by b order by c desc) as rn,
                sum(d) over (order by c) as running_total
            from table1
            """,
            label="window_function",
        )

    def test_multiple_joins(self):
        self._cll_with_and_without_cache(
            """
            select t1.a, t2.b, t3.c
            from table1 t1
            left join table2 t2 on t1.id = t2.id
            inner join table3 t3 on t1.id = t3.id
            where t2.status = 'active'
            """,
            label="multiple_joins",
        )

    def test_case_when(self):
        self._cll_with_and_without_cache(
            """
            select
                case
                    when a > 100 then 'high'
                    when a > 50 then 'medium'
                    else 'low'
                end as category,
                b
            from table1
            """,
            label="case_when",
        )

    def test_nested_cte_with_join(self):
        self._cll_with_and_without_cache(
            """
            with
            cte1 as (
                select id, a from table1 where d > 0
            ),
            cte2 as (
                select id, b from table2
            )
            select id, a, b, table3.c
            from table3
            left join cte1 on table3.id = cte1.id
            join cte2 on table3.id = cte2.id
            """,
            label="nested_cte_join",
        )

    def test_inline_subquery_as_join(self):
        self._cll_with_and_without_cache(
            """
            select t1.id, t1.a, sub.total
            from table1 t1
            left join (
                select fk, sum(amount) as total
                from table2
                group by fk
            ) sub on t1.id = sub.fk
            """,
            label="inline_subquery_join",
        )

    def test_aggregate_with_group_by_index(self):
        self._cll_with_and_without_cache(
            """
            select a, count(b) as cnt, sum(c) as total
            from table1
            group by 1
            having count(b) > 5
            order by total desc
            """,
            label="aggregate_group_by_index",
        )

    # ----------------------------------------------------------------
    # Category 6: Error cases — cached vs uncached behavior must match
    # ----------------------------------------------------------------

    def test_error_parse_failure_cached_vs_uncached(self):
        """Parse errors should raise RecceException both with and without cache."""
        from recce.util import cll as cll_module

        bad_sql = "THIS IS NOT VALID SQL AT ALL !!! @@@"

        # Without cache
        os.environ.pop("ENABLE_CLL_CONTENT_CACHE", None)
        cll_module._cll_cache = CllCache()
        with pytest.raises(RecceException, match="Failed to parse"):
            cll(bad_sql)

        # With cache — first call (miss)
        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()
        with pytest.raises(RecceException, match="Failed to parse"):
            cll(bad_sql)

        # With cache — second call (should be cached error)
        with pytest.raises(RecceException):
            cll(bad_sql)

        stats = get_cll_cache().stats
        assert stats["hits"] == 1
        assert stats["misses"] == 1

    def test_error_consistency_across_calls(self):
        """Errors should be consistently raised, never returning a stale good result."""
        from recce.util import cll as cll_module

        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()

        # First: compute a valid result
        cll("select a from table1")

        # Then: a bad SQL — should NOT return the valid result
        with pytest.raises(RecceException):
            cll("DEFINITELY NOT SQL !!!")

    # ----------------------------------------------------------------
    # Category 7: Serialization roundtrip
    # ----------------------------------------------------------------

    def test_serialize_deserialize_roundtrip(self):
        """serialize -> deserialize -> compare should preserve all data."""
        # Build a non-trivial result
        m2c = [
            CllColumnDep(node="table1", column="id"),
            CllColumnDep(node="table2", column="fk"),
        ]
        c2c = {
            "a": CllColumn(
                name="a",
                transformation_type="passthrough",
                depends_on=[CllColumnDep(node="table1", column="a")],
            ),
            "total": CllColumn(
                name="total",
                transformation_type="derived",
                depends_on=[
                    CllColumnDep(node="table1", column="x"),
                    CllColumnDep(node="table1", column="y"),
                ],
            ),
            "literal_col": CllColumn(
                name="literal_col",
                transformation_type="source",
                depends_on=[],
            ),
            "renamed_col": CllColumn(
                name="renamed_col",
                transformation_type="renamed",
                depends_on=[CllColumnDep(node="t2", column="orig")],
            ),
        }
        original: CllResult = (m2c, c2c)

        serialized = CllCache._serialize(original)
        deserialized = CllCache._deserialize(serialized)

        _assert_cll_results_equal(original, deserialized, "roundtrip")

    def test_serialize_deserialize_empty_result(self):
        """Empty m2c and c2c should roundtrip correctly."""
        original: CllResult = ([], {})
        serialized = CllCache._serialize(original)
        deserialized = CllCache._deserialize(serialized)
        _assert_cll_results_equal(original, deserialized, "empty roundtrip")

    def test_serialize_deserialize_via_disk(self):
        """Full roundtrip through SQLite: put -> new instance -> get."""
        import tempfile

        m2c = [CllColumnDep(node="t1", column="a")]
        c2c = {
            "x": CllColumn(
                name="x",
                transformation_type="derived",
                depends_on=[CllColumnDep(node="t1", column="a"), CllColumnDep(node="t1", column="b")],
            ),
        }
        original: CllResult = (m2c, c2c)

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test_roundtrip.db")

            cache1 = CllCache(db_path=db_path)
            cache1.put("select x from t1", None, original)

            # New instance — only reads from SQLite
            cache2 = CllCache(db_path=db_path)
            loaded = cache2.get("select x from t1", None)
            assert loaded is not CllCache._SENTINEL
            _assert_cll_results_equal(original, loaded, "disk roundtrip")

    def test_cache_returns_deep_copy(self):
        """Mutating a cached result must not affect subsequent cache hits."""
        from recce.util import cll as cll_module

        os.environ["ENABLE_CLL_CONTENT_CACHE"] = "1"
        cll_module._cll_cache = CllCache()

        sql = "select a, b from table1 where c > 0"
        result1 = cll(sql)

        # Mutate result1
        m2c1, c2c1 = result1
        c2c1["a"].transformation_type = "CORRUPTED"
        c2c1["a"].depends_on.append(CllColumnDep(node="fake", column="fake"))

        # Get from cache again
        result2 = cll(sql)
        _, c2c2 = result2
        assert c2c2["a"].transformation_type == "passthrough", "Cache must return independent copy"
        assert len(c2c2["a"].depends_on) == 1, "Cache must return independent copy (depends_on)"

    # ----------------------------------------------------------------
    # Category 8: Real-world dbt-like SQL patterns
    # ----------------------------------------------------------------

    def test_dbt_style_model_with_source_refs(self):
        """Simulates a typical dbt model referencing source tables."""
        self._cll_with_and_without_cache(
            """
            with stg_orders as (
                select
                    order_id,
                    customer_id,
                    order_date,
                    status
                from raw.jaffle_shop.orders
            ),
            stg_payments as (
                select
                    payment_id,
                    order_id as payment_order_id,
                    amount
                from raw.stripe.payments
            )
            select
                stg_orders.order_id,
                stg_orders.customer_id,
                stg_orders.order_date,
                stg_orders.status,
                sum(stg_payments.amount) as total_amount
            from stg_orders
            left join stg_payments on stg_orders.order_id = stg_payments.payment_order_id
            group by 1, 2, 3, 4
            order by stg_orders.order_date desc
            """,
            label="dbt_style_model",
        )

    def test_dbt_incremental_pattern(self):
        """Simulates compiled SQL from a dbt incremental model."""
        self._cll_with_and_without_cache(
            """
            select
                id,
                created_at,
                updated_at,
                status
            from raw.events
            where updated_at > (select max(updated_at) from analytics.events)
            """,
            label="dbt_incremental",
        )

    def test_complex_cte_chain_with_multiple_transforms(self):
        """Multi-CTE chain with renaming, derivation, and aggregation."""
        self._cll_with_and_without_cache(
            """
            with base as (
                select id, name, amount, created_at from orders
            ),
            enriched as (
                select
                    id,
                    name as customer_name,
                    amount * 1.1 as amount_with_tax,
                    date_trunc('month', created_at) as order_month
                from base
            ),
            monthly as (
                select
                    order_month,
                    count(*) as order_count,
                    sum(amount_with_tax) as monthly_revenue
                from enriched
                group by order_month
            )
            select
                order_month,
                order_count,
                monthly_revenue,
                sum(monthly_revenue) over (order by order_month) as cumulative_revenue
            from monthly
            order by order_month
            """,
            label="complex_cte_chain",
        )
