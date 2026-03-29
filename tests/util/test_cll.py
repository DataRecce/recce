import os
import unittest
from typing import List, Optional, Tuple

import pytest

from recce.exceptions import RecceException
from recce.models.types import CllColumn, CllColumnDep
from recce.util.cll import CllCache, CllResult, cll


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


class CllNodeCacheTest(unittest.TestCase):
    """Tests for the per-node CllData cache (SQLite-backed)."""

    def test_put_and_get_node(self):
        """Store and retrieve a node entry."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            cache.put_node("node1", "key1", '{"test": true}')
            loaded = cache.get_node("node1", "key1")
            assert loaded == '{"test": true}'

    def test_get_miss(self):
        """Missing entry returns None."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)
            assert cache.get_node("missing", "key") is None

    def test_persistence_across_instances(self):
        """Node cache survives across CllCache instances."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")

            cache1 = CllCache(db_path=db_path)
            cache1.put_node("node1", "key1", '{"data": "hello"}')

            cache2 = CllCache(db_path=db_path)
            loaded = cache2.get_node("node1", "key1")
            assert loaded == '{"data": "hello"}'

    def test_different_content_key_is_miss(self):
        """Same node_id but different content_key should miss."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            cache.put_node("node1", "key_v1", '{"version": 1}')
            assert cache.get_node("node1", "key_v1") is not None
            assert cache.get_node("node1", "key_v2") is None

    def test_batch_insert(self):
        """Batch insert multiple entries."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            entries = [
                ("node1", "k1", '{"n": 1}'),
                ("node2", "k2", '{"n": 2}'),
                ("node3", "k3", '{"n": 3}'),
            ]
            cache.put_nodes_batch(entries)

            assert cache.get_node("node1", "k1") == '{"n": 1}'
            assert cache.get_node("node2", "k2") == '{"n": 2}'
            assert cache.get_node("node3", "k3") == '{"n": 3}'
            assert cache.stats["entries"] == 3

    def test_ttl_eviction(self):
        """Entries older than TTL should be evicted."""
        import tempfile
        import time as _time
        import sqlite3 as _sqlite3
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path, ttl_seconds=5)

            cache.put_node("node1", "k1", '{"data": 1}')

            # Backdate last_accessed
            conn = _sqlite3.connect(db_path)
            conn.execute("UPDATE cll_node_cache SET last_accessed = ?", (_time.time() - 10,))
            conn.commit()
            conn.close()

            deleted = cache.evict_stale()
            assert deleted == 1
            assert cache.get_node("node1", "k1") is None

    def test_ttl_keeps_recent(self):
        """Recent entries survive eviction."""
        import tempfile
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path, ttl_seconds=3600)

            cache.put_node("node1", "k1", '{"data": 1}')
            deleted = cache.evict_stale()
            assert deleted == 0
            assert cache.get_node("node1", "k1") is not None

    def test_last_accessed_updated_on_get(self):
        """Reading an entry updates its last_accessed."""
        import tempfile
        import time as _time
        import sqlite3 as _sqlite3
        from recce.util.cll import CllCache

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "cll_cache.db")
            cache = CllCache(db_path=db_path)

            cache.put_node("node1", "k1", '{"data": 1}')
            key = CllCache.make_node_key("node1", "k1")

            # Backdate
            conn = _sqlite3.connect(db_path)
            old_time = _time.time() - 3600
            conn.execute("UPDATE cll_node_cache SET last_accessed = ?", (old_time,))
            conn.commit()
            conn.close()

            # Read (should touch last_accessed)
            cache2 = CllCache(db_path=db_path)
            cache2.get_node("node1", "k1")

            conn = _sqlite3.connect(db_path)
            row = conn.execute("SELECT last_accessed FROM cll_node_cache WHERE key = ?", (key,)).fetchone()
            conn.close()
            assert row[0] > old_time + 3000

    def test_no_db_returns_none(self):
        """Without db_path, all operations are no-ops."""
        from recce.util.cll import CllCache

        cache = CllCache()  # no db_path
        cache.put_node("node1", "k1", '{"data": 1}')
        assert cache.get_node("node1", "k1") is None
        assert cache.stats["entries"] == 0


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


class CllDeterminismTest(unittest.TestCase):
    """Verify that cll() produces deterministic results.

    Calls cll() twice with the same SQL and asserts both results are identical.
    Also verifies results are correct for various SQL patterns.
    """

    def _assert_deterministic(
        self,
        sql: str,
        schema: Optional[dict] = None,
        dialect: Optional[str] = None,
        label: str = "",
    ) -> CllResult:
        """Run cll() twice, assert results are identical."""
        result1 = cll(sql, schema=schema, dialect=dialect)
        result2 = cll(sql, schema=schema, dialect=dialect)
        _assert_cll_results_equal(result1, result2, f"{label} call1 vs call2")
        return result1

    # ----------------------------------------------------------------
    # Category 1: Basic correctness — deterministic output
    # ----------------------------------------------------------------

    def test_simple_select(self):
        self._assert_deterministic(
            "select a, b from table1",
            label="simple_select",
        )

    def test_select_with_where(self):
        self._assert_deterministic(
            "select a, b from table1 where a > 0 and b < 100",
            label="select_with_where",
        )

    def test_select_with_schema(self):
        self._assert_deterministic(
            "select * from table1",
            schema={"table1": {"a": "int", "b": "varchar"}},
            label="select_star_with_schema",
        )

    def test_select_with_alias(self):
        self._assert_deterministic(
            "select a as x, b as y from table1",
            label="alias",
        )

    def test_derived_columns(self):
        self._assert_deterministic(
            "select a + b as total, cast(c as int) as c_int from table1",
            label="derived",
        )

    def test_join(self):
        self._assert_deterministic(
            "select t1.a, t2.b from table1 t1 join table2 t2 on t1.id = t2.id",
            label="join",
        )

    def test_group_by_having(self):
        self._assert_deterministic(
            "select a, sum(b) as total from table1 group by a having sum(b) > 10",
            label="group_by_having",
        )

    def test_order_by(self):
        self._assert_deterministic(
            "select a, b from table1 order by a desc, c",
            label="order_by",
        )

    # ----------------------------------------------------------------
    # Category 2: Normalization safety — db/schema qualifiers stripped
    # ----------------------------------------------------------------

    def test_normalization_bare_vs_qualified(self):
        """SQL differing only in db/schema qualifiers should produce identical CLL."""
        sql_bare = "select a from table1 where b > 0"
        sql_qualified = "select a from mydb.myschema.table1 where mydb.myschema.table1.b > 0"

        result_bare = cll(sql_bare)
        result_qualified = cll(sql_qualified)

        _assert_cll_results_equal(result_bare, result_qualified, "bare vs fully-qualified")

    def test_normalization_different_schemas_same_table(self):
        """Tables that differ only in schema prefix should produce same CLL."""
        sql_a = "select x from schema_a.orders"
        sql_b = "select x from schema_b.orders"

        result_a = cll(sql_a)
        result_b = cll(sql_b)

        _assert_cll_results_equal(result_a, result_b, "schema_a vs schema_b")

    def test_normalization_column_in_where_clause(self):
        """Qualified column references in WHERE should normalize identically."""
        sql_bare = "select a from t1 where t1.b = 1"
        sql_qualified = "select a from db.schema.t1 where db.schema.t1.b = 1"

        result_bare = cll(sql_bare)
        result_qualified = cll(sql_qualified)

        _assert_cll_results_equal(result_bare, result_qualified, "where clause normalization")

    # ----------------------------------------------------------------
    # Category 3: Normalization edge cases
    # ----------------------------------------------------------------

    def test_dialect_duckdb(self):
        self._assert_deterministic(
            'select a, b from "table1" where a > 0',
            dialect="duckdb",
            label="duckdb",
        )

    def test_dialect_snowflake(self):
        self._assert_deterministic(
            "select a, b from table1 where a > 0",
            dialect="snowflake",
            label="snowflake",
        )

    def test_dialect_bigquery(self):
        self._assert_deterministic(
            "select a, b from `project.dataset.table1` where a > 0",
            dialect="bigquery",
            label="bigquery",
        )

    def test_dialect_postgres(self):
        self._assert_deterministic(
            'select a, b from "table1" where a::int > 0',
            dialect="postgres",
            label="postgres",
        )

    def test_dialect_redshift(self):
        self._assert_deterministic(
            "select a, b from table1 where a > 0",
            dialect="redshift",
            label="redshift",
        )

    def test_cte_chain(self):
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
            """
            select a, b from table1 where c > 0
            union
            select a, b from table2
            """,
            label="union",
        )

    def test_union_all(self):
        self._assert_deterministic(
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
        self._assert_deterministic(
            """
            select a from table1
            intersect
            select a from table2
            """,
            label="intersect",
        )

    def test_subquery_in_from(self):
        self._assert_deterministic(
            """
            select * from (
                select a, b from table1 where c > 0
            ) as sub
            """,
            label="subquery_from",
        )

    def test_subquery_in_where(self):
        self._assert_deterministic(
            """
            select a from table1 where user_id in (
                select user_id from table2 where status is not null
            )
            """,
            label="subquery_where",
        )

    def test_window_function(self):
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
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
    # Category 4: Error cases
    # ----------------------------------------------------------------

    def test_error_consistency_across_calls(self):
        """Invalid SQL should always raise, even after a successful call."""
        cll("select a from table1")

        with pytest.raises(RecceException):
            cll("DEFINITELY NOT SQL !!!")

    # ----------------------------------------------------------------
    # Category 5: Independence of returned results
    # ----------------------------------------------------------------

    def test_returns_independent_results(self):
        """Mutating one result must not affect subsequent calls."""
        sql = "select a, b from table1 where c > 0"
        result1 = cll(sql)

        # Mutate result1
        _, c2c1 = result1
        c2c1["a"].transformation_type = "CORRUPTED"
        c2c1["a"].depends_on.append(CllColumnDep(node="fake", column="fake"))

        # Second call should be unaffected
        result2 = cll(sql)
        _, c2c2 = result2
        assert c2c2["a"].transformation_type == "passthrough", "Must return independent result"
        assert len(c2c2["a"].depends_on) == 1, "Must return independent result (depends_on)"

    # ----------------------------------------------------------------
    # Category 6: Real-world dbt-like SQL patterns
    # ----------------------------------------------------------------

    def test_dbt_style_model_with_source_refs(self):
        """Simulates a typical dbt model referencing source tables."""
        self._assert_deterministic(
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
        self._assert_deterministic(
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
        self._assert_deterministic(
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
