import pytest

from recce.tasks import ValueDiffDetailTask, ValueDiffTask

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
    params = {"model": "customers_cols", "primary_key": ["customer_id"], "columns": ["name"]}
    task = ValueDiffTask(params)
    run_result = task.execute()
    # Only customer_id and name columns in result
    assert len(run_result.data.data) == 2  # customer_id + name

    # Compare 'age' column (should show mismatch for id=1)
    params = {"model": "customers_cols", "primary_key": ["customer_id"], "columns": ["age"]}
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
