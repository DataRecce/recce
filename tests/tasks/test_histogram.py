import pytest

from recce.tasks.histogram import (
    HistogramDiffCheckValidator,
    HistogramDiffTask,
    _is_histogram_supported,
)


def test_histogram(dbt_test_helper):
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        4,Dolly,50
        """

    dbt_test_helper.create_model("customers", csv_data, csv_data)

    params = {"model": "customers", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()

    # {
    #     'base': {'counts': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 'total': 4},
    #     'current': {'counts': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 'total': 4},
    #     'min': 25, 'max': 50,
    #     'bin_edges': [25, 26, ..., 51],
    #     'labels': ['25-26', ..., '51-52']
    # }
    assert run_result["current"]["counts"][0] == 1
    assert run_result["current"]["counts"][-1] == 1
    assert run_result["current"]["total"] == 4
    assert run_result["min"] == 25
    assert run_result["max"] == 50
    assert run_result["bin_edges"][0] == 25
    assert run_result["bin_edges"][-1] == 51


def test_histogram_emtpy(dbt_test_helper):
    csv_data = """
    customer_id,name,age
    1,Alice,30
    2,Bob,25
    3,Charlie,35
    4,Dolly,50
    """

    csv_data_zero = """
    customer_id,name,age
    """

    dbt_test_helper.create_model("customers", csv_data_zero, csv_data_zero)
    dbt_test_helper.create_model("customers2", csv_data, csv_data_zero)
    dbt_test_helper.create_model("customers3", csv_data_zero, csv_data)

    params = {"model": "customers", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()

    assert len(run_result["current"]["counts"]) == 0
    assert run_result["current"]["total"] == 0
    assert run_result["min"] is None
    assert run_result["max"] is None
    assert len(run_result["bin_edges"]) == 0

    params = {"model": "customers2", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()
    assert run_result["base"]["counts"][0] == 1
    assert run_result["base"]["counts"][-1] == 1
    assert run_result["base"]["total"] == 4
    assert run_result["current"]["counts"][0] == 0
    assert run_result["current"]["counts"][-1] == 0
    assert run_result["current"]["total"] == 0
    assert run_result["min"] == 25
    assert run_result["max"] == 50
    assert run_result["bin_edges"][0] == 25
    assert run_result["bin_edges"][-1] == 51

    params = {"model": "customers3", "column_name": "age", "column_type": "int"}

    task = HistogramDiffTask(params)
    run_result = task.execute()
    assert run_result["base"]["counts"][0] == 0
    assert run_result["base"]["counts"][-1] == 0
    assert run_result["base"]["total"] == 0
    assert run_result["current"]["counts"][0] == 1
    assert run_result["current"]["counts"][-1] == 1
    assert run_result["current"]["total"] == 4
    assert run_result["min"] == 25
    assert run_result["max"] == 50
    assert run_result["bin_edges"][0] == 25
    assert run_result["bin_edges"][-1] == 51


def test_validator():
    def validate(params: dict = {}, view_options: dict = {}):
        HistogramDiffCheckValidator().validate(
            {
                "name": "test",
                "type": "histogram_diff",
                "params": params,
                "view_options": view_options,
            }
        )

    validate(
        {
            "model": "customers",
            "column_name": "age",
            "column_type": "int",
        }
    )

    with pytest.raises(ValueError):
        validate({})


def test_is_column_type_supported_by_histogram():
    assert _is_histogram_supported("varchar") is False
    assert _is_histogram_supported("varchar(16)") is False
    assert _is_histogram_supported("varchar(256)") is False
    assert _is_histogram_supported("bool") is False
    assert _is_histogram_supported("int") is True
