from recce.adapter.dbt_adapter import DbtAdapter
from recce.models.types import CllData
from recce.util.lineage import build_column_key


def assert_parent_map(result: CllData, node_or_column_id, parents):
    a_parents = result.parent_map.get(node_or_column_id) or set()

    assert len(a_parents) == len(parents), "parents length mismatch"
    for parent in parents:
        if isinstance(parent, str):
            node_id = parent
            assert node_id in a_parents, f"Node {node_id} not found in parent list"
        elif len(parent) == 1:
            (node_id,) = parent
            assert node_id in a_parents, f"Column {parent} not found in parent list"
        elif len(parent) == 2:
            node, column = parent
            column_id = build_column_key(node, column)
            assert column_id in a_parents, f"Column {column_id} not found in parent list for {node_or_column_id}"
        else:
            raise ValueError(f"Invalid parent format: {parent}. Expected node_id or (node_id, column_name).")


def assert_column(
    result: CllData,
    node_id,
    column_name,
    transformation_type=None,
    change_status=None,
    parents=None,
):
    column_id = build_column_key(node_id, column_name)
    entry = result.columns.get(column_id)
    assert entry is not None, f"Column {column_id} not found in result"
    assert (
        entry.transformation_type == transformation_type
    ), f"Column {column_name} type mismatch: expected {transformation_type}, got {entry.transformation_type}"
    assert_parent_map(result, column_id, parents)
    assert (
        entry.change_status == change_status
    ), f"Column {column_name} change status mismatch: expected {change_status}, got {entry.change_status}"


def assert_model(
    result: CllData,
    node_id,
    change_category=None,
    impacted=None,
    parents=None,
):
    entry = result.nodes.get(node_id)
    assert entry is not None, f"Node {node_id} not found in result"
    assert_parent_map(result, node_id, parents)

    assert (
        entry.change_category == change_category
    ), f"Node {node_id} change category mismatch: expected {change_category}, got {entry.change_category}"

    assert (entry.impacted == impacted), f"Node {node_id} impacted status mismatch: expected {impacted}, got {entry.impacted}"


def assert_cll_contain_nodes(cll_data: CllData, nodes):
    assert len(nodes) == len(cll_data.nodes), "Model count mismatch"
    for node in nodes:
        assert node in cll_data.nodes, f"Model {node} not found in lineage"


def assert_cll_contain_columns(cll_data: CllData, columns):
    assert len(columns) == len(cll_data.columns), "Column count mismatch"
    for column in columns:
        column_key = f"{column[0]}_{column[1]}"
        assert column_key in cll_data.columns, f"Column {column} not found in lineage"
        assert column[0] == cll_data.columns[column_key].table_id, f"Column {column[0]} node mismatch"
        assert column[1] == cll_data.columns[column_key].name, f"Column {column[1]} name mismatch"


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

    result = adapter.get_cll("model.model1", "c")
    assert_model(result, "model.model2", parents=[("model.model1", "c")])
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[("model.model1", "c")])

    assert_model(result, "model.model3", parents=[("model.model1", "c")])
    assert_column(result, "model.model3", "c", transformation_type="passthrough", parents=[("model.model1", "c")])


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
    result = adapter.get_cll("model.model1", "c")
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[("model.model1", "c")])


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

    result = adapter.get_cll("model.model1")
    assert_model(result, "seed.seed1", parents=[])
    assert_column(result, "seed.seed1", "customer_id", transformation_type="source", parents=[])
    assert_model(result, "model.model1", parents=["seed.seed1", ("seed.seed1", "age")])
    assert_column(
        result,
        "model.model1",
        "customer_id",
        transformation_type="passthrough",
        parents=[("seed.seed1", "customer_id")],
    )


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

    result = adapter.get_cll("model2")
    assert_model(result, "model2", parents=["model1"])
    assert_column(result, "model2", "customer_id", transformation_type="unknown", parents=[])


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
    result = adapter.get_cll("model.model1")
    assert_column(result, "source.source1.table1", "customer_id", transformation_type="source", parents=[])
    assert_column(
        result,
        "model.model1",
        "customer_id",
        transformation_type="passthrough",
        parents=[("source.source1.table1", "customer_id")],
    )


def test_parse_error(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"})
    dbt_test_helper.create_model("model2", curr_sql="this is not a valid sql", curr_columns={"c": "int"})
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll("model2")
    assert_column(result, "model2", "c", transformation_type="unknown", parents=[])


def test_model_without_catalog(dbt_test_helper):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c")
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll("model1")
    assert not result.nodes["model1"].columns


def test_column_level_lineage(dbt_test_helper):
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
    assert_cll_contain_nodes(result, [])
    assert_cll_contain_columns(result, [("model.model1", "c"), ("model.model2", "c"), ("model.model3", "c")])
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[("model.model1", "c")])

    result = adapter.get_cll("model.model2", "y")
    assert_cll_contain_nodes(result, ["model.model3"])
    assert_cll_contain_columns(result, [("model.model2", "y"), ("model.model4", "y")])
    assert_column(result, "model.model2", "y", transformation_type="source", parents=[])

    result = adapter.get_cll("model.model3", "c")
    assert_cll_contain_nodes(result, [])
    assert_cll_contain_columns(result, [("model.model1", "c"), ("model.model2", "c"), ("model.model3", "c")])
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[("model.model1", "c")])

    result = adapter.get_cll("model.model2", "c", no_upstream=True, no_downstream=True)
    assert_cll_contain_nodes(result, [])
    assert_cll_contain_columns(result, [("model.model2", "c")])
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[])


def test_impact_radius_no_change_analysis_no_cll(dbt_test_helper):
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 1 as c --- non-breaking",
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
    )
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
        curr_sql='select y + 1 as year from {{ ref("model2") }} --- partial breaking',
        base_sql='select y as year from {{ ref("model2") }}',
        curr_columns={"year": "int"},
        base_columns={"year": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model5",
        unique_id="model.model5",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
        base_sql='select c, 2025 as y from {{ ref("model1") }}',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_cll(no_cll=True)
    assert_cll_contain_nodes(result, ["model.model1", "model.model2", "model.model3", "model.model4", "model.model5"])
    assert_model(result, "model.model1", parents=[])
    assert_model(result, "model.model2", parents=["model.model1"])
    assert_model(result, "model.model3", parents=["model.model2"])
    assert_model(result, "model.model4", parents=["model.model2"])
    assert_model(result, "model.model5", parents=["model.model1"])


def test_impact_radius_with_change_analysis_no_cll(dbt_test_helper):
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 1 as c --- non-breaking",
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
    )
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
        curr_sql='select y + 1 as year from {{ ref("model2") }} --- partial breaking',
        base_sql='select y as year from {{ ref("model2") }}',
        curr_columns={"year": "int"},
        base_columns={"year": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model5",
        unique_id="model.model5",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
        base_sql='select c, 2025 as y from {{ ref("model1") }}',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # breaking
    result = adapter.get_cll(change_analysis=True, no_cll=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model1", "model.model2", "model.model3", "model.model4"])
    assert_model(result, "model.model1", parents=[], change_category="non_breaking", impacted=False)
    assert_model(result, "model.model2", parents=[], change_category="breaking", impacted=True)
    assert_model(result, "model.model3", parents=["model.model2"], change_category=None, impacted=True)
    assert_model(result, "model.model4", parents=["model.model2"], change_category="partial_breaking", impacted=True)


def test_impact_radius_with_change_analysis_no_cll_2(dbt_test_helper):
    # partial breaking
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 2 as c",
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
    # no change
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }} where y < 2025',
        base_sql='select c from {{ ref("model2") }} where y < 2025',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model2"],
    )
    # partial breaking
    dbt_test_helper.create_model(
        "model4",
        unique_id="model.model4",
        curr_sql='select y + 1 as year from {{ ref("model2") }} --- partial breaking',
        base_sql='select y as year from {{ ref("model2") }}',
        curr_columns={"year": "int"},
        base_columns={"year": "int"},
        depends_on=["model.model2"],
    )
    # no change
    dbt_test_helper.create_model(
        "model5",
        unique_id="model.model5",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
        base_sql='select c, 2025 as y from {{ ref("model1") }}',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # breaking
    result = adapter.get_cll(change_analysis=True, no_cll=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model1", "model.model2", "model.model3", "model.model4", "model.model5"])
    assert_model(result, "model.model1", parents=[], change_category="partial_breaking", impacted=True)
    assert_model(result, "model.model2", parents=["model.model1"], change_category="breaking", impacted=True)
    assert_model(result, "model.model3", parents=["model.model2"], change_category=None, impacted=True)
    assert_model(result, "model.model4", parents=["model.model2"], change_category="partial_breaking", impacted=True)
    assert_model(result, "model.model5", parents=["model.model1"], impacted=True)


def test_impact_radius_with_change_analysis_with_cll(dbt_test_helper):
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 1 as c --- non-breaking",
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
    )
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
        curr_sql='select y + 1 as year from {{ ref("model2") }} --- partial breaking',
        base_sql='select y as year from {{ ref("model2") }}',
        curr_columns={"year": "int"},
        base_columns={"year": "int"},
        depends_on=["model.model2"],
    )
    dbt_test_helper.create_model(
        "model5",
        unique_id="model.model5",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
        base_sql='select c, 2025 as y from {{ ref("model1") }}',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_cll(change_analysis=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model1", "model.model2", "model.model3", "model.model4"])
    assert_cll_contain_columns(result, [("model.model4", "year")])
    assert_model(result, "model.model1", parents=[], change_category="non_breaking", impacted=False)
    assert_model(result, "model.model2", parents=[], change_category="breaking", impacted=True)
    assert_model(result, "model.model3", parents=["model.model2"], change_category=None, impacted=True)
    assert_model(result, "model.model4", parents=["model.model2"], change_category="partial_breaking", impacted=True)


def test_impact_radius_with_change_analysis_with_cll_added_removed(dbt_test_helper):
    # rename model
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        base_sql="select 1 as c",
        base_columns={"c": "int"},
    )
    dbt_test_helper.create_model(
        "model1_v2",
        unique_id="model.model1_v2",
        curr_sql="select 1 as c",
        curr_columns={"c": "int"},
    )
    # change upstream
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        base_sql='select c from {{ ref("model1") }}',
        base_columns={"c": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c from {{ ref("model1_v2") }}',
        curr_columns={"c": "int"},
        depends_on=["model.model1_v2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll(change_analysis=True, no_upstream=True)
    assert_model(result, "model.model1_v2", parents=[], impacted=True)
    assert_column(result, "model.model1_v2", "c", transformation_type="source", change_status="added", parents=[])
    assert_model(result, "model.model2", parents=["model.model1_v2"], change_category="breaking", impacted=True)
    assert_cll_contain_nodes(result, ["model.model1_v2", "model.model2"])
    assert_cll_contain_columns(result, [("model.model1_v2", "c"), ("model.model2", "c")])


def test_impact_radius_by_node_no_cll(dbt_test_helper):
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
    result = adapter.get_cll(node_id="model.model2", change_analysis=True, no_cll=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model2", "model.model3", "model.model4"])

    # non-breaking
    result = adapter.get_cll(node_id="model.model1", change_analysis=True, no_cll=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model1"])


def test_impact_radius_by_node_with_cll(dbt_test_helper):
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

    result = adapter.get_cll(node_id="model.model2", change_analysis=True, no_upstream=True)
    assert_model(result, "model.model2", parents=[], change_category="partial_breaking", impacted=False)
    assert_model(result, "model.model3", parents=[('model.model2', 'y')], impacted=True)
    assert_column(result, "model.model2", "y", transformation_type="source", parents=[], change_status="modified")
    assert_cll_contain_nodes(result, ["model.model2", "model.model3"])
    assert_cll_contain_columns(result, [("model.model2", "y"), ("model.model4", "y")])

    result = adapter.get_cll(node_id="model.model1", change_analysis=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model1"])
    assert_cll_contain_columns(result, [("model.model1", "d")])
    assert_model(result, "model.model1", parents=[], change_category="non_breaking", impacted=False)
    assert_column(result, "model.model1", "d", transformation_type="source", parents=[], change_status="added")


def test_impact_radius_by_node_with_cll_2(dbt_test_helper):
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

    result = adapter.get_cll(node_id="model.model2", change_analysis=True, no_upstream=True)
    assert_model(result, "model.model2", parents=[], change_category="breaking", impacted=True)
    assert_column(result, "model.model2", "y", transformation_type="source", parents=[], change_status="modified")
    assert_model(result, "model.model3", parents=["model.model2", ("model.model2", "y")], impacted=True)
    assert_model(result, "model.model4", parents=["model.model2"], impacted=True)
    assert_column(result, "model.model4", "y", transformation_type="passthrough", parents=[("model.model2", "y")])
    assert_cll_contain_nodes(result, ["model.model2", "model.model3", "model.model4"])
    assert_cll_contain_columns(result, [("model.model2", "d"), ("model.model2", "y"), ("model.model4", "y")])
