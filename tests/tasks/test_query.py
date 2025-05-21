import pytest

from recce.tasks import QueryDiffTask, QueryTask


def test_query_diff_in_client(dbt_test_helper):
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
    params = dict(sql_template='select * from {{ ref("customers") }}')
    task = QueryTask(params)
    run_result = task.execute()
    assert len(run_result.current.data) == 3


def test_query_diff_in_client(dbt_test_helper):
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
    params = dict(sql_template='select * from {{ ref("customers") }}')
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 3
    assert len(run_result.current.data) == 3

    params = dict(
        base_sql_template='select * from {{ ref("customers") }} where customer_id <= 2',
        sql_template='select * from {{ ref("customers") }}',
    )
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 2
    assert len(run_result.current.data) == 3


def test_query_diff_in_warehouse(dbt_test_helper):
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
    params = dict(sql_template='select * from {{ ref("customers") }}', primary_keys=["customer_id"])
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.diff.data) == 2

    params = dict(
        base_sql_template='select * from {{ ref("customers") }} where customer_id == 1',
        sql_template='select * from {{ ref("customers") }}',
        primary_keys=["customer_id"],
    )
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.diff.data) == 4


def test_validator():
    from recce.tasks.query import QueryCheckValidator, QueryDiffCheckValidator

    def validate(params: dict = {}, view_options: dict = {}):
        QueryCheckValidator().validate(
            {
                "name": "test",
                "type": "query",
                "params": params,
                "view_options": view_options,
            }
        )

    def validate_diff(params: dict = {}, view_options: dict = {}):
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
        {"sql_template": "select * from abc", "base_sql_template": "select * from abc", "primary_keys": ["customer_id"]}
    )
    validate_diff(
        {"sql_template": "select * from abc", "base_sql_template": "select * from abc", "primary_keys": ["customer_id"]}
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
