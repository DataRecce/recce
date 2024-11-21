from recce.tasks import RowCountDiffTask


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

    dbt_test_helper.create_model("customers", csv_data_base, csv_data_curr)
    task = RowCountDiffTask(dict(node_names=['customers']))
    run_result = task.execute()
    assert run_result['customers']['base'] == 2
    assert run_result['customers']['curr'] == 3

    task = RowCountDiffTask(dict(node_names=['customers_']))
    run_result = task.execute()
    assert run_result['customers_']['base'] is None
    assert run_result['customers_']['curr'] is None


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

    dbt_test_helper.create_model("model_1", csv_data_1, csv_data_2, [])
    dbt_test_helper.create_model("model_2", csv_data_1, csv_data_1, ['model_1'], package_name='other_package')
    task = RowCountDiffTask(dict(select='model_1'))
    run_result = task.execute()
    assert len(run_result) == 1

    task = RowCountDiffTask(dict(select='model_1+'))
    run_result = task.execute()
    assert len(run_result) == 2

