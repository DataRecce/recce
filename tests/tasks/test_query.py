from recce.tasks import QueryDiffTask


def test_query_in_client(dbt_test_helper):
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
    params = dict(sql_template=f'select * from {{{{ ref("customers") }}}}')
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.base.data) == 3
    assert len(run_result.current.data) == 3


def test_query_in_warehouse(dbt_test_helper):
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
    params = dict(sql_template=f'select * from {{{{ ref("customers") }}}}', primary_keys=['customer_id'])
    task = QueryDiffTask(params)
    run_result = task.execute()
    assert len(run_result.diff.data) == 2
