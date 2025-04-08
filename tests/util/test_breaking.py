import textwrap
import unittest

from deepdiff import DeepDiff

from recce.util.breaking import parse_change_category, ColumnChangeStatus

SOURCE_SCHEMA = {
    'Customers': {
        'id': 'int',
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
        dialect=dialect
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
        dialect=dialect
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
    dialect=None
):
    result = parse_change_category(
        original_sql,
        modified_sql,
        old_schema=SOURCE_SCHEMA,
        new_schema=SOURCE_SCHEMA,
        dialect=dialect
    )
    if result.category != 'non_breaking':
        return False

    if expected_changed_columns is not None:
        diff = DeepDiff(expected_changed_columns, result.changed_columns, ignore_order=True)
        if len(diff) > 0:
            return False

    return True


class BreakingChangeTest(unittest.TestCase):
    def test_non_breaking_identical(self):
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
        assert is_non_breaking_change(original_sql, modified_sql, {})
        assert is_non_breaking_change(original_sql, textwrap.dedent(modified_sql), {})

    def test_non_breaking_add_column(self):
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
        assert is_non_breaking_change(original_sql, modified_sql, {'b': 'added'})

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

    def test_partial_breaking_rename_column(self):
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

    def test_partial_breaking_remove_column(self):
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

    def test_non_breaking_change_reorder(self):
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

    def test_non_breaking_add_column_by_case_when(self):
        original_sql = """
        select
            a
        from Customers
        """
        modified_sql = """
        select
            a,
            case when a > 100 then 1 else 0 end as b
        from Customers
        """
        assert is_non_breaking_change(original_sql, modified_sql)

    def test_partial_breaking_change_column_cte(self):
        original_sql = """
        with cte as (
        select
            a,
            case when a > 100 then 1 else 0 end as b
        from Customers
        )
        select cte.a, cte.b from cte
        """
        modified_sql = """
        with cte as (
        select
            a,
            case when a > 200 then 1 else 0 end as b
        from Customers
        )
        select cte.a, cte.b from cte
        """
        assert is_partial_breaking_change(original_sql, modified_sql, {'b': 'modified'})

    def test_breaking_add_filter(self):
        original_sql = """
        select
            a
        from Customers
        """
        modified_sql = """
        select
            a
        from Customers
        where a > 100
        """
        assert is_breaking_change(original_sql, modified_sql)

    def test_breaking_add_filter_local(self):
        original_sql = """
        select
            a
        from Customers
        where b > 100
        """
        modified_sql = """
        select
            a + 1 as a
        from Customers
        where b > 100
        """
        assert is_partial_breaking_change(original_sql, modified_sql)

        original_sql = """
        select
            a
        from Customers
        where a > 100
        """
        modified_sql = """
        select
            a + 1 as a
        from Customers
        where a > 100
        """
        # The 'a' in where clause is use the 'Customers.a' not the 'a + 1 as a'
        assert is_partial_breaking_change(original_sql, modified_sql)

        original_sql = """
        select
            a as b
        from Customers
        where b > 100
        """
        modified_sql = """
        select
            a + 1 as b
        from Customers
        where b > 100
        """
        # The 'b' in where clause is use the 'Customers.b' not the 'a + 1 as b'
        assert is_partial_breaking_change(original_sql, modified_sql)

    def test_breaking_change_filter(self):
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

    def test_breaking_add_limit(self):
        original_sql = """
        select
            a
        from Customers
        """
        modified_sql = """
        select
            a
        from Customers
        limit 100
        """
        assert is_breaking_change(original_sql, modified_sql)

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
        original_sql = """
        select
            a
        from
        """

        malformed_sql = """
        selects
            a
        from Customers
        """

        assert is_breaking_change(original_sql, malformed_sql)

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
