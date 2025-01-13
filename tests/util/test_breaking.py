import textwrap

from recce.util.breaking import is_breaking_change


def test_no_change():
    original_sql = """
    select
        a, b
    from MyTable
    """
    modified_sql = """
    select
        a, b
    from MyTable
    """
    assert not is_breaking_change(original_sql, modified_sql)
    assert not is_breaking_change(original_sql, textwrap.dedent(modified_sql))


def test_non_breaking_change():
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


def test_breaking_change():
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
    assert is_breaking_change(original_sql, modified_sql)
    modified_sql = """
        select
            b
        from MyTable
        """
    assert is_breaking_change(original_sql, modified_sql)
    modified_sql = """
            select
                a
            from MyTable
            where a > 100
            """
    assert is_breaking_change(original_sql, modified_sql)
    modified_sql = """
                select
                    a
                from MyTable
                limit 100
                """
    assert is_breaking_change(original_sql, modified_sql)


def test_cte():
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
        a
    from cte
    """
    assert not is_breaking_change(original_sql, modified_sql)
    modified_sql = """
    with cte as (
        select
            a
        from MyTable
    )
    select
        a, b
    from cte
    """
    assert not is_breaking_change(original_sql, modified_sql)
    # test a breaking case by a where filter in cte
    modified_sql = """
    with cte as (
        select
            a
        from MyTable
        where a > 100
    )
    select
        a
    from cte
    """


def test_cte_with_select_star():
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
    assert is_breaking_change(original_sql, modified_sql)
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


def test_non_sql():
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
