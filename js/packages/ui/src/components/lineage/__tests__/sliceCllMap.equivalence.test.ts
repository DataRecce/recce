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
// stg_orders: modified column def, int_store_revenue: WHERE clause added).
// Full map captured with full_map=true (all 99 nodes). Each node/column
// fixture captured via classic API call for comparison.
// ============================================================================

const diffFullMap = loadFixture("diff/cll-diff-full-map");

// Helper to build a column test case
function col(nodeId: string, column: string): TestCase {
  const safeCol = `${nodeId}_${column}`.replaceAll(".", "_");
  return {
    label: `${nodeId.split(".").pop()}.${column}`,
    fixture: `diff/cll-diff-col-${safeCol}`,
    params: { node_id: nodeId, column, change_analysis: true },
  };
}

// Helper to build a node test case
function node(nodeId: string, label?: string): TestCase {
  const safe = nodeId.replaceAll(".", "_");
  return {
    label: label ?? nodeId.split(".").pop()!,
    fixture: `diff/cll-diff-node-${safe}`,
    params: { node_id: nodeId, change_analysis: true },
  };
}

// --- Changed nodes ---
const INT_STORE_REV = "model.jaffle_shop.int_store_revenue";
const STG_ORDERS = "model.jaffle_shop.stg_orders";
const STG_CUSTOMERS = "model.jaffle_shop.stg_customers";
// --- Downstream / impacted nodes ---
const ORDERS = "model.jaffle_shop.orders";
const INT_ORDER_ENRICHED = "model.jaffle_shop.int_order_enriched";
const STORE_RANKINGS = "model.jaffle_shop.store_rankings";
const ORDER_RETURNS = "model.jaffle_shop.order_returns";

const DIFF_NODE_TESTS: TestCase[] = [
  node(STG_CUSTOMERS, "stg_customers (non_breaking)"),
  node(STG_ORDERS, "stg_orders (partial_breaking)"),
  node(INT_STORE_REV, "int_store_revenue (breaking)"),
  node(ORDERS, "orders (downstream)"),
  node(INT_ORDER_ENRICHED, "int_order_enriched (downstream)"),
  node(STORE_RANKINGS, "store_rankings (far downstream)"),
  node(ORDER_RETURNS, "order_returns (downstream)"),
];

const DIFF_COLUMN_TESTS: TestCase[] = [
  // int_store_revenue: breaking, 5 columns
  col(INT_STORE_REV, "store_id"),
  col(INT_STORE_REV, "order_count"),
  col(INT_STORE_REV, "unique_customers"),
  col(INT_STORE_REV, "total_revenue"),
  col(INT_STORE_REV, "total_cost"),
  // stg_orders: partial_breaking, 4 columns
  col(STG_ORDERS, "status"),
  col(STG_ORDERS, "order_id"),
  col(STG_ORDERS, "customer_id"),
  col(STG_ORDERS, "order_date"),
  // stg_customers: non_breaking, 4 columns
  col(STG_CUSTOMERS, "full_name"),
  col(STG_CUSTOMERS, "customer_id"),
  col(STG_CUSTOMERS, "first_name"),
  col(STG_CUSTOMERS, "last_name"),
  // orders: downstream, 5 columns (reaches outside impact scope)
  col(ORDERS, "order_id"),
  col(ORDERS, "customer_id"),
  col(ORDERS, "order_date"),
  col(ORDERS, "status"),
  col(ORDERS, "credit_card_amount"),
  // int_order_enriched: downstream, 5 columns
  col(INT_ORDER_ENRICHED, "order_id"),
  col(INT_ORDER_ENRICHED, "customer_id"),
  col(INT_ORDER_ENRICHED, "order_date"),
  col(INT_ORDER_ENRICHED, "status"),
  col(INT_ORDER_ENRICHED, "item_count"),
  // store_rankings: far downstream, 5 columns
  col(STORE_RANKINGS, "store_id"),
  col(STORE_RANKINGS, "store_name"),
  col(STORE_RANKINGS, "city"),
  col(STORE_RANKINGS, "state"),
  col(STORE_RANKINGS, "total_revenue"),
  // order_returns: downstream, 5 columns
  col(ORDER_RETURNS, "order_id"),
  col(ORDER_RETURNS, "customer_id"),
  col(ORDER_RETURNS, "order_date"),
  col(ORDER_RETURNS, "status"),
  col(ORDER_RETURNS, "credit_card_amount"),
];

describe("sliceCllMap equivalence with diff fixtures", () => {
  describe("impact overview", () => {
    it("matches server impact overview", () => {
      const serverResult = loadFixture("diff/cll-diff-impact-overview");
      const clientResult = sliceCllMap(diffFullMap, {
        change_analysis: true,
      });
      assertEquivalent("impact-overview", clientResult, serverResult);
    });
  });

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
