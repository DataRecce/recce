from recce.adapter.dbt_adapter import DbtAdapter


def test_cll_basic(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"})
    dbt_test_helper.create_model("model2", curr_sql='select c from {{ ref("model1") }}', curr_columns={"c": "int"},
                                 depends_on=["model1"])
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model1")
    assert result['nodes']['model2']['columns']['c']['depends_on'][0].column == 'c'
    assert result['nodes']['model2']['columns']['c']['depends_on'][0].node == 'model1'


def test_cll_table_alisa(dbt_test_helper):
    def patch_node(node):
        node['alias'] = 'model1_alias'

    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"}, patch_func=patch_node)
    dbt_test_helper.create_model("model2", curr_sql='select c from {{ ref("model1") }}', curr_columns={"c": "int"},
                                 depends_on=["model1"])
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model1")
    assert result['nodes']['model2']['columns']['c']['depends_on'][0].column == 'c'
    assert result['nodes']['model2']['columns']['c']['depends_on'][0].node == 'model1'


def test_seed(dbt_test_helper):
    csv_data_curr = """
    customer_id,name,age
    1,Alice,30
    2,Bob,25
    3,Charlie,35
    """

    dbt_test_helper.create_model("seed1",
                                 curr_csv=csv_data_curr,
                                 curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"},
                                 resource_type="seed")
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("seed1")

    assert result['nodes']['seed1']['columns']['customer_id']['transformation_type'] == 'source'
    assert len(result['nodes']['seed1']['columns']['customer_id']['depends_on']) == 0


def test_python_model(dbt_test_helper):
    def python_node(node):
        node['language'] = 'python'

    csv_data_curr = """
    customer_id,name,age
    1,Alice,30
    2,Bob,25
    3,Charlie,35
    """
    dbt_test_helper.create_model("model1",
                                 curr_csv=csv_data_curr,
                                 curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"})
    dbt_test_helper.create_model("model2",
                                 curr_csv=csv_data_curr,
                                 curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"},
                                 depends_on=["model1"],
                                 patch_func=python_node)
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    assert not adapter.is_python_model('model1')
    assert adapter.is_python_model('model2')

    result = adapter.get_cll_by_node_id("model1")
    assert result['nodes']['model2']['columns']['customer_id']['transformation_type'] == 'unknown'


def test_source(dbt_test_helper):
    csv_data_curr = """
        customer_id,name,age
        1,Alice,30
        2,Bob,25
        3,Charlie,35
        """

    dbt_test_helper.create_source(
        "source1",
        "table1",
        curr_csv=csv_data_curr,
        curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"})
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("source1.table1")
    assert result['nodes']['source1.table1']['columns']['customer_id']['transformation_type'] == 'source'


def test_parse_error(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"})
    dbt_test_helper.create_model("model2", curr_sql='this is not a valid sql', curr_columns={"c": "int"})
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model2")
    assert result['nodes']['model2']['columns']['c']['transformation_type'] == 'unknown'


def test_model_without_catalog(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c")
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model1")
    assert not hasattr(result['nodes']['model1'], 'columns')
