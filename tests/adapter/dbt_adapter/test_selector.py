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
    node_ids = adapter.select_nodes("customers_1")
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes("resource_type:model")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("tag:test_tag")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("tag:test_tag2")
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
    node_ids = adapter.select_nodes(exclude="customers_1")
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes("customers_1", exclude="customers_2")
    assert len(node_ids) == 1

    # Test graph operation
    node_ids = adapter.select_nodes("state:modified+")
    assert len(node_ids) == 2
    node_ids = adapter.select_nodes("+state:modified")
    assert len(node_ids) == 1

    # Test resource type: snapshot
    dbt_test_helper.create_snapshot("snapshot_1", csv_data_base, csv_data_curr)
    dbt_test_helper.create_model("use_snapshot", csv_data_base, csv_data_base, depends_on=["snapshot_1"])

    node_ids = adapter.select_nodes("resource_type:snapshot")
    assert len(node_ids) == 1

    node_ids = adapter.select_nodes("resource_type:snapshot+")
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
    customers_1 ── customers_2 ─┬─ customers_3(*body) ─┬─ other_package.customers_4
                                │                      └─ customers_5
                                └─ customers_6(*config-only)

    customers_3 has a body change. customers_6 has a config-only change
    (same raw_code, different unrendered_config) — it should be picked up
    by `changed_models` but excluded from `body_changes`.
    """
    base_schema = dbt_test_helper.base_schema

    def _config_only_patch(node_dict):
        # Differentiate base/curr by the schema dbt_test_helper assigns; tweak
        # only the unrendered_config so same_body() stays True but
        # same_config() becomes False — exactly the config-only case.
        # `tags` is CompareBehavior.Exclude in NodeConfig, so vary `meta`
        # (which is part of same_contents comparison).
        if node_dict["schema"] == base_schema:
            node_dict["unrendered_config"] = {"materialized": "table", "meta": {"owner": "team_a"}}
        else:
            node_dict["unrendered_config"] = {"materialized": "table", "meta": {"owner": "team_b"}}

    dbt_test_helper.create_model("customers_1", csv_data_base, csv_data_base)
    dbt_test_helper.create_model("customers_2", csv_data_base, csv_data_base, depends_on=["customers_1"])
    dbt_test_helper.create_model("customers_3", csv_data_base, csv_data_curr, depends_on=["customers_2"])
    dbt_test_helper.create_model(
        "customers_4", csv_data_base, csv_data_base, depends_on=["customers_3"], package_name="other_package"
    )
    dbt_test_helper.create_model("customers_5", csv_data_base, csv_data_base, depends_on=["customers_3"])
    dbt_test_helper.create_model(
        "customers_6",
        csv_data_base,
        csv_data_base,
        depends_on=["customers_2"],
        patch_func=_config_only_patch,
    )

    adapter: DbtAdapter = dbt_test_helper.context.adapter

    node_ids = adapter.select_nodes(packages=["other_package"])
    assert len(node_ids) == 1

    node_ids = adapter.select_nodes()
    assert len(node_ids) == 5

    # changed_models: 1+state:modified+ — picks up customers_6 (config-only)
    # plus the customers_3 chain (customers_2 upstream, customers_3, customers_5 downstream).
    changed_ids = adapter.select_nodes(view_mode="changed_models")
    assert len(changed_ids) == 4
    assert "customers_6" in changed_ids

    # body_changes: 1+state:modified.body+macros+contract — excludes customers_6
    # because same raw_code -> same_body() returns True. Strictly smaller than changed_models.
    body_ids = adapter.select_nodes(view_mode="body_changes")
    assert len(body_ids) == 3
    assert "customers_6" not in body_ids
    assert body_ids < changed_ids

    node_ids = adapter.select_nodes(view_mode="changed_models", packages=["other_package"])
    assert len(node_ids) == 1

    node_ids = adapter.select_nodes(view_mode="changed_models", packages=["other_package"], exclude="customers_4")
    assert len(node_ids) == 0
    node_ids = adapter.select_nodes(view_mode="changed_models", packages=["other_package"], select="customers_1+")
    assert len(node_ids) == 1
    node_ids = adapter.select_nodes(view_mode="changed_models", select="+customers_5")
    assert len(node_ids) == 3
    node_ids = adapter.select_nodes(view_mode="all", select="+customers_5")
    assert len(node_ids) == 4
    node_ids = adapter.select_nodes(select="+customers_5")
    assert len(node_ids) == 4
