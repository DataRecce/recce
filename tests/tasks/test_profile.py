import pytest

from recce.tasks import ProfileDiffTask, ProfileTask

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


def test_profile(dbt_test_helper):
    dbt_test_helper.create_model("customers", None, csv_data_curr)
    params = dict(model='customers')
    task = ProfileTask(params)
    run_result = task.execute()

    assert len(run_result.current.data) == 3


def test_profile_with_selected_columns(dbt_test_helper):
    dbt_test_helper.create_model("customers", None, csv_data_curr)
    params = dict(model='customers', columns=['name', 'age'])
    task = ProfileTask(params)
    run_result = task.execute()
    assert len(run_result.current.data) == 2


def test_profile_diff(dbt_test_helper):
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    params = dict(model='customers')
    task = ProfileDiffTask(params)
    run_result = task.execute()

    assert len(run_result.current.data) == 3
    assert len(run_result.base.data) == 3


def test_profile_diff_with_selected_columns(dbt_test_helper):
    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    params = dict(model='customers', columns=['name', 'age'])
    task = ProfileDiffTask(params)
    run_result = task.execute()
    assert len(run_result.current.data) == 2
    assert len(run_result.base.data) == 2


def test_validator():
    from recce.tasks.profile import ProfileCheckValidator

    def validate(params: dict = {}, view_options: dict = {}):
        ProfileCheckValidator().validate({
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
