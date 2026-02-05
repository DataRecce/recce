import pytest

from recce.tasks import RowCountDiffTask
from recce.tasks.rowcount import RowCountStatus


def test_row_count(dbt_test_helper):
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
        """

    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr, unique_id="model.customers")
    task = RowCountDiffTask(dict(node_names=["customers"]))
    run_result = task.execute()

    # Verify new structured format
    assert run_result["customers"]["base"]["count"] == 2
    assert run_result["customers"]["base"]["status"] == RowCountStatus.OK
    assert run_result["customers"]["curr"]["count"] == 3
    assert run_result["customers"]["curr"]["status"] == RowCountStatus.OK

    # Test non-existent model - should return not_in_manifest status
    task = RowCountDiffTask(dict(node_names=["customers_"]))
    run_result = task.execute()
    assert run_result["customers_"]["base"]["count"] is None
    assert run_result["customers_"]["base"]["status"] == RowCountStatus.NOT_IN_MANIFEST
    assert run_result["customers_"]["curr"]["count"] is None
    assert run_result["customers_"]["curr"]["status"] == RowCountStatus.NOT_IN_MANIFEST
    # Verify message is present for non-ok status
    assert "message" in run_result["customers_"]["base"]

    task = RowCountDiffTask(dict(node_ids=["model.customers"]))
    run_result = task.execute()
    assert run_result["customers"]["base"]["count"] == 2
    assert run_result["customers"]["curr"]["count"] == 3


def test_row_count_with_selector(dbt_test_helper):
    csv_data_1 = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    csv_data_2 = """
        customer_id,name,age
        1,Alice,35
        2,Bob,25
        """

    dbt_test_helper.create_model("model_1", csv_data_1, csv_data_2, depends_on=[])
    dbt_test_helper.create_model("model_2", csv_data_1, csv_data_1, depends_on=["model_1"])
    task = RowCountDiffTask(dict(select="model_1"))
    run_result = task.execute()
    assert len(run_result) == 1

    task = RowCountDiffTask(dict(select="model_1+"))
    run_result = task.execute()
    assert len(run_result) == 2


def test_validator():
    from recce.tasks.rowcount import RowCountDiffCheckValidator

    validator = RowCountDiffCheckValidator()

    def validate(params: dict):
        validator.validate(
            {
                "name": "test",
                "type": "row_count_diff",
                "params": params,
            }
        )

    # Select all modesl
    validate({})

    # Select by node name
    validate(
        {
            "node_names": ["abc"],
        }
    )
    with pytest.raises(ValueError):
        validate(
            {
                "node_names": "abc",
            }
        )

    # Select by node id
    validate(
        {
            "node_ids": ["model.abc"],
        }
    )

    # Select by selector
    validate(
        {
            "select": "customers",
            "exclude": "customers",
            "packages": ["jaffle_shop"],
            "view_mode": "all",
        }
    )

    # packages should be an array
    with pytest.raises(ValueError):
        validate(
            {
                "packages": "jaffle_shop",
            }
        )

    # view_mode should be 'all' or 'changed_models'
    validate(
        {
            "view_mode": None,
        }
    )
    validate(
        {
            "view_mode": "all",
        }
    )
    with pytest.raises(ValueError):
        validate(
            {
                "view_mode": "abc",
            }
        )
