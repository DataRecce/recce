from recce.adapter.dbt_adapter import DbtAdapter
from recce.models.types import CllData


def assert_column(result: CllData, node_name, column_name, transformation_type, depends_on):
    column_id = f"{node_name}_{column_name}"
    entry = result.columns.get(column_id)
    assert entry is not None, f"Column {column_id} not found in result"
    assert (
        entry.transformation_type == transformation_type
    ), f"Column {column_name} type mismatch: expected {transformation_type}, got {entry.transformation_type}"
    parents = result.parent_map.get(column_id)

    assert len(parents) == len(depends_on), "depends_on length mismatch"
    for i in range(len(depends_on)):
        node, column = depends_on[i]
        parent_column_id = f"{node}_{column}"

        assert parent_column_id in parents, f"Column {parent_column_id} not found in {column_id}'s parent list"


def assert_model(result: CllData, node_name, depends_on):
    assert result.nodes.get(node_name) is not None, f"Node {node_name} not found in result"
    parent_map = result.parent_map.get(node_name)
    assert parent_map is not None, f"Parent map {node_name} not found in result"
    # assert len(parent_map) == len(depends_on), "depends_on length mismatch"
    for i in range(len(depends_on)):
        node, column = depends_on[i]
        column_id = f"{node}_{column}"

        assert column_id in parent_map, f"Parent map {node_name} does not contain {column_id}"


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


def assert_lineage_model(cll_data: CllData, nodes):
    assert len(nodes) == len(cll_data.nodes), "Model count mismatch"
    for node in nodes:
        assert node in cll_data.nodes, f"Model {node} not found in lineage"


def assert_lineage_column(cll_data: CllData, columns):
    assert len(columns) == len(cll_data.columns), "Column count mismatch"
    for column in columns:
        column_key = f"{column[0]}_{column[1]}"
        assert column_key in cll_data.columns, f"Column {column} not found in lineage"
        assert column[0] == cll_data.columns[column_key].table_id, f"Column {column[0]} node mismatch"
        assert column[1] == cll_data.columns[column_key].name, f"Column {column[1]} name mismatch"


def test_cll_column_filter(dbt_test_helper):
    dbt_test_helper.create_model(
        "model1", unique_id="model.model1", curr_sql="select 1 as c", curr_columns={"c": "int"}
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
        curr_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }} where y < 2025',
        curr_columns={"c": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model4",
        unique_id="model.model4",
        curr_sql='select y from {{ ref("model2") }}',
        curr_columns={"y": "int"},
        depends_on=["model.model2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_cll("model.model2", "c")
    assert_lineage_model(result, [])
    assert_lineage_column(result, [("model.model1", "c"), ("model.model2", "c"), ("model.model3", "c")])

    result = adapter.get_cll("model.model2", "y")
    assert_lineage_model(result, ["model.model3"])
    assert_lineage_column(result, [("model.model2", "y"), ("model.model4", "y")])

    result = adapter.get_cll("model.model3", "c")
    assert_lineage_model(result, [])
    assert_lineage_column(result, [("model.model1", "c"), ("model.model2", "c"), ("model.model3", "c")])


def test_impact_radius_nodes(dbt_test_helper):
    # non-breaking
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 1 as c --- non-breaking",
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
    )
    # breaking
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
        base_sql='select c, 2025 as y from {{ ref("model1") }} where c > 0 --- breaking',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }} where y < 2025',
        base_sql='select c from {{ ref("model2") }} where y < 2025',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model4",
        unique_id="model.model4",
        curr_sql='select y from {{ ref("model2") }}',
        base_sql='select y from {{ ref("model2") }}',
        curr_columns={"y": "int"},
        base_columns={"y": "int"},
        depends_on=["model.model2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # breaking
    result = adapter.get_impacted_nodes("model.model2")
    assert_lineage_model(result, ["model.model2", "model.model3", "model.model4"])

    # non-breaking
    result = adapter.get_impacted_nodes("model.model1")
    assert_lineage_model(result, [])


def test_impact_radius_columns(dbt_test_helper):
    # added column
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c, 2 as d --- add d",
        base_sql="select 1 as c",
        curr_columns={"c": "int", "d": "int"},
        base_columns={"c": "int"},
    )
    # modified column
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c, 2024 as y from {{ ref("model1") }} --- modify y',
        base_sql='select c, 2025 as y from {{ ref("model1") }}',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }} where y < 2025',
        base_sql='select c from {{ ref("model2") }} where y < 2025',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model4",
        unique_id="model.model4",
        curr_sql='select y from {{ ref("model2") }}',
        base_sql='select y from {{ ref("model2") }}',
        curr_columns={"y": "int"},
        base_columns={"y": "int"},
        depends_on=["model.model2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_impacted_cll("model.model2")
    assert_lineage_model(result, ["model.model3"])
    assert_lineage_column(result, [("model.model2", "y"), ("model.model4", "y")])

    result = adapter.get_impacted_cll("model.model1")
    assert_lineage_model(result, [])
    assert_lineage_column(result, [("model.model1", "d")])


def test_impact_radius(dbt_test_helper):
    # added column
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c, 2 as d --- add d",
        base_sql="select 1 as c",
        curr_columns={"c": "int", "d": "int"},
        base_columns={"c": "int"},
    )
    # breaking, added column, modified column
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c, 2024 as y, d from {{ ref("model1") }} --- modify y, add d',
        base_sql='select c, 2025 as y from {{ ref("model1") }} where c > 0 --- breaking',
        curr_columns={"c": "int", "y": "int", "d": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }} where y < 2025',
        base_sql='select c from {{ ref("model2") }} where y < 2025',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model4",
        unique_id="model.model4",
        curr_sql='select y from {{ ref("model2") }}',
        base_sql='select y from {{ ref("model2") }}',
        curr_columns={"y": "int"},
        base_columns={"y": "int"},
        depends_on=["model.model2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_impact_radius("model.model2")
    assert_lineage_model(result, ["model.model2", "model.model3", "model.model4"])
    assert_lineage_column(result, [("model.model2", "d"), ("model.model2", "y"), ("model.model4", "y")])
