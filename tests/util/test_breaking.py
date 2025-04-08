import textwrap
import unittest

from recce.util.breaking import is_breaking_change, parse_change_category


class BreakingChangeTest(unittest.TestCase):
    def test_non_breaking_identical(self):
        original_sql = """
        select
            a, b
        from MyTable
        """
        modified_sql = """
        select
            a,
            b
        from MyTable
        """
        assert not is_breaking_change(original_sql, modified_sql)
        assert not is_breaking_change(original_sql, textwrap.dedent(modified_sql))

    def test_non_breaking_add_column(self):
        original_sql = """
        select
            a
        from MyTable
        """
        modified_sql = """
        select
            a, b
        from MyTable
        """
        assert not is_breaking_change(original_sql, modified_sql)

        # by cte
        original_sql = """
        with cte as (
            select
                a
            from MyTable
        )
        select
            a
        from cte
        """
        modified_sql = """
        with cte as (
            select
                a, b
            from MyTable
        )
        select
            a, b
        from cte
        """
        assert not is_breaking_change(original_sql, modified_sql)

    def test_partial_breaking_rename_column(self):
        original_sql = """
        select
            a
        from MyTable
        """
        modified_sql = """
        select
            a as a2
        from MyTable
        """
        result = parse_change_category(original_sql, modified_sql)
        assert result.category == 'partial_breaking'

        # by cte
        original_sql = """
        with cte as (
            select
                a,
                b
            from MyTable
        )
        select
            a
        from cte
        """
        modified_sql = """
        with cte as (
            select
                a as a2,
                b
            from MyTable
        )
        select
            a2
        from cte
        """
        result = parse_change_category(original_sql, modified_sql)
        assert result.category == 'partial_breaking'

    def test_partial_breaking_remove_column(self):
        original_sql = """
        select
            a,
            b
        from MyTable
        """
        modified_sql = """
        select
            b
        from MyTable
        """
        result = parse_change_category(original_sql, modified_sql)
        assert result.category == 'partial_breaking'

    def test_non_breaking_change_reorder(self):
        original_sql = """
        select
            a,
            b
        from MyTable
        """
        modified_sql = """
        select
            b,
            a
        from MyTable
        """
        assert not is_breaking_change(original_sql, modified_sql)

    def test_non_breaking_add_column_by_case_when(self):
        original_sql = """
        select
            a
        from MyTable
        """
        modified_sql = """
        select
            a,
            case when a > 100 then 1 else 0 end as b
        from MyTable
        """
        assert not is_breaking_change(original_sql, modified_sql)

    def test_partial_breaking_change_column(self):
        original_sql = """
        with cte as (
        select
            a,
            case when a > 100 then 1 else 0 end as b
        from MyTable
        )
        select cte.a, cte.b from cte
        """
        modified_sql = """
        with cte as (
        select
            a,
            case when a > 200 then 1 else 0 end as b
        from MyTable
        )
        select cte.a, cte.b from cte
        """
        result = parse_change_category(original_sql, modified_sql)
        assert result.category == 'partial_breaking'

    def test_breaking_add_filter(self):
        original_sql = """
        select
            a
        from MyTable
        """
        modified_sql = """
        select
            a
        from MyTable
        where a > 100
        """
        assert is_breaking_change(original_sql, modified_sql)

    def test_breaking_change_filter(self):
        original_sql = """
        select
            a
        from MyTable
        where a > 100
        """
        modified_sql = """
        select
            a
        from MyTable
        where a > 101
        """
        assert is_breaking_change(original_sql, modified_sql)

    def test_breaking_add_limit(self):
        original_sql = """
        select
            a
        from MyTable
        """
        modified_sql = """
        select
            a
        from MyTable
        limit 100
        """
        assert is_breaking_change(original_sql, modified_sql)

    def test_cte_with_select_star(self):
        original_sql = """
        with cte as (
            select
                a, b, c
            from MyTable
        )
        select
            *
        from cte
        """
        modified_sql = """
        with cte as (
            select
                a
            from MyTable
        )
        select
            *
        from cte
        """
        # assert is_breaking_change(original_sql, modified_sql)
        modified_sql = """
            with cte as (
                select
                    a,b,c,d
                from MyTable
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
        from MyTable
        """

        assert is_breaking_change(original_sql, malformed_sql)

    def test_unnest_function(self):
        original_sql = """
        select
            a
        from MyTable
        """
        modified_sql = """
        select
            a,
            unnest(a) as b
        from MyTable
        """
        assert is_breaking_change(original_sql, modified_sql)

    def test_dialect(self):
        original_sql = """
        SELECT
            a
        FROM MyTable
        """
        modified_sql = """
        SELECT
           a,
           b,
        FROM MyTable
        """

        assert not is_breaking_change(original_sql, modified_sql, dialect='duckdb')
        assert not is_breaking_change(original_sql, modified_sql, dialect='xyz')
        assert not is_breaking_change(original_sql, modified_sql, dialect=None)

    def test_pr42(self):
        original_sql = """
        with source as (
            select * from MyTable
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
            select * from MyTable
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
        assert not is_breaking_change(original_sql, modified_sql)
