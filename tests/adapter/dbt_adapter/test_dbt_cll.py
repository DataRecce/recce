from recce.adapter.dbt_adapter import DbtAdapter


def test_cll(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"})
    dbt_test_helper.create_model("model2", curr_sql='select c from {{ ref("model1") }}', curr_columns={"c": "int"})
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_lineage()
    assert result['nodes']['model2']['columns']['c']['depends_on'][0].column == 'c'
    assert result['nodes']['model2']['columns']['c']['depends_on'][0].node == 'model1'
