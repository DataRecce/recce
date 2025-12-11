import pytest

from recce.tasks import QueryDiffTask, QueryTask

# =============================================================================
# QueryTask Tests (single environment query)
# =============================================================================


def test_query(dbt_test_helper):
    """Basic QueryTask test - executes query on current environment."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("customers", csv_data, csv_data)
    params = {"sql_template": 'select * from {{ ref("customers") }}'}
    task = QueryTask(params)
    run_result = task.execute()
    assert len(run_result.data) == 3


# =============================================================================
# _query_diff Tests (no primary_keys - client-side diff)
# =============================================================================


def test_query_diff_in_client(dbt_test_helper):
    """Basic _query_diff test - returns base and current DataFrames."""
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
    params = {"sql_template": 'select * from {{ ref("customers") }}'}
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 3
    assert len(run_result.current.data) == 3
    # No diff result when no primary_keys
    assert run_result.diff is None


def test_query_diff_in_client_with_base_sql_template(dbt_test_helper):
    """Test _query_diff with different SQL for base vs current."""
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
    params = {
        "base_sql_template": 'select * from {{ ref("customers") }} where customer_id <= 2',
        "sql_template": 'select * from {{ ref("customers") }}',
    }
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 2
    assert len(run_result.current.data) == 3


def test_query_diff_in_client_identical_data(dbt_test_helper):
    """Test _query_diff when base and current are identical."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    dbt_test_helper.create_model("identical", csv_data, csv_data)
    params = {"sql_template": 'select * from {{ ref("identical") }}'}
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 2
    assert len(run_result.current.data) == 2
    # Data should be the same
    assert run_result.base.data == run_result.current.data


def test_query_diff_in_client_empty_base(dbt_test_helper):
    """Test _query_diff when base returns no rows."""
    csv_data_base = """
        customer_id,name,age
        """

    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    dbt_test_helper.create_model("empty_base", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("empty_base") }}'}
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 0
    assert len(run_result.current.data) == 2


def test_query_diff_in_client_empty_current(dbt_test_helper):
    """Test _query_diff when current returns no rows."""
    csv_data_base = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    csv_data_curr = """
        customer_id,name,age
        """

    dbt_test_helper.create_model("empty_curr", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("empty_curr") }}'}
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 2
    assert len(run_result.current.data) == 0


# =============================================================================
# _query_diff_join Tests (with primary_keys - warehouse-side diff)
# =============================================================================


def test_query_diff_in_warehouse(dbt_test_helper):
    """Basic _query_diff_join test - returns diff DataFrame with in_a/in_b flags."""
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
    params = {"sql_template": 'select * from {{ ref("customers") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # Should return diff (not base/current)
    assert run_result.diff is not None
    assert run_result.base is None
    assert run_result.current is None
    # One row changed (customer_id=1, age: 35->30), appears twice (old and new)
    assert len(run_result.diff.data) == 2


def test_query_diff_in_warehouse_with_base_sql_template(dbt_test_helper):
    """Test _query_diff_join with different SQL for base vs current."""
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
    params = {
        "base_sql_template": 'select * from {{ ref("customers") }} where customer_id == 1',
        "sql_template": 'select * from {{ ref("customers") }}',
        "primary_keys": ["customer_id"],
    }
    task = QueryDiffTask(params)
    run_result = task.execute()
    # Base has 1 row (customer_id=1), current has 3 rows
    # Diff should show: customer_id=1 modified (2 rows), customer_id=2,3 added (2 rows)
    assert len(run_result.diff.data) == 4


def test_query_diff_in_warehouse_identical_data(dbt_test_helper):
    """Test _query_diff_join when base and current are identical."""
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_model("identical_wh", csv_data, csv_data)
    params = {"sql_template": 'select * from {{ ref("identical_wh") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # No differences, diff should be empty
    assert len(run_result.diff.data) == 0


def test_query_diff_in_warehouse_added_rows(dbt_test_helper):
    """Test _query_diff_join detecting rows added in current."""
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

    dbt_test_helper.create_model("added_rows", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("added_rows") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # One row added (customer_id=3)
    assert len(run_result.diff.data) == 1

    # Check the added row has in_a=False, in_b=True
    row = run_result.diff.data[0]
    in_a_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_a")
    in_b_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_b")
    assert row[in_a_idx] is False
    assert row[in_b_idx] is True


def test_query_diff_in_warehouse_removed_rows(dbt_test_helper):
    """Test _query_diff_join detecting rows removed in current."""
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

    dbt_test_helper.create_model("removed_rows", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("removed_rows") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # One row removed (customer_id=3)
    assert len(run_result.diff.data) == 1

    # Check the removed row has in_a=True, in_b=False
    row = run_result.diff.data[0]
    in_a_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_a")
    in_b_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_b")
    assert row[in_a_idx] is True
    assert row[in_b_idx] is False


def test_query_diff_in_warehouse_modified_rows(dbt_test_helper):
    """Test _query_diff_join detecting modified rows (same PK, different values)."""
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

    dbt_test_helper.create_model("modified_rows", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("modified_rows") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # Two rows modified (customer_id=1,2), each appears twice (old and new)
    assert len(run_result.diff.data) == 4


def test_query_diff_in_warehouse_composite_primary_key(dbt_test_helper):
    """Test _query_diff_join with composite (multi-column) primary key."""
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

    dbt_test_helper.create_model("composite_pk", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("composite_pk") }}', "primary_keys": ["region", "customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # One row modified (US,2), appears twice
    assert len(run_result.diff.data) == 2

    # Verify primary_keys preserved as list
    assert isinstance(task.params.primary_keys, list)
    assert len(task.params.primary_keys) == 2


def test_query_diff_in_warehouse_empty_base(dbt_test_helper):
    """Test _query_diff_join when base returns no rows."""
    csv_data_base = """
        customer_id,name,age
        """

    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    dbt_test_helper.create_model("empty_base_wh", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("empty_base_wh") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # All current rows are "added" (in_a=False, in_b=True)
    assert len(run_result.diff.data) == 2
    for row in run_result.diff.data:
        in_a_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_a")
        in_b_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_b")
        assert row[in_a_idx] is False
        assert row[in_b_idx] is True


def test_query_diff_in_warehouse_empty_current(dbt_test_helper):
    """Test _query_diff_join when current returns no rows."""
    csv_data_base = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        """

    csv_data_curr = """
        customer_id,name,age
        """

    dbt_test_helper.create_model("empty_curr_wh", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("empty_curr_wh") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # All base rows are "removed" (in_a=True, in_b=False)
    assert len(run_result.diff.data) == 2
    for row in run_result.diff.data:
        in_a_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_a")
        in_b_idx = next(i for i, c in enumerate(run_result.diff.columns) if c.key.lower() == "in_b")
        assert row[in_a_idx] is True
        assert row[in_b_idx] is False


def test_query_diff_in_warehouse_with_nulls(dbt_test_helper):
    """Test _query_diff_join handles NULL values correctly."""
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

    dbt_test_helper.create_model("nulls_wh", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("nulls_wh") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()
    # Rows 2 and 3 have changes (null to value), each appears twice
    assert len(run_result.diff.data) == 4


def test_query_diff_in_warehouse_columns_normalized(dbt_test_helper):
    """Test that in_a/in_b column keys are normalized to lowercase."""
    csv_data_base = """
        customer_id,name
        1,Alice
        """

    csv_data_curr = """
        customer_id,name
        1,Alice
        2,Bob
        """

    dbt_test_helper.create_model("normalized_cols", csv_data_base, csv_data_curr)
    params = {"sql_template": 'select * from {{ ref("normalized_cols") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    run_result = task.execute()

    # Check in_a/in_b columns are lowercase
    column_keys = [c.key for c in run_result.diff.columns]
    assert "in_a" in column_keys
    assert "in_b" in column_keys
    # Should not have uppercase variants
    assert "IN_A" not in column_keys
    assert "IN_B" not in column_keys


def test_query_diff_primary_keys_normalized(dbt_test_helper):
    """Test that primary_keys are normalized to match actual column keys."""
    csv_data = """
        CUSTOMER_ID,name,age
        1,Alice,30
        2,Bob,25
        """

    dbt_test_helper.create_model("pk_normalize", csv_data, csv_data)
    # User provides lowercase, but column might be uppercase in warehouse
    params = {"sql_template": 'select * from {{ ref("pk_normalize") }}', "primary_keys": ["customer_id"]}
    task = QueryDiffTask(params)
    task.execute()

    # After normalization, primary_keys should match actual column key
    # The exact casing depends on the warehouse (DuckDB preserves case from CSV header)
    assert task.params.primary_keys is not None
    assert len(task.params.primary_keys) == 1


# =============================================================================
# Validator Tests
# =============================================================================


def test_validator():
    from recce.tasks.query import QueryCheckValidator, QueryDiffCheckValidator

    def validate(params=None, view_options=None):
        if view_options is None:
            view_options = {}
        if params is None:
            params = {}
        QueryCheckValidator().validate(
            {
                "name": "test",
                "type": "query",
                "params": params,
                "view_options": view_options,
            }
        )

    def validate_diff(params=None, view_options=None):
        if view_options is None:
            view_options = {}
        if params is None:
            params = {}
        QueryDiffCheckValidator().validate(
            {
                "name": "test",
                "type": "query_diff",
                "params": params,
                "view_options": view_options,
            }
        )

    # query
    validate({"sql_template": "select * from abc"})

    # diff in client
    validate_diff({"sql_template": "select * from abc"})
    validate_diff(
        {
            "sql_template": "select * from abc",
            "base_sql_template": "select * from abc",
        }
    )

    # diff in warehouse
    validate_diff(
        {
            "primary_keys": ["customer_id"],
            "sql_template": "select * from abc",
        }
    )
    validate_diff(
        {
            "sql_template": "select * from abc",
            "base_sql_template": "select * from abc",
            "primary_keys": ["customer_id"],
        }
    )

    # invalid
    with pytest.raises(ValueError):
        validate()

    with pytest.raises(ValueError):
        validate_diff()

    with pytest.raises(ValueError):
        validate_diff({"sql_template": 123, "primary_keys": "xyz"})

    with pytest.raises(ValueError):
        validate_diff({"sql_template": "s", "primary_keys": "xyz"})
