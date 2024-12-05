import pytest

from recce.tasks import ProfileDiffTask


def test_profile_diff(dbt_test_helper):
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
    params = dict(model='customers')
    task = ProfileDiffTask(params)
    run_result = task.execute()

    assert len(run_result.current.data) == 3
    assert len(run_result.base.data) == 3


def test_validator():
    from recce.tasks.profile import ProfileDiffCheckValidator

    def validate(params: dict = {}, view_options: dict = {}):
        ProfileDiffCheckValidator().validate({
            'name': 'test',
            'type': 'profile_diff',
            'params': params,
            'view_options': view_options,
        })

    validate({
        'model': 'customers',
    })

    with pytest.raises(ValueError):
        validate({
        })
