import pytest

from recce.tasks import TopKDiffTask
from recce.tasks.top_k import TopKDiffCheckValidator


def test_top_k(dbt_test_helper):
    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        4,Bob,35
        """

    csv_data_base = """
        customer_id,name,age
        1,Alice,35
        2,Bob,25
        3,Charlie,35
        4,,35
        """

    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)

    params = dict(
        model="customers",
        column_name="name",
        k=50,
    )

    task = TopKDiffTask(params)
    run_result = task.execute()

    # {
    #     'values': ['Bob', 'Alice', 'Charlie'],
    #     'counts': [2, 1, 1],
    #     'valids': 4,
    #     'total': 4
    # }
    assert run_result["current"]["values"][0] == "Bob"
    assert run_result["current"]["counts"][0] == 2
    assert run_result["current"]["valids"] == 4
    assert run_result["current"]["total"] == 4

    # {
    #     'values': ['Bob', 'Alice', 'Charlie'],
    #     'counts': [1, 1, 1],
    #     'valids': 3,
    #     'total': 4
    # }
    assert run_result["base"]["counts"][0] == 1
    assert run_result["base"]["valids"] == 3
    assert run_result["base"]["total"] == 4


def test_top_k_diff_with_where_filter(dbt_test_helper):
    csv_data_base = """
        customer_id,category
        1,A
        2,B
        3,A
        4,B
        5,C
        """
    csv_data_curr = """
        customer_id,category
        1,A
        2,B
        3,A
        4,B
        5,C
        """
    dbt_test_helper.create_model("customers_topk", csv_data_base, csv_data_curr)
    params = {
        "model": "customers_topk",
        "column_name": "category",
        "k": 10,
        "where_filter": {"column": "customer_id", "operator": "<=", "value": "3"},
    }
    task = TopKDiffTask(params)
    result = task.execute()
    assert result["base"]["total"] == 3
    assert result["current"]["total"] == 3


def test_validator():
    def validate(params: dict = {}, view_options: dict = {}):
        TopKDiffCheckValidator().validate(
            {
                "name": "test",
                "type": "top_k_diff",
                "params": params,
                "view_options": view_options,
            }
        )

    validate(
        {
            "model": "customers",
            "column_name": "name",
            "k": 50,
        }
    )

    with pytest.raises(ValueError):
        validate({})
