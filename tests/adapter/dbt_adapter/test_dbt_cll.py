from recce.adapter.dbt_adapter import DbtAdapter
from recce.models.types import CllData


def assert_column(result: CllData, node_name, column_name, transformation_type, depends_on):
    assert result.nodes.get(node_name) is not None, f"Node {node_name} not found in result"
    entry = result.nodes[node_name].columns.get(column_name)
    assert entry is not None, f"Column {column_name} not found in result"
    assert (
        entry.transformation_type == transformation_type
    ), f"Column {column_name} type mismatch: expected {transformation_type}, got {entry.transformation_type}"
    assert len(entry.depends_on) == len(depends_on), "depends_on length mismatch"
    for i in range(len(depends_on)):
        node, column = depends_on[i]
        anode = entry.depends_on[i].node
        acolumn = entry.depends_on[i].column

        assert (
            anode == node and acolumn == column
        ), f"depends_on mismatch at index {i}: expected ({node}, {column}), got ({anode}, {acolumn})"


def assert_model(result: CllData, node_name, depends_on):
    assert result.nodes.get(node_name) is not None, f"Node {node_name} not found in result"
    entry = result.nodes.get(node_name)

    assert len(entry.depends_on.columns) == len(depends_on), "depends_on length mismatch"
    for i in range(len(depends_on)):
        node, column = depends_on[i]
        anode = entry.depends_on.columns[i].node
        acolumn = entry.depends_on.columns[i].column

        assert (
            anode == node and acolumn == column
        ), f"depends_on mismatch at index {i}: expected ({node}, {column}), got ({anode}, {acolumn})"


def test_cll_basic(dbt_test_helper):
    dbt_test_helper.create_model(
        "model1", unique_id="model.model1", curr_sql="select 1 as c", curr_columns={"c": "int"}
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c from {{ ref("model1") }} where c > 0',
        curr_columns={"c": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("recce_test", "model1") }} where c > 0',
        curr_columns={"c": "int"},
        depends_on=["model.model1"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_cll_by_node_id("model.model2")
    assert_model(result, "model.model2", [("model.model1", "c")])
    assert_column(result, "model.model2", "c", "passthrough", [("model.model1", "c")])

    result = adapter.get_cll_by_node_id("model.model3")
    assert_model(result, "model.model3", [("model.model1", "c")])
    assert_column(result, "model.model3", "c", "passthrough", [("model.model1", "c")])


def test_cll_table_alisa(dbt_test_helper):
    def patch_node(node):
        node["alias"] = "model1_alias"

    dbt_test_helper.create_model(
        "model1", unique_id="model.model1", curr_sql="select 1 as c", curr_columns={"c": "int"}, patch_func=patch_node
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c from {{ ref("model1") }}',
        curr_columns={"c": "int"},
        depends_on=["model.model1"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model.model1")
    assert_column(result, "model.model2", "c", "passthrough", [("model.model1", "c")])


def test_seed(dbt_test_helper):
    csv_data_curr = """
    customer_id,name,age
    1,Alice,30
    2,Bob,25
    3,Charlie,35
    """

    dbt_test_helper.create_model(
        "seed1",
        unique_id="seed.seed1",
        curr_csv=csv_data_curr,
        curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"},
        resource_type="seed",
    )
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql='select customer_id from {{ ref("seed1") }} where age > 0',
        curr_columns={"customer_id": "varchar"},
        depends_on=["seed.seed1"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_cll_by_node_id("model.model1")
    assert_model(result, "seed.seed1", [])
    assert_column(result, "seed.seed1", "customer_id", "source", [])
    assert_model(result, "model.model1", [("seed.seed1", "age")])
    assert_column(result, "model.model1", "customer_id", "passthrough", [("seed.seed1", "customer_id")])


def test_python_model(dbt_test_helper):
    def python_node(node):
        node["language"] = "python"

    csv_data_curr = """
    customer_id,name,age
    1,Alice,30
    2,Bob,25
    3,Charlie,35
    """
    dbt_test_helper.create_model(
        "model1", curr_csv=csv_data_curr, curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"}
    )
    dbt_test_helper.create_model(
        "model2",
        curr_csv=csv_data_curr,
        curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"},
        depends_on=["model1"],
        patch_func=python_node,
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    assert not adapter.is_python_model("model1")
    assert adapter.is_python_model("model2")

    result = adapter.get_cll_by_node_id("model1")
    assert_column(result, "model2", "customer_id", "unknown", [])


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
        unique_id="source.source1.table1",
        curr_csv=csv_data_curr,
        curr_columns={"customer_id": "varchar", "name": "varchar", "age": "int"},
    )
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql='select customer_id from {{ source("source1", "table1") }}',
        curr_columns={"customer_id": "int"},
        depends_on=["source.source1.table1"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("source.source1.table1")
    assert_column(result, "source.source1.table1", "customer_id", "source", [])
    result = adapter.get_cll_by_node_id("model.model1")
    assert_column(result, "model.model1", "customer_id", "passthrough", [("source.source1.table1", "customer_id")])


def test_parse_error(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"})
    dbt_test_helper.create_model("model2", curr_sql="this is not a valid sql", curr_columns={"c": "int"})
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model2")
    assert_column(result, "model2", "c", "unknown", [])


def test_model_without_catalog(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c")
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll_by_node_id("model1")
    assert not result.nodes["model1"].columns
