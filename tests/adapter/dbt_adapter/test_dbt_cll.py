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

    assert (
        entry.impacted == impacted
    ), f"Node {node_id} impacted status mismatch: expected {impacted}, got {entry.impacted}"


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


def test_cll_basic(dbt_test_helper, disable_cll_cache):
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


def test_cll_table_alisa(dbt_test_helper, disable_cll_cache):
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


def test_get_parent_table_name(dbt_test_helper):
    """_get_parent_table_name returns alias for nodes, identifier for sources, None for unknown."""

    def patch_alias(node):
        node["alias"] = "custom_alias"

    dbt_test_helper.create_model(
        "model1", unique_id="model.model1", curr_sql="select 1 as c", curr_columns={"c": "int"}, patch_func=patch_alias
    )

    csv_data = """
    id,name
    1,Alice
    """
    dbt_test_helper.create_source(
        "src", "tbl", unique_id="source.src.tbl", curr_csv=csv_data, curr_columns={"id": "int", "name": "varchar"}
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter
    from recce.adapter.dbt_adapter import as_manifest

    manifest = as_manifest(adapter.get_manifest(base=False))

    # Model node → returns alias
    assert adapter._get_parent_table_name(manifest, "model.model1") == "custom_alias"

    # Source node → returns identifier (defaults to table name)
    assert adapter._get_parent_table_name(manifest, "source.src.tbl") == "tbl"

    # Unknown node → returns None
    assert adapter._get_parent_table_name(manifest, "exposure.unknown") is None


def test_build_schema_from_aliases(dbt_test_helper):
    """_build_schema_from_aliases builds schema keyed by alias, skips unknown parents."""
    dbt_test_helper.create_model(
        "model1", unique_id="model.model1", curr_sql="select 1 as c", curr_columns={"c": "int"}
    )

    csv_data = """
    id,name
    1,Alice
    """
    dbt_test_helper.create_source(
        "src", "tbl", unique_id="source.src.tbl", curr_csv=csv_data, curr_columns={"id": "int", "name": "varchar"}
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter
    from recce.adapter.dbt_adapter import as_manifest

    manifest = as_manifest(adapter.get_manifest(base=False))
    catalog = adapter.curr_catalog

    # Mix of model, source, and unknown parent
    parent_list = ["model.model1", "source.src.tbl", "exposure.unknown"]
    schema = adapter._build_schema_from_aliases(manifest, catalog, parent_list)

    # model1 columns from catalog
    assert "model1" in schema
    assert "c" in schema["model1"]

    # source columns from catalog
    assert "tbl" in schema
    assert "id" in schema["tbl"]

    # Unknown parent is skipped
    assert len(schema) == 2

    # With catalog=None → empty schema
    assert adapter._build_schema_from_aliases(manifest, None, parent_list) == {}


def _set_compiled_code(adapter, node_id, compiled_code, base=False):
    """Set compiled_code on a manifest node after set_artifacts has been called.

    The test helper's set_artifacts round-trips through writable_manifest() which
    strips compiled_code. This helper patches it back directly on both the
    WritableManifest and the resolved Manifest used by the adapter.
    """
    writable = adapter.curr_manifest if not base else adapter.base_manifest
    if node_id in writable.nodes:
        writable.nodes[node_id].compiled_code = compiled_code
        writable.nodes[node_id].compiled = True

    resolved = adapter.manifest if not base else adapter.previous_state.manifest
    if node_id in resolved.nodes:
        resolved.nodes[node_id].compiled_code = compiled_code
        resolved.nodes[node_id].compiled = True


def test_cll_with_compiled_code(dbt_test_helper):
    """When compiled_code is set on the manifest node, skip Jinja rendering and use it directly."""
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
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    _set_compiled_code(adapter, "model.model2", 'select c from "main"."model1" where c > 0')

    result = adapter.get_cll("model.model1", "c")
    assert_model(result, "model.model2", parents=[("model.model1", "c")])
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[("model.model1", "c")])


def test_cll_with_compiled_code_custom_alias(dbt_test_helper):
    """compiled_code uses the parent's custom alias as the table name."""

    def patch_alias(node):
        node["alias"] = "model1_alias"

    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        curr_columns={"c": "int"},
        patch_func=patch_alias,
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c from {{ ref("model1") }}',
        curr_columns={"c": "int"},
        depends_on=["model.model1"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    _set_compiled_code(adapter, "model.model2", 'select c from "main"."model1_alias"')

    result = adapter.get_cll("model.model1", "c")
    assert_column(result, "model.model2", "c", transformation_type="passthrough", parents=[("model.model1", "c")])


def test_cll_with_compiled_code_source(dbt_test_helper):
    """compiled_code with source parent uses the source's identifier for table mapping."""
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
    _set_compiled_code(adapter, "model.model1", 'select customer_id from "main"."table1"')

    result = adapter.get_cll("model.model1")
    assert_column(result, "source.source1.table1", "customer_id", transformation_type="source", parents=[])
    assert_column(
        result,
        "model.model1",
        "customer_id",
        transformation_type="passthrough",
        parents=[("source.source1.table1", "customer_id")],
    )


def test_cll_with_compiled_code_multiple_parents(dbt_test_helper):
    """compiled_code with multiple parent models resolves all table references correctly."""
    dbt_test_helper.create_model(
        "model1", unique_id="model.model1", curr_sql="select 1 as id, 2 as a", curr_columns={"id": "int", "a": "int"}
    )
    dbt_test_helper.create_model(
        "model2", unique_id="model.model2", curr_sql="select 1 as id, 3 as b", curr_columns={"id": "int", "b": "int"}
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select model1.a, model2.b from {{ ref("model1") }} join {{ ref("model2") }} on model1.id = model2.id',
        curr_columns={"a": "int", "b": "int"},
        depends_on=["model.model1", "model.model2"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    _set_compiled_code(
        adapter,
        "model.model3",
        'select "main"."model1".a, "main"."model2".b '
        'from "main"."model1" '
        'join "main"."model2" on "main"."model1".id = "main"."model2".id',
    )

    # When tracing a specific column, result contains columns (not nodes)
    result = adapter.get_cll("model.model1", "a")
    assert_cll_contain_columns(result, [("model.model1", "a"), ("model.model3", "a")])
    assert_column(result, "model.model3", "a", transformation_type="passthrough", parents=[("model.model1", "a")])


def test_cll_with_compiled_code_alias_collision_falls_back(dbt_test_helper):
    """When two parent nodes have the same alias, fall back to Jinja rendering."""

    def patch_alias_orders(node):
        node["alias"] = "orders"

    dbt_test_helper.create_model(
        "stg_orders",
        unique_id="model.pkg1.stg_orders",
        curr_sql="select 1 as id",
        curr_columns={"id": "int"},
        patch_func=patch_alias_orders,
    )
    dbt_test_helper.create_model(
        "raw_orders",
        unique_id="model.pkg2.raw_orders",
        curr_sql="select 1 as id",
        curr_columns={"id": "int"},
        patch_func=patch_alias_orders,
    )
    dbt_test_helper.create_model(
        "final",
        unique_id="model.final",
        curr_sql='select a.id from {{ ref("stg_orders") }} a join {{ ref("raw_orders") }} b on a.id = b.id',
        curr_columns={"id": "int"},
        depends_on=["model.pkg1.stg_orders", "model.pkg2.raw_orders"],
    )
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    # Even with compiled_code set, the collision should trigger Jinja fallback
    _set_compiled_code(
        adapter, "model.final", 'select a.id from "main"."orders" a join "main"."orders" b on a.id = b.id'
    )

    # Should still produce correct CLL via Jinja fallback
    result = adapter.get_cll("model.final")
    assert_column(
        result, "model.final", "id", transformation_type="passthrough", parents=[("model.pkg1.stg_orders", "id")]
    )


def test_seed(dbt_test_helper, disable_cll_cache):
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


def test_python_model(dbt_test_helper, disable_cll_cache):
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


def test_source(dbt_test_helper, disable_cll_cache):
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


def test_parse_error(dbt_test_helper, disable_cll_cache):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c", curr_columns={"c": "int"})
    dbt_test_helper.create_model("model2", curr_sql="this is not a valid sql", curr_columns={"c": "int"})
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll("model2")
    assert_column(result, "model2", "c", transformation_type="unknown", parents=[])


def test_model_without_catalog(dbt_test_helper, disable_cll_cache):
    dbt_test_helper.create_model("model1", curr_sql="select 1 as c")
    adapter: DbtAdapter = dbt_test_helper.context.adapter
    result = adapter.get_cll("model1")
    assert not result.nodes["model1"].columns


def test_column_level_lineage(dbt_test_helper, disable_cll_cache):
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


def test_impact_radius_with_change_analysis_with_cll(dbt_test_helper, disable_cll_cache):
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


def test_impact_radius_with_change_analysis_with_cll_added_removed(dbt_test_helper, disable_cll_cache):
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


def test_impact_radius_by_node_with_cll(dbt_test_helper, disable_cll_cache):
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
    assert_model(result, "model.model3", parents=[("model.model2", "y")], impacted=True)
    assert_column(result, "model.model2", "y", transformation_type="source", parents=[], change_status="modified")
    assert_cll_contain_nodes(result, ["model.model2", "model.model3"])
    assert_cll_contain_columns(result, [("model.model2", "y"), ("model.model4", "y")])

    result = adapter.get_cll(node_id="model.model1", change_analysis=True, no_upstream=True)
    assert_cll_contain_nodes(result, ["model.model1"])
    assert_cll_contain_columns(result, [("model.model1", "d")])
    assert_model(result, "model.model1", parents=[], change_category="non_breaking", impacted=False)
    assert_column(result, "model.model1", "d", transformation_type="source", parents=[], change_status="added")


def test_impact_radius_by_node_with_cll_2(dbt_test_helper, disable_cll_cache):
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


def test_build_full_cll_map(dbt_test_helper):
    """Full map should contain ALL models, not just changed ones."""
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 1 as c",
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
    )
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c, 2025 as y from {{ ref("model1") }}',
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

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # Build full map — should include ALL 3 models even though none changed
    full_map = adapter.build_full_cll_map()

    # All 3 models should be present
    assert "model.model1" in full_map.nodes
    assert "model.model2" in full_map.nodes
    assert "model.model3" in full_map.nodes

    # Columns should be present
    assert "model.model1_c" in full_map.columns
    assert "model.model2_c" in full_map.columns
    assert "model.model2_y" in full_map.columns
    assert "model.model3_c" in full_map.columns

    # Parent map should have entries
    assert "model.model2" in full_map.parent_map
    assert "model.model3" in full_map.parent_map

    # Child map should be built
    assert len(full_map.child_map) > 0


def test_build_full_cll_map_is_cached(dbt_test_helper):
    """Second call should return the same cached object."""
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c",
        base_sql="select 1 as c",
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    first = adapter.build_full_cll_map()
    second = adapter.build_full_cll_map()
    assert first is second  # Same object reference = cached


def test_build_full_cll_map_with_changes(dbt_test_helper):
    """Full map should include change_status and change_category for changed nodes."""
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
    # Unchanged model
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }} where y < 2025',
        base_sql='select c from {{ ref("model2") }} where y < 2025',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter
    full_map = adapter.build_full_cll_map()

    # Changed nodes should have change metadata
    assert full_map.nodes["model.model1"].change_status is not None
    assert full_map.nodes["model.model2"].change_status is not None
    assert full_map.nodes["model.model2"].change_category == "breaking"

    # Unchanged model3 should still be present
    assert "model.model3" in full_map.nodes

    # All 3 models present (not filtered to just changed ones)
    assert len(full_map.nodes) == 3


def test_get_cll_uses_full_map_for_unchanged_model(dbt_test_helper, disable_cll_cache):
    """get_cll should return data for unchanged models (served from full map)."""
    # model1 is changed
    dbt_test_helper.create_model(
        "model1",
        unique_id="model.model1",
        curr_sql="select 1 as c, 2 as d",
        base_sql="select 1 as c",
        curr_columns={"c": "int", "d": "int"},
        base_columns={"c": "int"},
    )
    # model2 is unchanged
    dbt_test_helper.create_model(
        "model2",
        unique_id="model.model2",
        curr_sql='select c from {{ ref("model1") }}',
        base_sql='select c from {{ ref("model1") }}',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model1"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    # CLL for an unchanged model's column should work
    result = adapter.get_cll(node_id="model.model2", column="c")
    assert "model.model2_c" in result.columns or len(result.columns) > 0


def test_get_cll_full_map(dbt_test_helper):
    """full_map=True should return ALL nodes unfiltered."""
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
        base_sql='select c, 2025 as y from {{ ref("model1") }} where c > 0',
        curr_columns={"c": "int", "y": "int"},
        base_columns={"c": "int", "y": "int"},
        depends_on=["model.model1"],
    )
    dbt_test_helper.create_model(
        "model3",
        unique_id="model.model3",
        curr_sql='select c from {{ ref("model2") }}',
        base_sql='select c from {{ ref("model2") }}',
        curr_columns={"c": "int"},
        base_columns={"c": "int"},
        depends_on=["model.model2"],
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    result = adapter.get_cll(full_map=True)
    # All models present, unfiltered
    assert len(result.nodes) == 3
    assert "model.model1" in result.nodes
    assert "model.model2" in result.nodes
    assert "model.model3" in result.nodes

    # Change analysis included by default in full map
    assert result.nodes["model.model2"].change_category == "breaking"

    # Columns present for all models
    assert "model.model1_c" in result.columns
    assert "model.model2_c" in result.columns
    assert "model.model2_y" in result.columns
    assert "model.model3_c" in result.columns
