from unittest.mock import MagicMock, patch

import pytest

from recce.tasks import ValueDiffDetailTask, ValueDiffTask
from recce.tasks.valuediff import ValueDiffMixin

# =============================================================================
# ValueDiffTask Tests (_query_value_diff for summary statistics)
# =============================================================================


def test_value_diff(dbt_test_helper):
    """Basic test: one row has a value change (age: 35 -> 30)"""
    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    csv_data_base = """
        customer_id,name,age
        1,Alice,35
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    params = {"model": "customers", "primary_key": ["customer_id"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert len(run_result.data.columns) == 3
    assert len(run_result.data.data) == 3

    params = {"model": "customers", "primary_key": ["customer_id"]}
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    assert len(run_result.columns) == 5
    assert len(run_result.data) == 2


def test_value_diff_identical_data(dbt_test_helper):
    """When base and current are identical, diff should be empty."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("identical_customers", csv_data, csv_data)

    # ValueDiffTask should show 100% match
    params = {"model": "identical_customers", "primary_key": ["customer_id"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0
    # All rows should be matched
    for row in run_result.data.data:
        column_name, matched, matched_p = row
        assert matched_p == 1.0  # 100% match

    # ValueDiffDetailTask should return empty diff (no changed rows)
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    assert len(run_result.data) == 0


def test_value_diff_added_rows(dbt_test_helper):
    """Test detection of rows added in current (not in base).

    ValueDiffTask summary counts rows with matching PKs in both tables.
    Added/removed rows show up in the per-column statistics and ValueDiffDetailTask.
    """
    csv_data_base = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("customers_added", csv_data_base, csv_data_curr)

    params = {"model": "customers_added", "primary_key": ["customer_id"]}

    # ValueDiffTask summary should detect the added row
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.total == 3
    assert run_result.summary.added == 1
    assert run_result.summary.removed == 0

    # ValueDiffDetailTask should show the added row
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    assert len(run_result.data) == 1
    # Check in_a/in_b flags - added row should have in_a=False, in_b=True
    row = run_result.data[0]
    in_a_idx = next(i for i, c in enumerate(run_result.columns) if c.key.lower() == "in_a")
    in_b_idx = next(i for i, c in enumerate(run_result.columns) if c.key.lower() == "in_b")
    assert row[in_a_idx] is False
    assert row[in_b_idx] is True


def test_value_diff_removed_rows(dbt_test_helper):
    """Test detection of rows removed in current (present in base only).

    ValueDiffTask summary counts rows with matching PKs in both tables.
    Added/removed rows show up in ValueDiffDetailTask.
    """
    csv_data_base = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    dbt_test_helper.create_model("customers_removed", csv_data_base, csv_data_curr)

    params = {"model": "customers_removed", "primary_key": ["customer_id"]}

    # ValueDiffTask summary should detect the removed row
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.total == 3
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 1

    # ValueDiffDetailTask should show the removed row
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    assert len(run_result.data) == 1
    # Check in_a/in_b flags - removed row should have in_a=True, in_b=False
    row = run_result.data[0]
    in_a_idx = next(i for i, c in enumerate(run_result.columns) if c.key.lower() == "in_a")
    in_b_idx = next(i for i, c in enumerate(run_result.columns) if c.key.lower() == "in_b")
    assert row[in_a_idx] is True
    assert row[in_b_idx] is False


def test_value_diff_modified_rows(dbt_test_helper):
    """Test detection of rows with value changes."""
    csv_data_base = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    csv_data_curr = """
        customer_id,name,age
        1,Alice,31
        2,Bobby,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("customers_modified", csv_data_base, csv_data_curr)

    params = {"model": "customers_modified", "primary_key": ["customer_id"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0
    # Should have some mismatched columns (age for id=1, name for id=2)

    # Detail should show 4 rows (2 pairs for modified rows: old + new values)
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    # Each modified row appears twice (once in_a=True,in_b=False and once in_a=False,in_b=True)
    assert len(run_result.data) == 4


def test_value_diff_composite_primary_key(dbt_test_helper):
    """Test with composite (multi-column) primary key."""
    csv_data_base = """
        region,customer_id,name,revenue
        US,1,Alice,100
        US,2,Bob,200
        EU,1,Charlie,150
        """

    csv_data_curr = """
        region,customer_id,name,revenue
        US,1,Alice,100
        US,2,Bob,250
        EU,1,Charlie,150
        """

    dbt_test_helper.create_model("customers_composite", csv_data_base, csv_data_curr)

    # Use composite primary key
    params = {"model": "customers_composite", "primary_key": ["region", "customer_id"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0

    # Check primary_key was preserved as list
    assert isinstance(task.params.primary_key, list)
    assert len(task.params.primary_key) == 2

    # Detail task
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    # One row modified (US,2 has revenue change)
    assert len(run_result.data) == 2  # pair of rows for the modified record


def test_value_diff_single_primary_key_string(dbt_test_helper):
    """Test with single primary key passed as string (not list)."""
    csv_data_base = """
        id,value
        1,100
        2,200
        """

    csv_data_curr = """
        id,value
        1,100
        2,250
        """

    dbt_test_helper.create_model("single_pk", csv_data_base, csv_data_curr)

    # Pass primary_key as string, not list
    params = {"model": "single_pk", "primary_key": "id"}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0

    # Primary key should be normalized to string (not list) when passed as string
    assert isinstance(task.params.primary_key, str)


def test_value_diff_selected_columns(dbt_test_helper):
    """Test diffing only specific columns."""
    csv_data_base = """
        customer_id,name,age,city
        1,Alice,30,NYC
        2,Bob,25,LA
        """

    csv_data_curr = """
        customer_id,name,age,city
        1,Alice,31,NYC
        2,Bob,25,SF
        """

    dbt_test_helper.create_model("customers_cols", csv_data_base, csv_data_curr)

    # Only compare 'name' column (should show 100% match)
    params = {
        "model": "customers_cols",
        "primary_key": ["customer_id"],
        "columns": ["name"],
    }
    task = ValueDiffTask(params)
    run_result = task.execute()
    # Only customer_id and name columns in result
    assert len(run_result.data.data) == 2  # customer_id + name

    # Compare 'age' column (should show mismatch for id=1)
    params = {
        "model": "customers_cols",
        "primary_key": ["customer_id"],
        "columns": ["age"],
    }
    task = ValueDiffTask(params)
    run_result = task.execute()
    # Find the age row and check it's not 100% matched
    age_row = next((r for r in run_result.data.data if r[0] == "age"), None)
    assert age_row is not None
    assert age_row[2] < 1.0  # matched_p < 100%


def test_value_diff_with_nulls(dbt_test_helper):
    """Test handling of NULL values."""
    csv_data_base = """
        customer_id,name,age
        1,Alice,30
        2,,25
        3,Charlie,
        """

    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("customers_nulls", csv_data_base, csv_data_curr)

    params = {"model": "customers_nulls", "primary_key": ["customer_id"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    # Row count should be correct
    assert run_result.summary.total == 3

    # Detail should show changed rows
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    # Rows 2 and 3 have changes (null to value)
    assert len(run_result.data) >= 2


def test_value_diff_skips_column_named_column_name(dbt_test_helper):
    """Test that a column literally named 'column_name' is skipped without aborting.

    The header-row guard (``if row[0].lower() == "column_name"``) should
    ``continue`` past rows for that column while still processing the
    remaining columns correctly.
    """
    csv_data_base = """
        id,column_name,value
        1,foo,100
        2,bar,200
        """

    csv_data_curr = """
        id,column_name,value
        1,foo,100
        2,bar,300
        """

    dbt_test_helper.create_model("tricky_col", csv_data_base, csv_data_curr)

    params = {"model": "tricky_col", "primary_key": ["id"]}
    task = ValueDiffTask(params)
    run_result = task.execute()

    # The 'value' column should still be processed (1 mismatch out of 2 rows)
    assert run_result.summary.total == 2
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0


# Note: Empty table tests (test_value_diff_empty_base, test_value_diff_empty_current)
# are skipped because DuckDB cannot infer column types from empty CSVs (headers only),
# causing type conversion errors during SQL execution.


def test_value_diff_digit_starting_column(dbt_test_helper):
    """Test that columns starting with digits are properly quoted in SQL.

    Regression test for GitHub #1311 / DRC-3247: column names like '47_1_TransId'
    must be quoted in generated SQL, otherwise the parser reads '47' as a numeric
    literal and fails.
    """
    csv_data_base = """
        47_1_TransId,name,age
        1,Alice,30
        2,Bob,25
        """

    csv_data_curr = """
        47_1_TransId,name,age
        1,Alice,31
        2,Bob,25
        """

    dbt_test_helper.create_model("digit_col", csv_data_base, csv_data_curr)

    # ValueDiffTask with digit-starting primary key
    params = {"model": "digit_col", "primary_key": ["47_1_TransId"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.total == 2
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0

    # ValueDiffDetailTask with digit-starting primary key
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    # Row 1 has age change (30 -> 31), should appear as 2 detail rows
    assert len(run_result.data) == 2


def test_value_diff_digit_starting_composite_key(dbt_test_helper):
    """Test composite primary key with digit-starting columns."""
    csv_data_base = """
        47_1_TransId,2nd_key,value
        1,A,100
        2,B,200
        """

    csv_data_curr = """
        47_1_TransId,2nd_key,value
        1,A,100
        2,B,250
        """

    dbt_test_helper.create_model("digit_composite", csv_data_base, csv_data_curr)

    params = {"model": "digit_composite", "primary_key": ["47_1_TransId", "2nd_key"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert run_result.summary.total == 2
    assert run_result.summary.added == 0
    assert run_result.summary.removed == 0

    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    assert len(run_result.data) == 2


# =============================================================================
# Validator Tests
# =============================================================================


def test_validator():
    from recce.tasks.valuediff import ValueDiffCheckValidator

    def validate(params=None, view_options=None):
        if view_options is None:
            view_options = {}
        if params is None:
            params = {}
        ValueDiffCheckValidator().validate(
            {
                "name": "test",
                "type": "value_diff",
                "params": params,
                "view_options": view_options,
            }
        )

    validate(
        {
            "model": "customers",
            "primary_key": "customer_id",
        }
    )
    validate(
        {
            "model": "customers",
            "primary_key": ["customer_id"],
        }
    )
    validate(
        {
            "model": "customers",
            "primary_key": ["customer_id"],
            "columns": ["name", "age"],
        }
    )

    with pytest.raises(ValueError):
        validate({})

    with pytest.raises(ValueError):
        validate(
            {
                "model": "customers",
            }
        )

    with pytest.raises(ValueError):
        validate(
            {
                "model": "customers",
                "primary_key": ["customer_id"],
                "columns": "name",
            }
        )


# =============================================================================
# Snowflake column-case regression tests (DRC-3464)
#
# Root cause: ValueDiffTask / ValueDiffDetailTask passed user-supplied lowercase
# column names (e.g. "customer_id") directly to adapter.quote(), producing the
# case-sensitive quoted identifier '"customer_id"'.  On Snowflake with default
# quoting config, physical columns are stored uppercase (CUSTOMER_ID), so the
# quoted lowercase identifier fails with:
#   "SQL compilation error: invalid identifier '"customer_id"'"
#
# Fix: _build_column_case_lookup() maps each user-supplied identifier through a
# {lower(physical_name): physical_name} lookup built from get_columns() before
# any adapter.quote() call is made.
# =============================================================================


def _make_uppercase_column(name: str):
    """Return a mock Column object with .column = name (simulates Snowflake get_columns output)."""
    col = MagicMock()
    col.column = name
    col.name = name
    return col


class TestBuildColumnCaseLookup:
    """Unit tests for ValueDiffMixin._build_column_case_lookup."""

    def test_returns_uppercase_to_physical_mapping(self):
        """get_columns() returning uppercase names builds a lower→physical lookup."""
        dbt_adapter = MagicMock()
        dbt_adapter.get_columns.return_value = [
            _make_uppercase_column("CUSTOMER_ID"),
            _make_uppercase_column("CUSTOMER_LIFETIME_VALUE"),
        ]

        lookup = ValueDiffMixin._build_column_case_lookup(dbt_adapter, "customers")

        assert lookup["customer_id"] == "CUSTOMER_ID"
        assert lookup["customer_lifetime_value"] == "CUSTOMER_LIFETIME_VALUE"

    def test_gracefully_handles_get_columns_failure(self):
        """A failing get_columns() call returns an empty lookup (pass-through behaviour)."""
        dbt_adapter = MagicMock()
        dbt_adapter.get_columns.side_effect = Exception("relation not found")

        lookup = ValueDiffMixin._build_column_case_lookup(dbt_adapter, "missing_model")

        assert lookup == {}

    def test_normalise_identifier_maps_lowercase_to_physical(self):
        mixin = ValueDiffTask.__new__(ValueDiffTask)
        lookup = {"customer_id": "CUSTOMER_ID", "name": "NAME"}

        assert mixin._normalise_identifier("customer_id", lookup) == "CUSTOMER_ID"
        assert mixin._normalise_identifier("CUSTOMER_ID", lookup) == "CUSTOMER_ID"

    def test_normalise_identifier_passthrough_for_unknown(self):
        """Identifiers not in the catalog are returned unchanged."""
        mixin = ValueDiffTask.__new__(ValueDiffTask)
        lookup = {"customer_id": "CUSTOMER_ID"}

        assert mixin._normalise_identifier("unknown_col", lookup) == "unknown_col"


def test_value_diff_snowflake_uppercase_columns(dbt_test_helper):
    """Regression test for DRC-3464: value_diff with Snowflake uppercase physical columns.

    When get_columns() returns uppercase names (as Snowflake does with default quoting),
    user-supplied lowercase primary_key/columns must be normalised to uppercase before
    adapter.quote() is called — producing '"CUSTOMER_ID"' not '"customer_id"'.

    This test patches get_columns() to return uppercase names and captures the SQL
    rendered by _query_value_diff to assert the quoted identifiers are uppercase.

    Pre-fix assertion (would fail WITHOUT the _build_column_case_lookup normalisation):
      '"customer_id"' in sql  → True  (broken — Snowflake rejects this)

    Post-fix assertion (MUST pass WITH the fix):
      '"CUSTOMER_ID"' in sql  → True
      '"customer_id"' not in sql  → True
    """
    csv_data = """
        customer_id,customer_lifetime_value
        1,100
        2,200
        """
    dbt_test_helper.create_model("snowflake_customers", csv_data, csv_data)

    # Patch get_columns to return uppercase column names (simulating Snowflake INFORMATION_SCHEMA)
    uppercase_cols = [
        _make_uppercase_column("CUSTOMER_ID"),
        _make_uppercase_column("CUSTOMER_LIFETIME_VALUE"),
    ]

    captured_sqls = []
    real_execute = dbt_test_helper.adapter.execute

    def capture_execute(sql, *args, **kwargs):
        captured_sqls.append(sql)
        return real_execute(sql, *args, **kwargs)

    with (
        patch.object(dbt_test_helper.adapter, "get_columns", return_value=uppercase_cols),
        patch.object(dbt_test_helper.adapter, "execute", side_effect=capture_execute),
    ):
        params = {
            "model": "snowflake_customers",
            "primary_key": "customer_id",
            "columns": ["customer_id", "customer_lifetime_value"],
        }
        task = ValueDiffTask(params)
        task.execute()

    # The surrogate-key SQL and column comparison SQL must use uppercase quoted identifiers
    all_sql = "\n".join(captured_sqls)
    assert '"CUSTOMER_ID"' in all_sql, (
        "Fix regression: adapter.quote() must receive uppercase 'CUSTOMER_ID' not lowercase 'customer_id'. "
        "DRC-3464: _build_column_case_lookup must normalise before quoting."
    )
    assert '"customer_id"' not in all_sql, (
        "Fix regression: quoted lowercase '\"customer_id\"' found in SQL — "
        "this would cause 'invalid identifier' on Snowflake with default quoting config."
    )


def test_value_diff_detail_snowflake_uppercase_columns(dbt_test_helper):
    """Regression test for DRC-3464: ValueDiffDetailTask with Snowflake uppercase columns.

    Same root cause as test_value_diff_snowflake_uppercase_columns but exercises
    the ValueDiffDetailTask._query_value_diff path (lines 387, 391 in original).
    """
    csv_data = """
        customer_id,customer_lifetime_value
        1,100
        2,200
        """
    dbt_test_helper.create_model("snowflake_customers_detail", csv_data, csv_data)

    uppercase_cols = [
        _make_uppercase_column("CUSTOMER_ID"),
        _make_uppercase_column("CUSTOMER_LIFETIME_VALUE"),
    ]

    captured_sqls = []
    real_execute = dbt_test_helper.adapter.execute

    def capture_execute(sql, *args, **kwargs):
        captured_sqls.append(sql)
        return real_execute(sql, *args, **kwargs)

    with (
        patch.object(dbt_test_helper.adapter, "get_columns", return_value=uppercase_cols),
        patch.object(dbt_test_helper.adapter, "execute", side_effect=capture_execute),
    ):
        params = {
            "model": "snowflake_customers_detail",
            "primary_key": ["customer_id"],
            "columns": ["customer_id", "customer_lifetime_value"],
        }
        task = ValueDiffDetailTask(params)
        task.execute()

    all_sql = "\n".join(captured_sqls)
    assert (
        '"CUSTOMER_ID"' in all_sql
    ), "Fix regression: ValueDiffDetailTask must use uppercase quoted identifier. DRC-3464."
    assert (
        '"customer_id"' not in all_sql
    ), "Fix regression: quoted lowercase '\"customer_id\"' found — breaks Snowflake default quoting. DRC-3464."


def test_value_diff_snowflake_composite_primary_key(dbt_test_helper):
    """Regression test for DRC-3464 cycle 1: composite primary_key on Snowflake.

    When primary_key is a list (composite key) and get_columns() returns uppercase
    names (Snowflake default), _verify_primary_key must receive normalised
    (uppercase) identifiers so its inline Jinja SQL uses '"CUSTOMER_ID"' not
    '"customer_id"'.

    PRE-FIX (commit 0da517ad): _verify_primary_key received the original lowercase
    list and called adapter.quote(col) directly → SQL contained '"customer_id"',
    '"order_id"' → Snowflake invalid identifier error.

    POST-FIX: execute() builds case_lookup and normalises primary_key BEFORE
    calling _verify_primary_key → SQL contains '"CUSTOMER_ID"', '"ORDER_ID"'.

    Note: _verify_primary_key now calls dbt_adapter.execute (the DbtAdapter wrapper),
    which forwards to dbt_adapter.adapter.execute (the low-level dbt adapter).
    Patching the low-level adapter still intercepts the call because the wrapper
    delegates straight through.
    """
    csv_data = """
        customer_id,order_id,amount
        1,101,500
        2,102,300
        """
    dbt_test_helper.create_model("snowflake_composite", csv_data, csv_data)

    uppercase_cols = [
        _make_uppercase_column("CUSTOMER_ID"),
        _make_uppercase_column("ORDER_ID"),
        _make_uppercase_column("AMOUNT"),
    ]

    captured_sqls = []
    # _verify_primary_key calls dbt_adapter.execute (the wrapper) which forwards to
    # dbt_adapter.adapter.execute (the low-level adapter). Patch the low-level so we
    # capture the composite-key verification SQL regardless of the wrapper layer.
    real_low_level_execute = dbt_test_helper.adapter.adapter.execute

    def capture_low_level_execute(sql, *args, **kwargs):
        captured_sqls.append(sql)
        return real_low_level_execute(sql, *args, **kwargs)

    with (
        patch.object(dbt_test_helper.adapter, "get_columns", return_value=uppercase_cols),
        patch.object(dbt_test_helper.adapter.adapter, "execute", side_effect=capture_low_level_execute),
    ):
        params = {
            "model": "snowflake_composite",
            "primary_key": ["customer_id", "order_id"],
        }
        task = ValueDiffTask(params)
        task.execute()

    # The _verify_primary_key SQL must quote the composite PK columns in uppercase.
    # We look specifically for the validation_errors CTE that _verify_primary_key generates.
    verify_sqls = [s for s in captured_sqls if "validation_errors" in s]
    assert verify_sqls, (
        "DRC-3464 cycle 1: no validation_errors SQL captured — _verify_primary_key "
        "did not execute for composite primary_key."
    )
    all_verify_sql = "\n".join(verify_sqls)
    assert '"CUSTOMER_ID"' in all_verify_sql, (
        "DRC-3464 cycle 1: composite PK _verify_primary_key must use uppercase "
        "'CUSTOMER_ID' not lowercase 'customer_id' on Snowflake."
    )
    assert '"ORDER_ID"' in all_verify_sql, (
        "DRC-3464 cycle 1: composite PK _verify_primary_key must use uppercase "
        "'ORDER_ID' not lowercase 'order_id' on Snowflake."
    )
    assert '"customer_id"' not in all_verify_sql, (
        "DRC-3464 cycle 1: quoted lowercase '\"customer_id\"' found in _verify_primary_key SQL — "
        "execute() must normalise composite PK before passing to _verify_primary_key."
    )
    assert '"order_id"' not in all_verify_sql, (
        "DRC-3464 cycle 1: quoted lowercase '\"order_id\"' found in _verify_primary_key SQL — "
        "execute() must normalise composite PK before passing to _verify_primary_key."
    )


def test_value_diff_detail_snowflake_composite_primary_key(dbt_test_helper):
    """Regression test for DRC-3464 cycle 1: ValueDiffDetailTask with composite PK.

    Same root cause as test_value_diff_snowflake_composite_primary_key but exercises
    ValueDiffDetailTask.execute() → _verify_primary_key → _query_value_diff.
    """
    csv_data = """
        customer_id,order_id,amount
        1,101,500
        2,102,300
        """
    dbt_test_helper.create_model("snowflake_composite_detail", csv_data, csv_data)

    uppercase_cols = [
        _make_uppercase_column("CUSTOMER_ID"),
        _make_uppercase_column("ORDER_ID"),
        _make_uppercase_column("AMOUNT"),
    ]

    captured_sqls = []
    real_low_level_execute = dbt_test_helper.adapter.adapter.execute

    def capture_low_level_execute(sql, *args, **kwargs):
        captured_sqls.append(sql)
        return real_low_level_execute(sql, *args, **kwargs)

    with (
        patch.object(dbt_test_helper.adapter, "get_columns", return_value=uppercase_cols),
        patch.object(dbt_test_helper.adapter.adapter, "execute", side_effect=capture_low_level_execute),
    ):
        params = {
            "model": "snowflake_composite_detail",
            "primary_key": ["customer_id", "order_id"],
        }
        task = ValueDiffDetailTask(params)
        task.execute()

    verify_sqls = [s for s in captured_sqls if "validation_errors" in s]
    assert verify_sqls, (
        "DRC-3464 cycle 1: no validation_errors SQL captured — _verify_primary_key "
        "did not execute for composite primary_key."
    )
    all_verify_sql = "\n".join(verify_sqls)
    assert '"CUSTOMER_ID"' in all_verify_sql, (
        "DRC-3464 cycle 1: ValueDiffDetailTask composite PK must use uppercase " "'CUSTOMER_ID' on Snowflake."
    )
    assert '"ORDER_ID"' in all_verify_sql, (
        "DRC-3464 cycle 1: ValueDiffDetailTask composite PK must use uppercase " "'ORDER_ID' on Snowflake."
    )
    assert '"customer_id"' not in all_verify_sql, (
        "DRC-3464 cycle 1: quoted lowercase '\"customer_id\"' found in _verify_primary_key SQL — "
        "ValueDiffDetailTask execute() must normalise composite PK before _verify_primary_key."
    )
    assert '"order_id"' not in all_verify_sql, (
        "DRC-3464 cycle 1: quoted lowercase '\"order_id\"' found in _verify_primary_key SQL — "
        "ValueDiffDetailTask execute() must normalise composite PK before _verify_primary_key."
    )
