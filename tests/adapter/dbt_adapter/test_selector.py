from recce.adapter.dbt_adapter import DbtAdapter


def test_select(dbt_test_helper):
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

    dbt_test_helper.create_model("customers_1", csv_data_base, csv_data_curr)
    dbt_test_helper.create_model("customers_2", csv_data_base, csv_data_base, ["customers_1"])
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Test methods
    node_ids = adapter.select_nodes('customers_1')
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes('resource_type:model')
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes('tag:test_tag')
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes('tag:test_tag2')
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes("config.materialized:incremental")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes("config.materialized:table")
    assert len(node_ids) == 2

    # Test state method
    node_ids = adapter.select_nodes("state:modified")
    assert len(node_ids) == 1

    # Test set operation
    node_ids = adapter.select_nodes("customers_1 customers_2")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("customers_1,customers_2")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes("config.materialized:table,tag:test_tag")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("config.materialized:table,tag:test_tag2")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes(exclude='customers_1')
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes('customers_1', exclude='customers_2')
    assert len(node_ids) == 1

    # Test graph operation
    node_ids = adapter.select_nodes("state:modified+")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("+state:modified")
    assert len(node_ids) == 1