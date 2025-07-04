import textwrap
import unittest

from deepdiff import DeepDiff

from recce.models.types import ChangeStatus
from recce.util.breaking import parse_change_category

SOURCE_SCHEMA = {
    "Customers": {"customer_id": "int", "a": "int", "b": "int", "c": "int", "d": "int"},
    "Orders": {"order_id": "int", "customer_id": "int", "w": "int", "x": "int", "y": "int", "z": "int"},
}


def _parse_change_catgory(
    original_sql,
    modified_sql,
    dialect=None,
):
    return parse_change_category(
        original_sql,
        modified_sql,
        old_schema=SOURCE_SCHEMA,
        new_schema=SOURCE_SCHEMA,
        dialect=dialect,
    )


def is_breaking_change(
    original_sql,
    modified_sql,
    expected_changed_columns: dict[str, ChangeStatus] = None,
    dialect=None,
):
    result = _parse_change_catgory(
        original_sql,
        modified_sql,
        dialect=dialect,
    )
    if result.category != "breaking":
        return False

    if expected_changed_columns is not None:
        diff = DeepDiff(expected_changed_columns, result.columns, ignore_order=True)
        if len(diff) > 0:
            return False

    return True


def is_partial_breaking_change(
    original_sql,
    modified_sql,
    expected_changed_columns: dict[str, ChangeStatus] = None,
    dialect=None,
):
    result = _parse_change_catgory(
        original_sql,
        modified_sql,
        dialect=dialect,
    )
    if result.category != "partial_breaking":
        return False

    if expected_changed_columns is not None:
        diff = DeepDiff(expected_changed_columns, result.columns, ignore_order=True)
        if len(diff) > 0:
            return False

    return True


def is_non_breaking_change(
    original_sql,
    modified_sql,
    expected_changed_columns: dict[str, ChangeStatus] = None,
    dialect=None,
):
    result = _parse_change_catgory(
        original_sql,
        modified_sql,
        dialect=dialect,
    )
    if result.category != "non_breaking":
        return False

    if expected_changed_columns is not None:
        diff = DeepDiff(expected_changed_columns, result.columns, ignore_order=True)
        if len(diff) > 0:
            return False

    return True


class BreakingChangeTest(unittest.TestCase):
    def test_identical(self):
        original_sql = """
        select
            a, b
        from Customers
        """
        modified_sql = """
        select
            a,
            b
        from Customers
        """
        modified_sql2 = """
        --- this is comment
        select
            a, --- this is comment
            b  --- this is comment
        from Customers
        """
        assert is_non_breaking_change(original_sql, modified_sql, {})
        assert is_non_breaking_change(original_sql, modified_sql2, {})
        assert is_non_breaking_change(original_sql, textwrap.dedent(modified_sql), {})

    def test_table_diff(self):
        original_sql = """
        select
            a, b
        from Customers
        """
        modified_sql = """
        select
            a,
            b
        from Orders
        """
        assert is_breaking_change(original_sql, modified_sql, {"a": "modified", "b": "modified"})

    def test_add_column(self):
        original_sql = """
        select
            a
        from Customers
        """
        modified_sql = """
        select
            a, b
        from Customers
        """
        modified_sql2 = """
        select
            a, b as a2
        from Customers
        """
        modified_sql3 = """
        select
            a,
            case when a > 100 then 1 else 0 end as a2
        from Customers
        """
        assert is_non_breaking_change(original_sql, modified_sql, {"b": "added"})
        assert is_non_breaking_change(original_sql, modified_sql2, {"a2": "added"})
        assert is_non_breaking_change(original_sql, modified_sql3, {"a2": "added"})

        # by cte
        original_sql = """
        with cte as (
            select
                a
            from Customers
        )
        select
            a
        from cte
        """
        modified_sql = """
        with cte as (
            select
                a, b
            from Customers
        )
        select
            a, b
        from cte
        """
        assert is_non_breaking_change(original_sql, modified_sql, {"b": "added"})

    def test_rename_column(self):
        original_sql = """
        select
            a
        from Customers
        """
        modified_sql = """
        select
            a as a1
        from Customers
        """
        assert is_partial_breaking_change(
            original_sql,
            modified_sql,
            {
                "a": "removed",
                "a1": "added",
            },
        )

        # by cte
        original_sql = """
        with cte as (
            select
                a,
                b
            from Customers
        )
        select
            a
        from cte
        """
        modified_sql = """
        with cte as (
            select
                a as a1,
                b as b1
            from Customers
        )
        select
            a1
        from cte
        """
        assert is_partial_breaking_change(
            original_sql,
            modified_sql,
            {
                "a": "removed",
                "a1": "added",
            },
        )

    def test_remove_column(self):
        original_sql = """
        select
            a,
            b
        from Customers
        """
        modified_sql = """
        select
            b
        from Customers
        """
        assert is_partial_breaking_change(original_sql, modified_sql, {"a": "removed"})

    def test_reorder_column(self):
        original_sql = """
        select
            a,
            b
        from Customers
        """
        modified_sql = """
        select
            b,
            a
        from Customers
        """
        assert is_non_breaking_change(original_sql, modified_sql)

    def test_modify_column(self):
        alias = """
        select
            a as a2,
        from Customers
        """
        derived = """
        select
            a + 1 as a2,
        from Customers
        """
        derived2 = """
        select
            (a * b + c * d) as a2,
        from Customers
        """
        aggregate = """
        select
            count(a) as a2,
        from Customers
        """
        assert is_partial_breaking_change(alias, derived, {"a2": "modified"})
        assert is_partial_breaking_change(derived, alias, {"a2": "modified"})
        assert is_partial_breaking_change(derived, derived2, {"a2": "modified"})
        assert is_breaking_change(alias, aggregate)

    def test_aggrgation_function(self):
        no_agg = """
        select
            a as a2,
        from Customers
        """

        agg = """
        select
            count(*) as a2,
        from Customers
        """

        agg2 = """
        select
            count(a) as a2,
        from Customers
        """

        agg3 = """
        select
            sum(a) as a2,
        from Customers
        """

        agg4 = """
        select
            sum(a+1) as a2,
        from Customers
        """

        # Because changes from non-aggregation to aggregation would affect the row count.
        assert is_breaking_change(no_agg, agg)
        assert is_breaking_change(agg, no_agg)

        assert is_partial_breaking_change(agg, agg2, {"a2": "modified"})
        assert is_partial_breaking_change(agg2, agg3, {"a2": "modified"})
        assert is_partial_breaking_change(agg3, agg4, {"a2": "modified"})

    def test_window_function(self):
        no_win = """
        SELECT
           order_id,
           customer_id,
           x AS amount
        FROM Orders;
        """

        with_win = """
        SELECT
           order_id,
           customer_id,
           x AS amount,
           SUM(x) OVER (PARTITION BY customer_id) AS customer_total
        FROM Orders;
        """

        with_win2 = """
        SELECT
           order_id,
           customer_id,
           x AS amount,
           SUM(x+1) OVER (PARTITION BY customer_id) AS customer_total
        FROM Orders;
        """

        assert is_non_breaking_change(no_win, with_win, {"customer_total": "added"})
        assert is_partial_breaking_change(with_win, no_win, {"customer_total": "removed"})
        assert is_partial_breaking_change(with_win, with_win2, {"customer_total": "modified"})

    def test_joins(self):
        no_join = """
        select
            a,
            b
        from Customers as C
        """

        with_join = """
        select
            a,
            b
        from Customers as C
        join Orders as O on C.customer_id = O.customer_id
        """
        with_join2 = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        join Orders as O on C.customer_id = O.customer_id
        """
        with_join3 = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        join Orders as O on C.customer_id = O.customer_id and O.x > 1000
        """

        assert is_breaking_change(no_join, with_join)
        assert is_non_breaking_change(with_join, with_join2, {"x": "added", "y": "added"})
        assert is_breaking_change(with_join, with_join3)

    def test_outer_joins(self):
        no_join = """
        select
            a,
            b
        from Customers as C
        """

        with_inner_join = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        join Orders as O on C.customer_id = O.customer_id
        """

        with_left_join = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        left join Orders as O on C.customer_id = O.customer_id
        """

        with_right_join = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        right join Orders as O on C.customer_id = O.customer_id
        """

        with_full_outer_join = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        full outer join Orders as O on C.customer_id = O.customer_id
        """

        with_cross_join = """
        select
            a,
            b,
            x,
            y
        from Customers as C
        cross join Orders as O
        """

        assert is_breaking_change(with_inner_join, with_left_join)
        assert is_breaking_change(with_inner_join, with_right_join)
        assert is_breaking_change(with_inner_join, with_full_outer_join)
        assert is_breaking_change(with_inner_join, with_cross_join)

        # Currently, we don't support left join as partial breaking change.
        assert is_breaking_change(no_join, with_left_join)
        # assert is_non_breaking_change(no_join, with_left_join, {'x': 'added', 'y': 'added'})

    def test_cte(self):
        original = """
        with A as (
            select
                customer_id,
                a
            from Customers
        ),
        B as (
            select
                customer_id,
                count(*) as order_count
            from Orders
            group by 1
        )
        select * from A join B on A.customer_id = B.customer_id
        """
        modified1 = """
        with A as (
            select
                customer_id,
                a
            from Customers
        ),
        B as (
            select
                customer_id,
                count(*) as order_count,
                sum(w) as order_amount,
            from Orders
            group by 1
        )
        select * from A join B on A.customer_id = B.customer_id
        """
        modified2 = """
        with A as (
            select
                customer_id,
                a
            from Customers
        ),
        B as (
            select
                customer_id
            from Orders
            group by 1
        )
        select * from A join B on A.customer_id = B.customer_id
        """
        modified3 = """
        with A as (
            select
                customer_id,
                a
            from Customers
        ),
        B as (
            select
                customer_id,
                count(w) as order_count,
            from Orders
            group by 1
        )
        select * from A join B on A.customer_id = B.customer_id
        """
        assert is_non_breaking_change(original, modified1, {"order_amount": "added"})
        assert is_partial_breaking_change(original, modified2, {"order_count": "removed"})
        assert is_partial_breaking_change(original, modified3, {"order_count": "modified"})

    def test_cte_rename(self):
        original = """
        with cte as (
            select * from Customers
        )
        select * from cte
        """
        modified = """
        with cte2 as (
            select * from Customers
        )
        select * from cte2
        """

        # This would be treated as non breaking change after the optimizer.
        assert is_partial_breaking_change(
            original,
            modified,
            {"customer_id": "modified", "a": "modified", "b": "modified", "c": "modified", "d": "modified"},
        )

    def test_cte_with_select_star(self):
        original_sql = """
        with cte as (
            select
                a, b
            from Customers
        )
        select
            *
        from cte
        """
        modified_sql = """
        with cte as (
            select
                a
            from Customers
        )
        select
            *
        from cte
        """
        assert is_partial_breaking_change(original_sql, modified_sql, {"b": "removed"})
        modified_sql = """
        with cte as (
            select
                a,b,c
            from Customers
        )
        select
            *
        from cte
        """
        assert not is_breaking_change(original_sql, modified_sql)

    def test_cte_alias(self):
        original = """
        with O as (
            select
                customer_id,
                count(*) as order_count
            from Orders
            group by 1
        )
        select
            C.a,
            C.a as a2,
            C.c,
            O.*
        from Customers as C join O on C.customer_id = O.customer_id
        """
        modified = """
        with O as (
            select
                customer_id,
                count(*) as order_count,
                sum(w) as order_amount,
            from Orders
            group by 1
        )
        select
            C.a,
            C.a + 1 as a2,
            C.b,
            O.*
        from Customers as C join O on C.customer_id = O.customer_id
        """
        assert is_partial_breaking_change(
            original, modified, {"a2": "modified", "b": "added", "c": "removed", "order_amount": "added"}
        )

    def test_where_change(self):
        no_where = """
        select
            a
        from Customers
        """
        with_where = """
        select
            a
        from Customers
        where a > 100
        """
        with_where2 = """
        select
            a
        from Customers
        where a > 101
        """
        assert is_breaking_change(no_where, with_where)
        assert is_breaking_change(with_where, with_where2)

    def test_where_change_with_column_changes(self):
        no_where = """
        select
            a,
            b
        from Customers
        """
        with_where = """
        select
            a + 1 as a,
            b as b2,
        from Customers
        where a > 100
        """
        assert is_breaking_change(no_where, with_where, {"a": "modified", "b": "removed", "b2": "added"})

    def test_where_source_column_change(self):
        original_sql = """
        with cte as (
            select
                a as a1
            from Customers
        )
        select a1 from cte where a1 > 100
        """
        modified_sql = """
        with cte as (
            select
                a + 1 as a1
            from Customers
        )
        select a1 from cte where a1 > 100
        """
        assert is_breaking_change(original_sql, modified_sql)

    def test_group_change(self):
        original = """
        select
            a as k
        from Customers
        group by a
        """
        modified = """
        select
            a + 1 as k
        from Customers
        group by a + 1
        """
        assert is_breaking_change(original, modified)

    def test_group_change_index(self):
        original = """
           select
               a as k,
               count(*) as c
           from Customers
           group by 1
           """
        modified = """
           select
               a + 1 as k,
               count(*) as c
           from Customers
           group by 1
           """
        assert is_breaking_change(original, modified)

    def test_group_source_column_change(self):
        original_sql = """
           with cte as (
               select
                   a as a1
               from Customers
           )
           select a1 from cte group by a1
           """
        modified_sql = """
           with cte as (
               select
                   a + 1 as a1
               from Customers
           )
           select a1 from cte group by a1
           """
        assert is_breaking_change(original_sql, modified_sql)

    def test_group_source_index_change(self):
        original_sql = """
           with cte as (
               select
                   a as a1
               from Customers
           )
           select a1 from cte group by 1
           """
        modified_sql = """
           with cte as (
               select
                   a + 1 as a1
               from Customers
           )
           select a1 from cte group by 1
           """
        assert is_breaking_change(original_sql, modified_sql)

    def test_having_change(self):
        original = """
        select
          customer_id,
          sum(x) as total_spent
        from Orders
        group by customer_id
        having sum(x) > 1000;
        """
        modified = """
        select
          customer_id,
          sum(x) as total_spent
        from Orders
        group by customer_id
        having sum(x) > 2000;
        """
        assert is_breaking_change(original, modified)

    def test_having_source_change(self):
        original = """
        with cte as (
           select
               customer_id,
               x as amount
           from Orders
        )
        select
           customer_id,
           sum(amount) as total_spent
        from cte
        group by customer_id
        having sum(amount) > 1000
        """
        modified = """
        with cte as (
           select
               customer_id,
               (x+1) as amount
           from Orders
        )
        select
           customer_id,
           sum(amount) as total_spent
        from cte
        group by customer_id
        having sum(amount) > 1000
        """
        assert is_breaking_change(original, modified)

    def test_having_select_change(self):
        original = """
        select
           customer_id,
           count(amount) as total_spent
        from Orders
        group by customer_id
        having total_spent > 1000
        """
        modified = """
        select
           customer_id,
           sum(amount) as total_spent
        from Orders
        group by customer_id
        having total_spent > 1000
        """
        assert is_breaking_change(original, modified)

    def test_order_change(self):
        no_order = """
        select
          customer_id,
          a
        from Orders
        """
        order1 = """
        select
          customer_id,
          a
        from Orders
        order by customer_id;
        """
        order2 = """
        select
          customer_id,
          a
        from Orders
        order by customer_id desc
        """
        order3 = """
        select
          customer_id,
          a
        from Orders
        order by a
        """
        assert is_breaking_change(no_order, order1)
        assert is_breaking_change(order1, order2)
        assert is_breaking_change(order1, order3)

    def test_order_source_change(self):
        original = """
        with cte as (
           select
               customer_id,
               x as amount
           from Orders
        )
        select
           customer_id,
           amount
        from cte
        order by amount
        """
        modified = """
        with cte as (
           select
               customer_id,
               (x+1) as amount
           from Orders
        )
        select
           customer_id,
           amount
        from cte
        order by amount
        """
        assert is_breaking_change(original, modified)

    def test_order_select_change(self):
        original = """
        select
           customer_id,
           x as amount,
        from Orders
        order by amount
        """
        modified = """
        select
           customer_id,
           x + 1 as amount,
        from Orders
        order by amount
        """
        assert is_breaking_change(original, modified)

    def test_order_index_change(self):
        original = """
        select
           customer_id,
           x as amount,
        from Orders
        order by 2
        """
        modified = """
        select
           customer_id,
           x + 1 as amount,
        from Orders
        order by 2
        """
        assert is_breaking_change(original, modified)

        original = """
        select
           customer_id,
           x as amount,
        from Orders
        order by 1
        """
        modified = """
        select
           customer_id,
           x + 1 as amount,
        from Orders
        order by 1
        """
        assert is_partial_breaking_change(original, modified, {"amount": "modified"})

    def test_limit(self):
        no_limit = """
        select
            a
        from Customers
        """
        with_limit = """
        select
            a
        from Customers
        limit 100
        """
        with_limit2 = """
        select
            a
        from Customers
        limit 101
        """
        assert is_breaking_change(no_limit, with_limit)
        assert is_breaking_change(with_limit, with_limit2)

    def test_offset(self):
        no_offset = """
        select
            a
        from Customers
        """
        with_offset = """
        select
            a
        from Customers
        offset 1
        """
        with_offset2 = """
        select
            a
        from Customers
        offset 10
        """
        assert is_breaking_change(no_offset, with_offset)
        assert is_breaking_change(with_offset, with_offset2)

    def test_count_function(self):
        original = """
        with cte as (
            select a from Customers
        )
        select count(*) from cte
        """
        modified = """
        with cte as (
            select a from Customers where a > 100
        )
        select count(*) as c from cte
        """
        assert is_breaking_change(original, modified)

        original = """
        with cte as (
            select a from Customers
        )
        select count(a) as c from cte
        """
        modified = """
        with cte as (
            select a from Customers where a > 100
        )
        select count(a) as c from cte
        """
        modified2 = """
        with cte as (
            select a+1 as a from Customers
        )
        select count(a) as c from cte
        """

        # Although we can mark it as partial breaking. However, in current implementation, we mark it as breaking
        # if any downstream is breaking.
        assert is_breaking_change(original, modified)

        assert is_partial_breaking_change(original, modified2, {"c": "modified"})

    def test_distinct_count_function(self):
        original = """
        select count(distinct a) as unique from cte
        """
        modified = """
        select count(distinct (a+1)) as unique from cte
        """
        assert is_partial_breaking_change(original, modified, {"unique": "modified"})

        original = """
        with cte as (
            select a from Customers
        )
        select count(distinct a) as unique from cte
        """
        modified = """
        with cte as (
            select a + 1 as a  from Customers
        )
        select count(distinct a) as unique from cte
        """
        assert is_partial_breaking_change(original, modified, {"unique": "modified"})

    def test_disctinct_function(self):
        original = """
        with cte as (
            select a, b from Customers
        )
        select distinct a, b from cte
        """
        modified1 = """
        with cte as (
            select a, b from Customers where a > 100
        )
        select distinct a, b from cte
        """
        modified2 = """
        with cte as (
            select a+1 as a, b from Customers
        )
        select distinct a, b from cte
        """
        modified_removed = """
        with cte as (
            select a, b from Customers
        )
        select distinct a from cte
        """
        assert is_breaking_change(original, modified1)
        assert is_breaking_change(original, modified2)
        assert is_breaking_change(original, modified_removed)
        assert is_breaking_change(modified_removed, original)

    def test_udtf_function(self):
        no_udtf = """
        select
            a
        from Customers
        """
        with_udtf = """
        select
            a,
            unnest(a) as b
        from Customers
        """
        with_udtf2 = """
        select
            a,
            unnest(a+1) as b
        from Customers
        """
        assert is_breaking_change(no_udtf, with_udtf)
        assert is_breaking_change(with_udtf, no_udtf)
        assert is_breaking_change(with_udtf, with_udtf2)

        original = """
        with cte as (
        select
            a
        from Customers
        )
        select unnest(a) as a2 from cte
        """
        modified = """
        with cte as (
        select
            a + 1 as a
        from Customers
        )
        select unnest(a) as a2 from cte
        """
        assert is_breaking_change(original, modified)

    def test_set_operations(self):
        union1 = """
        select a from Customers
        union
        select a from Customers
        """
        union2 = """
        select a + 1 as a from Customers
        union
        select a from Customers
        """
        union3 = """
        select a,b from Customers
        union
        select a,b from Customers
        """
        assert is_partial_breaking_change(union1, union2, {"a": "modified"})
        assert is_partial_breaking_change(union2, union1, {"a": "modified"})
        assert is_non_breaking_change(union1, union3, {"b": "added"})
        assert is_partial_breaking_change(union3, union1, {"b": "removed"})

        union1 = """
        select a from Customers
        union
        select a from Customers
        union
        select a from Customers
        """
        union2 = """
        select a from Customers
        union
        select a + 1 as a from Customers
        union
        select a + 2 as a from Customers
        """
        union3 = """
        select a,b from Customers
        union
        select a,b from Customers
        union
        select a,b from Customers
        """
        assert is_partial_breaking_change(union1, union2, {"a": "modified"})
        assert is_partial_breaking_change(union2, union1, {"a": "modified"})
        assert is_non_breaking_change(union1, union3, {"b": "added"})
        assert is_partial_breaking_change(union3, union1, {"b": "removed"})

    def test_union_all(self):
        union1 = """
        select a from Customers
        union all
        select a from Customers
        """
        union2 = """
        select a + 1 as a from Customers
        union all
        select a from Customers
        """
        union3 = """
        select a,b from Customers
        union all
        select a,b from Customers
        """
        assert is_partial_breaking_change(union1, union2, {"a": "modified"})
        assert is_partial_breaking_change(union2, union1, {"a": "modified"})
        assert is_non_breaking_change(union1, union3, {"b": "added"})
        assert is_partial_breaking_change(union3, union1, {"b": "removed"})

    def test_cte_recursive(self):
        original = """
        with recursive cte as (
            select a, b from Customers
            union all
            select a, b from Customers
            where a < 100
        )
        select * from cte
        """
        modified = """
        with recursive cte as (
            select a + 1 as a, b from Customers
            union all
            select a, b from Customers
            where a < 100
        )
        select * from cte
        """
        modified2 = """
        with recursive cte as (
            select a + 1 as a, b from Customers
            union all
            select a, b from Customers
            where a < 200
        )
        select * from cte
        """
        assert is_partial_breaking_change(original, modified, {"a": "modified"})
        assert is_breaking_change(original, modified2)

    def test_subquery(self):
        original = """
        select * from (
            select a from Customers
        ) as t
        """
        modified1 = """
        select * as a from (
            select a + 1 as a from Customers
        ) as t
        """
        modified2 = """
        select * as a from (
            select a from Customers where b > 100
        ) as t
        """
        modified3 = """
        select * from (
            select a from Customers
        ) as q
        """
        added = """
        select * from (
            select a,b from Customers
        ) as t
        """
        assert is_partial_breaking_change(original, modified1, {"a": "modified"})
        assert is_breaking_change(original, modified2)
        assert is_partial_breaking_change(original, modified3, {"a": "modified"})
        assert is_non_breaking_change(original, added, {"b": "added"})
        assert is_partial_breaking_change(added, original, {"b": "removed"})

    def test_subquery_rename(self):
        original = """
        select * from (
            select a from Customers
        ) as t
        """
        modified = """
        select * from (
            select a from Customers
        ) as t2
        """

        # This would be treated as non breaking change after the optimizer.
        assert is_partial_breaking_change(original, modified, {"a": "modified"})

    def test_subquery_in_filter(self):
        original = """
        select
            customer_id,
            a
        from Customers
        where a > (
            select avg(a) from Customers
        )
        """
        modified = """
        select
            customer_id,
            a
        from Customers
        where a > (
            select avg(a) + 1 from Customers
        )
        """
        assert is_breaking_change(original, modified)

    def test_no_schema(self):
        original = """
        with source (
            select * from Payments
        ),
        renamed (
            select
            *
            from source
        )
        select * from renamed
        """

        added = """
        with source (
            select * from Payments
        ),
        renamed (
            select
            *,
            a as a1
            from source
        )
        select * from renamed
        """
        assert is_non_breaking_change(original, added, {"a1": "added"})
        assert is_partial_breaking_change(added, original, {"a1": "removed"})

        original = """
        with source (
            select * from Payments
        ),
        renamed (
            select
            *
            from source
        )
        select * from source
        """

        added_no_use = """
        with source (
            select * from Payments
        ),
        renamed (
            select
            *,
            a as a1
            from source
        )
        select * from source
        """
        assert is_non_breaking_change(original, added_no_use, {})

    def test_non_sql(self):
        malformed1 = """
        select
            a
        from
        """

        malformed2 = """
        selects
            a
        from Customers
        """
        assert parse_change_category(malformed1, malformed2).category == "unknown"

    def test_dialect(self):
        original_sql = """
        SELECT
            a
        FROM Customers
        """
        modified_sql = """
        SELECT
           a,
           b,
        FROM Customers
        """

        assert is_non_breaking_change(original_sql, modified_sql, dialect=None)
        assert is_non_breaking_change(original_sql, modified_sql, dialect="xyz")
        for dialect in ["snowflake", "bigquery", "redshift", "duckdb"]:
            assert is_non_breaking_change(original_sql, modified_sql, dialect=dialect)

    def test_pr42(self):
        original_sql = """
        with source as (
            select * from Customers
        ),
        renamed as (
            select
                id as order_id,
                user_id as customer_id,
                order_date,
                status,
            from source
        )

        select * from renamed
        """
        modified_sql = """
        with source as (
            select * from Customers
        ),
        renamed as (
            select
                id as order_id,
                user_id as customer_id,
                order_date,
                status,
                status = 'completed' as is_closed
            from source
        )
        select *,

        from renamed
        """
        assert is_non_breaking_change(original_sql, modified_sql)

    def test_pr44(self):
        original_sql = """
        with source as (
            select * from raw_payments
        ),
        renamed as (

            select
                id as payment_id,
                order_id,
                payment_method,
                -- `amount` is currently stored in cents, so we convert it to dollars
                amount / 100 as amount
            from source
        )

        select * from renamed
        """
        modified_sql = """
        with source as (
            select * from raw_payments
        ),
        renamed as (
            select
                id as payment_id,
                order_id,
                payment_method,
                -- `amount` is currently stored in cents, so we convert it to dollars
                amount / 100 as amount,
                payment_method == 'coupon' as is_promotion
            from source
        )
        select * from renamed
        """
        assert is_non_breaking_change(original_sql, modified_sql, {"is_promotion": "added"})
