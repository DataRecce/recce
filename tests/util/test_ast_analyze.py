import unittest
from types import SimpleNamespace

from recce.models.types import CllColumn, CllData, CllNode
from recce.util.ast_analyze import (
    analyze_sql,
    collect_downstream,
    get_compiled_sql_from_manifest,
)


class TestAnalyzeSqlRefs(unittest.TestCase):
    def test_single_table_ref(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertEqual(result.refs, ["customers"])

    def test_multiple_table_refs_via_join(self):
        sql = "SELECT o.id FROM orders o JOIN customers c ON o.customer_id = c.id"
        result = analyze_sql(sql)
        self.assertEqual(sorted(result.refs), ["customers", "orders"])

    def test_unparseable_sql_returns_unparseable_flag(self):
        result = analyze_sql("SELECT FROM WHERE")
        self.assertTrue(result.unparseable)


class TestAnalyzeSqlProjections(unittest.TestCase):
    def test_simple_columns(self):
        result = analyze_sql("SELECT id, name FROM customers")
        names = [p.name for p in result.projections]
        self.assertEqual(names, ["id", "name"])

    def test_aliased_column_uses_alias_as_name(self):
        result = analyze_sql("SELECT id AS customer_id FROM customers")
        self.assertEqual(result.projections[0].name, "customer_id")
        self.assertEqual(result.projections[0].source_columns, ["id"])

    def test_passthrough_column_is_not_derived(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertFalse(result.projections[0].is_derived)
        self.assertFalse(result.projections[0].is_aggregate)

    def test_derived_column_flagged(self):
        result = analyze_sql("SELECT UPPER(name) AS upper_name FROM customers")
        proj = result.projections[0]
        self.assertEqual(proj.name, "upper_name")
        self.assertTrue(proj.is_derived)
        self.assertFalse(proj.is_aggregate)
        self.assertEqual(proj.source_columns, ["name"])

    def test_aggregate_column_flagged(self):
        result = analyze_sql("SELECT SUM(amount) AS total FROM orders")
        proj = result.projections[0]
        self.assertEqual(proj.name, "total")
        self.assertTrue(proj.is_aggregate)
        self.assertEqual(proj.source_columns, ["amount"])

    def test_star_projection(self):
        result = analyze_sql("SELECT * FROM customers")
        self.assertEqual(len(result.projections), 1)
        self.assertEqual(result.projections[0].name, "*")


class TestAnalyzeSqlFilters(unittest.TestCase):
    def test_no_where_returns_empty(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertEqual(result.filters, [])

    def test_single_where_predicate(self):
        result = analyze_sql("SELECT id FROM customers WHERE status = 'active'")
        self.assertEqual(len(result.filters), 1)
        self.assertIn("status = 'active'", result.filters[0])

    def test_where_with_and_splits_into_multiple_predicates(self):
        sql = "SELECT id FROM customers WHERE status = 'active' AND created_at > '2024-01-01'"
        result = analyze_sql(sql)
        self.assertEqual(len(result.filters), 2)
        joined = " | ".join(result.filters)
        self.assertIn("status = 'active'", joined)
        self.assertIn("created_at > '2024-01-01'", joined)


class TestAnalyzeSqlJoins(unittest.TestCase):
    def test_no_joins(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertEqual(result.joins, [])

    def test_inner_join_default(self):
        sql = "SELECT o.id FROM orders o JOIN customers c ON o.customer_id = c.id"
        result = analyze_sql(sql)
        self.assertEqual(len(result.joins), 1)
        join = result.joins[0]
        self.assertEqual(join.table, "customers")
        self.assertEqual(join.join_type, "INNER")
        self.assertIn("customer_id", join.condition)

    def test_left_join(self):
        sql = "SELECT o.id FROM orders o LEFT JOIN customers c ON o.customer_id = c.id"
        result = analyze_sql(sql)
        self.assertEqual(result.joins[0].join_type, "LEFT")

    def test_cross_join_has_no_condition(self):
        sql = "SELECT a.id FROM a CROSS JOIN b"
        result = analyze_sql(sql)
        self.assertEqual(result.joins[0].join_type, "CROSS")
        self.assertIsNone(result.joins[0].condition)


class TestAnalyzeSqlGroupByHavingOrderBy(unittest.TestCase):
    def test_group_by_columns(self):
        sql = "SELECT status, COUNT(*) FROM orders GROUP BY status"
        result = analyze_sql(sql)
        self.assertEqual(result.group_by, ["status"])

    def test_group_by_multiple_columns(self):
        sql = "SELECT a, b, COUNT(*) FROM t GROUP BY a, b"
        result = analyze_sql(sql)
        self.assertEqual(result.group_by, ["a", "b"])

    def test_having(self):
        sql = "SELECT status, COUNT(*) c FROM orders GROUP BY status HAVING COUNT(*) > 10"
        result = analyze_sql(sql)
        self.assertEqual(len(result.having), 1)
        self.assertIn("COUNT(*) > 10", result.having[0])

    def test_order_by(self):
        sql = "SELECT id FROM orders ORDER BY created_at DESC, id"
        result = analyze_sql(sql)
        self.assertEqual(len(result.order_by), 2)
        joined = " | ".join(result.order_by)
        self.assertIn("created_at", joined)
        self.assertIn("id", joined)


class TestAnalyzeSqlAggregations(unittest.TestCase):
    def test_sum_aggregation(self):
        result = analyze_sql("SELECT SUM(amount) FROM orders")
        self.assertEqual(len(result.aggregations), 1)
        agg = result.aggregations[0]
        self.assertEqual(agg.function, "SUM")
        self.assertEqual(agg.column, "amount")

    def test_count_star_has_no_column(self):
        result = analyze_sql("SELECT COUNT(*) FROM orders")
        agg = result.aggregations[0]
        self.assertEqual(agg.function, "COUNT")
        self.assertIsNone(agg.column)

    def test_multiple_aggregations(self):
        sql = "SELECT SUM(amount), AVG(amount), MAX(created_at) FROM orders"
        result = analyze_sql(sql)
        funcs = sorted(a.function for a in result.aggregations)
        self.assertEqual(funcs, ["AVG", "MAX", "SUM"])


class TestAnalyzeSqlCaseExpressions(unittest.TestCase):
    def test_no_case(self):
        result = analyze_sql("SELECT id FROM orders")
        self.assertEqual(result.case_expressions, [])

    def test_single_case(self):
        sql = "SELECT CASE WHEN status = 'active' THEN 1 ELSE 0 END AS is_active FROM orders"
        result = analyze_sql(sql)
        self.assertEqual(len(result.case_expressions), 1)
        self.assertIn("CASE", result.case_expressions[0])

    def test_multiple_case(self):
        sql = "SELECT CASE WHEN a > 0 THEN 1 ELSE 0 END AS x, " "CASE WHEN b > 0 THEN 1 ELSE 0 END AS y FROM t"
        result = analyze_sql(sql)
        self.assertEqual(len(result.case_expressions), 2)


class TestAnalyzeSqlFlags(unittest.TestCase):
    def test_distinct_false_by_default(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertFalse(result.distinct)

    def test_distinct_true(self):
        result = analyze_sql("SELECT DISTINCT id FROM customers")
        self.assertTrue(result.distinct)

    def test_has_subquery_false(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertFalse(result.has_subquery)

    def test_has_subquery_true(self):
        sql = "SELECT id FROM customers WHERE id IN (SELECT customer_id FROM orders)"
        result = analyze_sql(sql)
        self.assertTrue(result.has_subquery)

    def test_has_cte_false(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertFalse(result.has_cte)

    def test_has_cte_true(self):
        sql = "WITH active AS (SELECT id FROM customers WHERE status='active') SELECT * FROM active"
        result = analyze_sql(sql)
        self.assertTrue(result.has_cte)

    def test_is_set_operation_false_for_plain_select(self):
        result = analyze_sql("SELECT id FROM customers")
        self.assertFalse(result.is_set_operation)


class TestAnalyzeSqlCteRefsExclusion(unittest.TestCase):
    """CTE alias names must not appear in refs — only real upstream tables."""

    def test_cte_alias_excluded_from_refs(self):
        sql = (
            "WITH source AS (SELECT * FROM analytics.staging.stg_customers), "
            "renamed AS (SELECT customer_id AS id FROM source) "
            "SELECT * FROM renamed"
        )
        result = analyze_sql(sql)
        self.assertEqual(result.refs, ["stg_customers"])
        self.assertNotIn("source", result.refs)
        self.assertNotIn("renamed", result.refs)

    def test_real_table_kept_when_name_collides_with_cte_in_other_query(self):
        # CTE filtering is per-query: a CTE named `orders` inside this model
        # should drop the `orders` ref, since the outer select reads from
        # the CTE, not the upstream table.
        sql = "WITH orders AS (SELECT id FROM customers) SELECT id FROM orders"
        result = analyze_sql(sql)
        self.assertEqual(result.refs, ["customers"])

    def test_qualified_table_not_dropped_by_unqualified_cte_collision(self):
        # If a CTE is named `orders` and the query also reads `raw.orders`,
        # the qualified ref must survive — CTE shadowing applies only to
        # unqualified identifiers.
        sql = (
            "WITH orders AS (SELECT id FROM staging_orders) "
            "SELECT id FROM orders WHERE id IN (SELECT order_id FROM raw.orders)"
        )
        result = analyze_sql(sql)
        self.assertIn("orders", result.refs)
        self.assertIn("staging_orders", result.refs)

    def test_three_part_qualified_ref_not_dropped_by_cte_collision(self):
        # `catalog.schema.orders` carries a catalog as well as a db — the CTE
        # exclusion must still let it through.
        sql = (
            "WITH orders AS (SELECT id FROM staging_orders) "
            "SELECT id FROM orders UNION ALL SELECT id FROM analytics.public.orders"
        )
        result = analyze_sql(sql)
        self.assertIn("orders", result.refs)
        self.assertIn("staging_orders", result.refs)


class TestAnalyzeSqlSetOperations(unittest.TestCase):
    """UNION / INTERSECT / EXCEPT must produce merged structure, not silent empty."""

    def test_union_marks_is_set_operation(self):
        result = analyze_sql("SELECT a FROM t1 UNION SELECT b FROM t2")
        self.assertTrue(result.is_set_operation)

    def test_union_merges_refs(self):
        result = analyze_sql("SELECT a FROM t1 UNION SELECT b FROM t2")
        self.assertEqual(sorted(result.refs), ["t1", "t2"])

    def test_union_merges_projections_from_all_legs(self):
        sql = "SELECT id, name FROM customers UNION ALL SELECT id, name FROM archived_customers"
        result = analyze_sql(sql)
        names = [p.name for p in result.projections]
        # Both legs contribute: structurally informative for the agent.
        self.assertEqual(names, ["id", "name", "id", "name"])

    def test_union_merges_filters_from_each_leg(self):
        sql = (
            "SELECT id FROM customers WHERE status = 'active' "
            "UNION ALL "
            "SELECT id FROM archived_customers WHERE archived_at > '2024-01-01'"
        )
        result = analyze_sql(sql)
        self.assertEqual(len(result.filters), 2)
        joined = " | ".join(result.filters)
        self.assertIn("status = 'active'", joined)
        self.assertIn("archived_at", joined)

    def test_union_all_chain_recurses(self):
        sql = "SELECT a FROM t1 UNION ALL SELECT a FROM t2 UNION ALL SELECT a FROM t3"
        result = analyze_sql(sql)
        self.assertEqual(sorted(result.refs), ["t1", "t2", "t3"])
        self.assertEqual(len(result.projections), 3)

    def test_union_distinct_true_when_any_leg_distinct(self):
        sql = "SELECT DISTINCT a FROM t1 UNION ALL SELECT a FROM t2"
        result = analyze_sql(sql)
        self.assertTrue(result.distinct)

    def test_intersect_marks_is_set_operation(self):
        result = analyze_sql("SELECT a FROM t1 INTERSECT SELECT b FROM t2")
        self.assertTrue(result.is_set_operation)

    def test_intersect_merges_refs_and_projections(self):
        result = analyze_sql("SELECT id FROM t1 INTERSECT SELECT id FROM t2")
        self.assertEqual(sorted(result.refs), ["t1", "t2"])
        self.assertEqual([p.name for p in result.projections], ["id", "id"])

    def test_intersect_merges_filters_from_each_leg(self):
        sql = (
            "SELECT id FROM customers WHERE status = 'active' "
            "INTERSECT "
            "SELECT id FROM archived_customers WHERE archived_at > '2024-01-01'"
        )
        result = analyze_sql(sql)
        self.assertEqual(len(result.filters), 2)
        joined = " | ".join(result.filters)
        self.assertIn("status = 'active'", joined)
        self.assertIn("archived_at", joined)

    def test_except_marks_is_set_operation(self):
        result = analyze_sql("SELECT a FROM t1 EXCEPT SELECT b FROM t2")
        self.assertTrue(result.is_set_operation)

    def test_except_merges_refs_and_projections(self):
        result = analyze_sql("SELECT id FROM t1 EXCEPT SELECT id FROM t2")
        self.assertEqual(sorted(result.refs), ["t1", "t2"])
        self.assertEqual([p.name for p in result.projections], ["id", "id"])

    def test_intersect_chain_recurses(self):
        sql = "SELECT a FROM t1 INTERSECT SELECT a FROM t2 INTERSECT SELECT a FROM t3"
        result = analyze_sql(sql)
        self.assertEqual(sorted(result.refs), ["t1", "t2", "t3"])
        self.assertEqual(len(result.projections), 3)

    def test_intersect_distinct_true_when_any_leg_distinct(self):
        result = analyze_sql("SELECT DISTINCT a FROM t1 INTERSECT SELECT a FROM t2")
        self.assertTrue(result.distinct)

    def test_mixed_union_and_intersect_merges_all_legs(self):
        # `a UNION b INTERSECT c` — both set-op kinds must contribute their legs.
        sql = "SELECT a FROM t1 UNION SELECT a FROM t2 INTERSECT SELECT a FROM t3"
        result = analyze_sql(sql)
        self.assertTrue(result.is_set_operation)
        self.assertEqual(sorted(result.refs), ["t1", "t2", "t3"])
        self.assertEqual(len(result.projections), 3)


class TestAnalyzeSqlDialect(unittest.TestCase):
    """Dialect must be forwarded to sqlglot — dialect-specific syntax must parse."""

    def test_bigquery_backticked_identifier_requires_dialect(self):
        sql = "SELECT user.name FROM `my-project.dataset.users` AS user"
        # Without dialect, sqlglot's default parser rejects the backticked
        # qualified identifier and the analyzer flags it unparseable.
        self.assertTrue(analyze_sql(sql).unparseable)
        # With dialect=bigquery, the same SQL parses and yields real refs.
        result = analyze_sql(sql, dialect="bigquery")
        self.assertFalse(result.unparseable)
        self.assertEqual(result.refs, ["users"])


def _fake_manifest(nodes: dict):
    """Build a duck-typed manifest object: manifest.nodes[model_id] -> SimpleNamespace."""
    return SimpleNamespace(nodes=nodes)


class TestGetCompiledSqlFromManifest(unittest.TestCase):
    def test_returns_compiled_code_when_present(self):
        node = SimpleNamespace(compiled_code="SELECT 1", raw_code="select 1", resource_type="model")
        manifest = _fake_manifest({"model.x.a": node})
        self.assertEqual(get_compiled_sql_from_manifest(manifest, "model.x.a"), "SELECT 1")

    def test_returns_none_when_node_missing(self):
        manifest = _fake_manifest({})
        self.assertIsNone(get_compiled_sql_from_manifest(manifest, "model.x.missing"))

    def test_returns_none_when_compiled_code_missing(self):
        node = SimpleNamespace(compiled_code=None, raw_code="select 1", resource_type="model")
        manifest = _fake_manifest({"model.x.a": node})
        self.assertIsNone(get_compiled_sql_from_manifest(manifest, "model.x.a"))

    def test_accepts_seed_and_snapshot(self):
        # Mirror CllNode.build_cll_node's accepted set: {model, seed, snapshot}.
        for resource_type in ("seed", "snapshot"):
            node = SimpleNamespace(compiled_code="SELECT 1", raw_code="select 1", resource_type=resource_type)
            manifest = _fake_manifest({f"{resource_type}.x.a": node})
            self.assertEqual(get_compiled_sql_from_manifest(manifest, f"{resource_type}.x.a"), "SELECT 1")

    def test_rejects_non_analyzable_resource_types(self):
        # Lock the allow-list contract: anything outside {model, seed, snapshot}
        # must raise — covers test, analysis, operation, exposure.
        for resource_type in ("test", "analysis", "operation", "exposure"):
            node = SimpleNamespace(compiled_code="SELECT * FROM dummy", raw_code="", resource_type=resource_type)
            manifest = _fake_manifest({f"{resource_type}.x.foo": node})
            with self.assertRaises(ValueError) as ctx:
                get_compiled_sql_from_manifest(manifest, f"{resource_type}.x.foo")
            # Error message should identify the rejected resource type so an agent can correct course.
            self.assertIn(resource_type, str(ctx.exception))


class TestCollectDownstream(unittest.TestCase):
    """Tests use the same CllData shape produced by DbtAdapter.build_full_cll_map:
    - CllData.child_map keyed by node_id and {node_id}_{column} (column_id),
      values are sets of downstream ids
    - CllData.columns[column_id] has table_id pointing back to owning node
    """

    def _cll_data(self):
        # a has columns x, y. b's b_x depends on a.x. c's c_y depends on a.y.
        # d is unrelated.
        nodes = {
            "model.x.a": CllNode(
                id="model.x.a",
                name="a",
                package_name="x",
                resource_type="model",
                columns={"x": CllColumn(name="x"), "y": CllColumn(name="y")},
            ),
            "model.x.b": CllNode(
                id="model.x.b",
                name="b",
                package_name="x",
                resource_type="model",
                columns={"b_x": CllColumn(name="b_x")},
            ),
            "model.x.c": CllNode(
                id="model.x.c",
                name="c",
                package_name="x",
                resource_type="model",
                columns={"c_y": CllColumn(name="c_y")},
            ),
            "model.x.d": CllNode(
                id="model.x.d",
                name="d",
                package_name="x",
                resource_type="model",
                columns={"d_z": CllColumn(name="d_z")},
            ),
        }
        columns = {
            "model.x.a_x": CllColumn(id="model.x.a_x", table_id="model.x.a", name="x"),
            "model.x.a_y": CllColumn(id="model.x.a_y", table_id="model.x.a", name="y"),
            "model.x.b_b_x": CllColumn(id="model.x.b_b_x", table_id="model.x.b", name="b_x"),
            "model.x.c_c_y": CllColumn(id="model.x.c_c_y", table_id="model.x.c", name="c_y"),
            "model.x.d_d_z": CllColumn(id="model.x.d_d_z", table_id="model.x.d", name="d_z"),
        }
        child_map = {
            "model.x.a": {"model.x.b", "model.x.c"},
            "model.x.a_x": {"model.x.b_b_x"},
            "model.x.a_y": {"model.x.c_c_y"},
        }
        return CllData(nodes=nodes, columns=columns, child_map=child_map)

    def test_lists_downstream_models(self):
        result = collect_downstream(self._cll_data(), "model.x.a")
        self.assertEqual(sorted(result["models"]), ["model.x.b", "model.x.c"])

    def test_lists_downstream_columns(self):
        result = collect_downstream(self._cll_data(), "model.x.a")
        cols_set = {(c["node"], c["column"]) for c in result["columns"]}
        self.assertEqual(cols_set, {("model.x.b", "b_x"), ("model.x.c", "c_y")})

    def test_excludes_self_and_unrelated_models(self):
        result = collect_downstream(self._cll_data(), "model.x.a")
        self.assertNotIn("model.x.a", result["models"])
        self.assertNotIn("model.x.d", result["models"])

    def test_returns_empty_when_model_unknown(self):
        result = collect_downstream(self._cll_data(), "model.x.does_not_exist")
        self.assertEqual(result, {"models": [], "columns": []})
