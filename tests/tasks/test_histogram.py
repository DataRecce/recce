from recce.tasks.histogram import HistogramDiffTask


def test_histogram(dbt_test_helper):
    csv_data = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        4,Dolly,50
        """

    dbt_test_helper.create_model("customers", csv_data, csv_data)

    params = {
        "model": "customers",
        "column_name": "age",
        "column_type": "int"
    }

    task = HistogramDiffTask(params)
    run_result = task.execute()

    # {
    #     'base': {'counts': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 'total': 4},
    #     'current': {'counts': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 'total': 4},
    #     'min': 25, 'max': 50,
    #     'bin_edges': [25, 26, ..., 51],
    #     'labels': ['25-26', ..., '51-52']
    # }
    assert run_result['current']['counts'][0] == 1
    assert run_result['current']['counts'][-1] == 1
    assert run_result['current']['total'] == 4
    assert run_result['min'] == 25
    assert run_result['max'] == 50
    assert run_result['bin_edges'][0] == 25
    assert run_result['bin_edges'][-1] == 51
