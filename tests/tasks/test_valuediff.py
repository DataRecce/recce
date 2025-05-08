import pytest

from recce.tasks import ValueDiffDetailTask, ValueDiffTask


def test_value_diff(dbt_test_helper):
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
    params = dict(model="customers", primary_key=["customer_id"])
    task = ValueDiffTask(params)
    run_result = task.execute()
    assert len(run_result.data.columns) == 3
    assert len(run_result.data.data) == 3

    params = dict(model="customers", primary_key=["customer_id"])
    task = ValueDiffDetailTask(params)
    run_result = task.execute()
    assert len(run_result.columns) == 5
    assert len(run_result.data) == 2


def test_validator():
    from recce.tasks.valuediff import ValueDiffCheckValidator

    def validate(params: dict = {}, view_options: dict = {}):
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
