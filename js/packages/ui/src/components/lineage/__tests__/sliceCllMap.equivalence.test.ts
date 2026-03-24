/**
 * Equivalence test: sliceCllMap() vs backend API responses
 *
 * Compares sliceCllMap(fullMap, params) against pre-captured backend responses
 * for the same params. Fixtures were captured from a running recce server
 * against jaffle_shop_duckdb.
 *
 * To regenerate fixtures: run /tmp/capture_cll_fixtures.py with a running server.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CllInput, ColumnLineageData } from "../../../api/cll";
import { sliceCllMap } from "../sliceCllMap";

const FIXTURES = join(__dirname, "fixtures");

function loadFixture(name: string): ColumnLineageData {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), "utf-8"));
}

function sortedKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).sort();
}

function sortMapValues(
  map: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(map)) {
    result[key] = [...val].sort();
  }
  return result;
}

/**
 * Compare sliceCllMap output against a server fixture.
 *
 * Checks: same nodes, same columns, same parent_map keys+values, same child_map keys+values.
 */
function assertEquivalent(
  label: string,
  client: ColumnLineageData,
  server: ColumnLineageData,
) {
  const clientNodes = sortedKeys(client.current.nodes);
  const serverNodes = sortedKeys(server.current.nodes);
  expect(clientNodes, `${label}: nodes`).toEqual(serverNodes);

  const clientCols = sortedKeys(client.current.columns);
  const serverCols = sortedKeys(server.current.columns);
  expect(clientCols, `${label}: columns`).toEqual(serverCols);

  const clientParent = sortMapValues(client.current.parent_map);
  const serverParent = sortMapValues(server.current.parent_map);
  expect(sortedKeys(clientParent), `${label}: parent_map keys`).toEqual(
    sortedKeys(serverParent),
  );
  for (const key of Object.keys(serverParent)) {
    expect(clientParent[key], `${label}: parent_map[${key}]`).toEqual(
      serverParent[key],
    );
  }

  const clientChild = sortMapValues(client.current.child_map);
  const serverChild = sortMapValues(server.current.child_map);
  expect(sortedKeys(clientChild), `${label}: child_map keys`).toEqual(
    sortedKeys(serverChild),
  );
  for (const key of Object.keys(serverChild)) {
    expect(clientChild[key], `${label}: child_map[${key}]`).toEqual(
      serverChild[key],
    );
  }
}

const fullMap = loadFixture("cll-full-map");

interface TestCase {
  label: string;
  fixture: string;
  params: CllInput;
}

const NODE_TESTS: TestCase[] = [
  {
    label: "order_discounts",
    fixture: "cll-node-model_jaffle_shop_order_discounts",
    params: {
      node_id: "model.jaffle_shop.order_discounts",
      change_analysis: true,
    },
  },
  {
    label: "order_discounts no_upstream",
    fixture: "cll-node-model_jaffle_shop_order_discounts-no-upstream",
    params: {
      node_id: "model.jaffle_shop.order_discounts",
      change_analysis: true,
      no_upstream: true,
    },
  },
  {
    label: "order_discounts no_downstream",
    fixture: "cll-node-model_jaffle_shop_order_discounts-no-downstream",
    params: {
      node_id: "model.jaffle_shop.order_discounts",
      change_analysis: true,
      no_downstream: true,
    },
  },
  {
    label: "stg_employees",
    fixture: "cll-node-model_jaffle_shop_stg_employees",
    params: {
      node_id: "model.jaffle_shop.stg_employees",
      change_analysis: true,
    },
  },
  {
    label: "stg_employees no_upstream",
    fixture: "cll-node-model_jaffle_shop_stg_employees-no-upstream",
    params: {
      node_id: "model.jaffle_shop.stg_employees",
      change_analysis: true,
      no_upstream: true,
    },
  },
  {
    label: "stg_employees no_downstream",
    fixture: "cll-node-model_jaffle_shop_stg_employees-no-downstream",
    params: {
      node_id: "model.jaffle_shop.stg_employees",
      change_analysis: true,
      no_downstream: true,
    },
  },
  {
    label: "revenue_summary",
    fixture: "cll-node-model_jaffle_shop_revenue_summary",
    params: {
      node_id: "model.jaffle_shop.revenue_summary",
      change_analysis: true,
    },
  },
  {
    label: "raw_stores",
    fixture: "cll-node-seed_jaffle_shop_raw_stores",
    params: {
      node_id: "seed.jaffle_shop.raw_stores",
      change_analysis: true,
    },
  },
  {
    label: "int_store_revenue",
    fixture: "cll-node-model_jaffle_shop_int_store_revenue",
    params: {
      node_id: "model.jaffle_shop.int_store_revenue",
      change_analysis: true,
    },
  },
];

const COLUMN_TESTS: TestCase[] = [
  {
    label: "order_discounts.order_id",
    fixture: "cll-col-model_jaffle_shop_order_discounts-order_id",
    params: {
      node_id: "model.jaffle_shop.order_discounts",
      column: "order_id",
      change_analysis: true,
    },
  },
  {
    label: "order_discounts.customer_id",
    fixture: "cll-col-model_jaffle_shop_order_discounts-customer_id",
    params: {
      node_id: "model.jaffle_shop.order_discounts",
      column: "customer_id",
      change_analysis: true,
    },
  },
  {
    label: "stg_employees.employee_id",
    fixture: "cll-col-model_jaffle_shop_stg_employees-employee_id",
    params: {
      node_id: "model.jaffle_shop.stg_employees",
      column: "employee_id",
      change_analysis: true,
    },
  },
  {
    label: "stg_employees.store_id",
    fixture: "cll-col-model_jaffle_shop_stg_employees-store_id",
    params: {
      node_id: "model.jaffle_shop.stg_employees",
      column: "store_id",
      change_analysis: true,
    },
  },
  {
    label: "revenue_summary.order_date",
    fixture: "cll-col-model_jaffle_shop_revenue_summary-order_date",
    params: {
      node_id: "model.jaffle_shop.revenue_summary",
      column: "order_date",
      change_analysis: true,
    },
  },
  {
    label: "revenue_summary.order_week",
    fixture: "cll-col-model_jaffle_shop_revenue_summary-order_week",
    params: {
      node_id: "model.jaffle_shop.revenue_summary",
      column: "order_week",
      change_analysis: true,
    },
  },
  {
    label: "raw_stores.id",
    fixture: "cll-col-seed_jaffle_shop_raw_stores-id",
    params: {
      node_id: "seed.jaffle_shop.raw_stores",
      column: "id",
      change_analysis: true,
    },
  },
  {
    label: "raw_stores.name",
    fixture: "cll-col-seed_jaffle_shop_raw_stores-name",
    params: {
      node_id: "seed.jaffle_shop.raw_stores",
      column: "name",
      change_analysis: true,
    },
  },
  {
    label: "int_store_revenue.store_id",
    fixture: "cll-col-model_jaffle_shop_int_store_revenue-store_id",
    params: {
      node_id: "model.jaffle_shop.int_store_revenue",
      column: "store_id",
      change_analysis: true,
    },
  },
  {
    label: "int_store_revenue.order_count",
    fixture: "cll-col-model_jaffle_shop_int_store_revenue-order_count",
    params: {
      node_id: "model.jaffle_shop.int_store_revenue",
      column: "order_count",
      change_analysis: true,
    },
  },
];

describe("sliceCllMap equivalence with backend fixtures", () => {
  describe("node-level (no changes)", () => {
    for (const tc of NODE_TESTS) {
      it(tc.label, () => {
        const serverResult = loadFixture(tc.fixture);
        const clientResult = sliceCllMap(fullMap, tc.params);
        assertEquivalent(tc.label, clientResult, serverResult);
      });
    }
  });

  describe("column-level (no changes)", () => {
    for (const tc of COLUMN_TESTS) {
      it(tc.label, () => {
        const serverResult = loadFixture(tc.fixture);
        const clientResult = sliceCllMap(fullMap, tc.params);
        assertEquivalent(tc.label, clientResult, serverResult);
      });
    }
  });
});

// ============================================================================
// Diff fixtures: server with actual dbt changes (stg_customers: added column,
// stg_orders: modified column def, int_store_revenue: WHERE clause added)
// ============================================================================

const diffFullMap = loadFixture("diff/cll-diff-full-map");

const DIFF_NODE_TESTS: TestCase[] = [
  // stg_customers: non_breaking (added column full_name)
  {
    label: "stg_customers (non_breaking)",
    fixture: "diff/cll-diff-node-model_jaffle_shop_stg_customers",
    params: {
      node_id: "model.jaffle_shop.stg_customers",
      change_analysis: true,
    },
  },
  {
    label: "stg_customers no_upstream",
    fixture: "diff/cll-diff-node-model_jaffle_shop_stg_customers-no-upstream",
    params: {
      node_id: "model.jaffle_shop.stg_customers",
      change_analysis: true,
      no_upstream: true,
    },
  },
  {
    label: "stg_customers no_downstream",
    fixture: "diff/cll-diff-node-model_jaffle_shop_stg_customers-no-downstream",
    params: {
      node_id: "model.jaffle_shop.stg_customers",
      change_analysis: true,
      no_downstream: true,
    },
  },
  // stg_orders: partial_breaking (modified status column def)
  {
    label: "stg_orders (partial_breaking)",
    fixture: "diff/cll-diff-node-model_jaffle_shop_stg_orders",
    params: {
      node_id: "model.jaffle_shop.stg_orders",
      change_analysis: true,
    },
  },
  {
    label: "stg_orders no_upstream",
    fixture: "diff/cll-diff-node-model_jaffle_shop_stg_orders-no-upstream",
    params: {
      node_id: "model.jaffle_shop.stg_orders",
      change_analysis: true,
      no_upstream: true,
    },
  },
  {
    label: "stg_orders no_downstream",
    fixture: "diff/cll-diff-node-model_jaffle_shop_stg_orders-no-downstream",
    params: {
      node_id: "model.jaffle_shop.stg_orders",
      change_analysis: true,
      no_downstream: true,
    },
  },
  // int_store_revenue: breaking (WHERE clause added)
  {
    label: "int_store_revenue (breaking)",
    fixture: "diff/cll-diff-node-model_jaffle_shop_int_store_revenue",
    params: {
      node_id: "model.jaffle_shop.int_store_revenue",
      change_analysis: true,
    },
  },
  {
    label: "int_store_revenue no_upstream",
    fixture:
      "diff/cll-diff-node-model_jaffle_shop_int_store_revenue-no-upstream",
    params: {
      node_id: "model.jaffle_shop.int_store_revenue",
      change_analysis: true,
      no_upstream: true,
    },
  },
  {
    label: "int_store_revenue no_downstream",
    fixture:
      "diff/cll-diff-node-model_jaffle_shop_int_store_revenue-no-downstream",
    params: {
      node_id: "model.jaffle_shop.int_store_revenue",
      change_analysis: true,
      no_downstream: true,
    },
  },
];

const DIFF_COLUMN_TESTS: TestCase[] = [
  {
    label: "stg_customers.full_name (added column)",
    fixture: "diff/cll-diff-col-model_jaffle_shop_stg_customers_full_name",
    params: {
      node_id: "model.jaffle_shop.stg_customers",
      column: "full_name",
      change_analysis: true,
    },
  },
  {
    label: "stg_orders.status (modified column)",
    fixture: "diff/cll-diff-col-model_jaffle_shop_stg_orders_status",
    params: {
      node_id: "model.jaffle_shop.stg_orders",
      column: "status",
      change_analysis: true,
    },
  },
];

describe("sliceCllMap equivalence with diff fixtures", () => {
  describe("node-level (with changes)", () => {
    for (const tc of DIFF_NODE_TESTS) {
      it(tc.label, () => {
        const serverResult = loadFixture(tc.fixture);
        const clientResult = sliceCllMap(diffFullMap, tc.params);
        assertEquivalent(tc.label, clientResult, serverResult);
      });
    }
  });

  describe("column-level (with changes)", () => {
    for (const tc of DIFF_COLUMN_TESTS) {
      it(tc.label, () => {
        const serverResult = loadFixture(tc.fixture);
        const clientResult = sliceCllMap(diffFullMap, tc.params);
        assertEquivalent(tc.label, clientResult, serverResult);
      });
    }
  });
});
