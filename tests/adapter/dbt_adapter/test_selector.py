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
    dbt_test_helper.create_model("customers_2", csv_data_base, csv_data_base, depends_on=["customers_1"])
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

    # Test resource type: snapshot
    dbt_test_helper.create_snapshot("snapshot_1", csv_data_base, csv_data_curr)
    dbt_test_helper.create_model("use_snapshot", csv_data_base, csv_data_base, depends_on=["snapshot_1"])

    node_ids = adapter.select_nodes('resource_type:snapshot')
    assert len(node_ids) == 1

    node_ids = adapter.select_nodes('resource_type:snapshot+')
    assert len(node_ids) == 2

    node_ids = adapter.select_nodes("state:modified,resource_type:snapshot")
    assert len(node_ids) == 1


def test_select_removed_by_graph(dbt_test_helper):
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
    dbt_test_helper.create_model("customers_2", base_csv=csv_data_base, depends_on=["customers_1"])
    dbt_test_helper.create_model("customers_3", curr_csv=csv_data_curr, depends_on=["customers_1"])
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Test graph operation
    node_ids = adapter.select_nodes("customers_1+")
    assert len(node_ids) == 3
    node_ids = adapter.select_nodes("+customers_2")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("+customers_3")
    assert len(node_ids) == 2


def test_select_source_removed_by_graph(dbt_test_helper):
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

    dbt_test_helper.create_model("customers_2", base_csv=csv_data_base)
    dbt_test_helper.create_model("customers_3", curr_csv=csv_data_curr)
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Test graph operation
    node_ids = adapter.select_nodes("state:modified")
    assert len(node_ids) == 2


def test_select_with_disabled(dbt_test_helper):
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
    dbt_test_helper.create_model("customers_2", csv_data_base, csv_data_curr, disabled=True)
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Test graph operation
    node_ids = adapter.select_nodes("customers_1+")
    assert len(node_ids) == 1


def test_select_with_pacakage_mode_include_exclude(dbt_test_helper):
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

    """
    The diagram of the models:
    customers_1 ── customers_2 ── customers_3(*) ├── other_package.customers_4
                                                 └── customers_5

    Only customers_3 is changed
    """
    dbt_test_helper.create_model("customers_1", csv_data_base, csv_data_base)
    dbt_test_helper.create_model("customers_2", csv_data_base, csv_data_base, depends_on=['customers_1'])
    dbt_test_helper.create_model("customers_3", csv_data_base, csv_data_curr, depends_on=['customers_2'])
    dbt_test_helper.create_model("customers_4", csv_data_base, csv_data_base, depends_on=['customers_3'],
                                 package_name='other_package')
    dbt_test_helper.create_model("customers_5", csv_data_base, csv_data_base, depends_on=['customers_3'])

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    node_ids = adapter.select_nodes(packages=['other_package'])
    assert len(node_ids) == 1

    node_ids = adapter.select_nodes(view_mode='changed_models')
    assert len(node_ids) == 4

    node_ids = adapter.select_nodes(view_mode='changed_models', packages=['other_package'])
    assert len(node_ids) == 1

    node_ids = adapter.select_nodes(view_mode='changed_models', packages=['other_package'], exclude='customers_4')
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes(view_mode='changed_models', packages=['other_package'], select='customers_1+')
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes(view_mode='changed_models', select='+customers_5')
    assert len(node_ids) == 3
    node_ids = adapter.select_nodes(view_mode='all', select='+customers_5')
    assert len(node_ids) == 4
    node_ids = adapter.select_nodes(select='+customers_5')
    assert len(node_ids) == 4
