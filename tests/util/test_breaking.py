import textwrap
import unittest

from deepdiff import DeepDiff

from recce.util.breaking import parse_change_category, ColumnChangeStatus

SOURCE_SCHEMA = {
    'Customers': {
        'customer_id': 'int',
        'a': 'int',
        'b': 'int',
        'c': 'int',
        'd': 'int'
    },
    'Orders': {
        'order_id': 'int',
        'customer_id': 'int',
        'w': 'int',
        'x': 'int',
        'y': 'int',
        'z': 'int'
    },
}


def is_breaking_change(original_sql, modified_sql, dialect=None):
    result = parse_change_category(
        original_sql,
        modified_sql,
        old_schema=SOURCE_SCHEMA,
        new_schema=SOURCE_SCHEMA,
        dialect=dialect,
        unit_test=True,
    )
    return result.category == 'breaking'


def is_partial_breaking_change(
    original_sql,
    modified_sql,
    expected_changed_columns: dict[str, ColumnChangeStatus] = None,
    dialect=None
):
    result = parse_change_category(
        original_sql,
        modified_sql,
        old_schema=SOURCE_SCHEMA,
        new_schema=SOURCE_SCHEMA,
        dialect=dialect,
        unit_test=True,
    )
    if result.category != 'partial_breaking':
        return False

    if expected_changed_columns is not None:
        diff = DeepDiff(expected_changed_columns, result.changed_columns, ignore_order=True)
        if len(diff) > 0:
            return False

    return True


def is_non_breaking_change(
    original_sql,
    modified_sql,
    expected_changed_columns: dict[str, ColumnChangeStatus] = None,
    dialect=None,
):
    result = parse_change_category(
        original_sql,
        modified_sql,
        old_schema=SOURCE_SCHEMA,
        new_schema=SOURCE_SCHEMA,
        dialect=dialect,
        unit_test=True,
    )
    if result.category != 'non_breaking':
        return False

    if expected_changed_columns is not None:
        diff = DeepDiff(expected_changed_columns, result.changed_columns, ignore_order=True)
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
        --- thie is comment
        select
            a,
            b
        from Customers
        """
        assert is_non_breaking_change(original_sql, modified_sql, {})
        assert is_non_breaking_change(original_sql, modified_sql2, {})
        assert is_non_breaking_change(original_sql, textwrap.dedent(modified_sql), {})

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
        assert is_non_breaking_change(original_sql, modified_sql, {'b': 'added'})
        assert is_non_breaking_change(original_sql, modified_sql2, {'a2': 'added'})
        assert is_non_breaking_change(original_sql, modified_sql3, {'a2': 'added'})

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
        assert is_non_breaking_change(original_sql, modified_sql, {'b': 'added'})

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
        assert is_partial_breaking_change(original_sql, modified_sql, {'a': 'removed', 'a1': 'added', })

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
        assert is_partial_breaking_change(original_sql, modified_sql, {'a': 'removed', 'a1': 'added', })

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
        assert is_partial_breaking_change(original_sql, modified_sql, {'a': 'removed'})

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
        original_sql = """
        select
            case when a > 100 then 1 else 0 end as a2,
        from Customers
        """
        modified_sql = """
        select
            case when a > 101 then 1 else 0 end as a2,
        from Customers
        """
        assert is_partial_breaking_change(original_sql, modified_sql, {'a2': 'modified'})

    def test_change_column_in_cte(self):
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
        assert is_non_breaking_change(original, modified1, {'order_amount': 'added'})
        assert is_partial_breaking_change(original, modified2, {'order_count': 'removed'})
        assert is_partial_breaking_change(original, modified3, {'order_count': 'modified'})

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
            original, modified,
            {
                'a2': 'modified',
                'b': 'added',
                'c': 'removed',
                'order_amount': 'added'
            })

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
            a
        from Customers
        group by a
        """
        modified = """
        select
            a
        from Customers
        where a + 1
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
        assert is_partial_breaking_change(original_sql, modified_sql, {'b': 'removed'})
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
        assert parse_change_category(malformed1, malformed2).category == 'unknown'

    def test_unnest_function(self):
        original_sql = """
        select
            a
        from Customers
        """
        modified_sql = """
        select
            a,
            unnest(a) as b
        from Customers
        """
        assert is_breaking_change(original_sql, modified_sql)

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
        assert is_non_breaking_change(original_sql, modified_sql, dialect='xyz')
        for dialect in ['snowflake', 'bigquery', 'redshift', 'duckdb']:
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
