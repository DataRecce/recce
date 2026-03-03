/**
 * @file runFixtures.ts
 * @description Test fixtures for Run objects used to test ResultView components
 *
 * Each fixture returns a valid Run object matching the expected type.
 * Uses realistic but minimal test data.
 */

import type {
  HistogramDiffResult,
  ProfileDiffResult,
  QueryDiffResult,
  QueryResult,
  RowCountDiffResult,
  RowCountResult,
  Run,
  TopKDiffResult,
  ValueDiffResult,
} from "@datarecce/ui/api";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique run ID for test fixtures
 */
function generateRunId(): string {
  return `test-run-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get current ISO timestamp for run_at field
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

// ============================================================================
// Row Count Fixtures
// ============================================================================

/**
 * Creates a row_count_diff run fixture with sample data
 * Shows base vs current row counts for multiple models
 */
export function createRowCountDiffRun(): Extract<
  Run,
  { type: "row_count_diff" }
> {
  const result: RowCountDiffResult = {
    orders: { base: 1000, curr: 1050 },
    customers: { base: 500, curr: 500 },
    products: { base: null, curr: 200 }, // New model
    old_model: { base: 300, curr: null }, // Removed model
  };

  return {
    type: "row_count_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: { node_names: ["orders", "customers", "products", "old_model"] },
    result,
  };
}

/**
 * Creates a row_count run fixture (single environment)
 */
export function createRowCountRun(): Extract<Run, { type: "row_count" }> {
  const result: RowCountResult = {
    orders: { curr: 1000 },
    customers: { curr: 500 },
    products: { curr: 200 },
  };

  return {
    type: "row_count",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: { node_names: ["orders", "customers", "products"] },
    result,
  };
}

/**
 * Creates an empty row_count_diff run (no results)
 */
export function createEmptyRowCountDiffRun(): Extract<
  Run,
  { type: "row_count_diff" }
> {
  return {
    type: "row_count_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: { node_names: [] },
    result: {},
  };
}

// ============================================================================
// Value Diff Fixtures
// ============================================================================

/**
 * Creates a value_diff run fixture with column match summary
 */
export function createValueDiffRun(): Extract<Run, { type: "value_diff" }> {
  const result: ValueDiffResult = {
    summary: {
      total: 1000,
      added: 50,
      removed: 30,
    },
    data: {
      columns: [
        { key: "column", name: "Column", type: "text" },
        { key: "match", name: "Match", type: "integer" },
        { key: "match_pct", name: "Match %", type: "number" },
      ],
      data: [
        ["id", 920, 100.0],
        ["name", 850, 92.4],
        ["amount", 780, 84.8],
        ["created_at", 900, 97.8],
      ],
    },
  };

  return {
    type: "value_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      model: "orders",
      primary_key: "id",
      columns: ["id", "name", "amount", "created_at"],
    },
    result,
  };
}

// ============================================================================
// Histogram Diff Fixtures
// ============================================================================

/**
 * Creates a histogram_diff run fixture with binned data
 */
export function createHistogramDiffRun(): Extract<
  Run,
  { type: "histogram_diff" }
> {
  const result: HistogramDiffResult = {
    base: {
      counts: [10, 25, 45, 80, 120, 95, 60, 35, 20, 10],
      total: 500,
    },
    current: {
      counts: [15, 30, 50, 85, 115, 90, 55, 30, 18, 12],
      total: 500,
    },
    min: 0,
    max: 1000,
    bin_edges: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  };

  return {
    type: "histogram_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      model: "orders",
      column_name: "amount",
      column_type: "number",
    },
    result,
  };
}

// ============================================================================
// Top-K Diff Fixtures
// ============================================================================

/**
 * Creates a top_k_diff run fixture with value frequency data
 */
export function createTopKDiffRun(): Extract<Run, { type: "top_k_diff" }> {
  const result: TopKDiffResult = {
    base: {
      values: ["pending", "shipped", "delivered", "cancelled", "returned"],
      counts: [100, 250, 400, 80, 50],
      valids: 880,
    },
    current: {
      values: ["pending", "shipped", "delivered", "cancelled", "returned"],
      counts: [120, 230, 420, 75, 55],
      valids: 900,
    },
  };

  return {
    type: "top_k_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      model: "orders",
      column_name: "status",
      k: 10,
    },
    result,
  };
}

// ============================================================================
// Profile Diff Fixtures
// ============================================================================

/**
 * Creates a profile_diff run fixture with column statistics
 */
export function createProfileDiffRun(): Extract<Run, { type: "profile_diff" }> {
  const result: ProfileDiffResult = {
    base: {
      columns: [
        { key: "column", name: "Column", type: "text" },
        { key: "type", name: "Type", type: "text" },
        { key: "count", name: "Count", type: "integer" },
        { key: "distinct", name: "Distinct", type: "integer" },
        { key: "nulls", name: "Nulls", type: "integer" },
        { key: "min", name: "Min", type: "number" },
        { key: "max", name: "Max", type: "number" },
      ],
      data: [
        ["id", "integer", 1000, 1000, 0, 1, 1000],
        ["name", "text", 1000, 850, 5, null, null],
        ["amount", "number", 1000, 500, 10, 0.01, 9999.99],
      ],
    },
    current: {
      columns: [
        { key: "column", name: "Column", type: "text" },
        { key: "type", name: "Type", type: "text" },
        { key: "count", name: "Count", type: "integer" },
        { key: "distinct", name: "Distinct", type: "integer" },
        { key: "nulls", name: "Nulls", type: "integer" },
        { key: "min", name: "Min", type: "number" },
        { key: "max", name: "Max", type: "number" },
      ],
      data: [
        ["id", "integer", 1050, 1050, 0, 1, 1050],
        ["name", "text", 1050, 900, 3, null, null],
        ["amount", "number", 1050, 520, 8, 0.01, 10500.0],
      ],
    },
  };

  return {
    type: "profile_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      model: "orders",
      columns: ["id", "name", "amount"],
    },
    result,
  };
}

/**
 * Creates a profile run fixture (single environment)
 */
export function createProfileRun(): Extract<Run, { type: "profile" }> {
  const result: ProfileDiffResult = {
    current: {
      columns: [
        { key: "column", name: "Column", type: "text" },
        { key: "type", name: "Type", type: "text" },
        { key: "count", name: "Count", type: "integer" },
        { key: "distinct", name: "Distinct", type: "integer" },
        { key: "nulls", name: "Nulls", type: "integer" },
      ],
      data: [
        ["id", "integer", 1000, 1000, 0],
        ["name", "text", 1000, 850, 5],
        ["amount", "number", 1000, 500, 10],
      ],
    },
  };

  return {
    type: "profile",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      model: "orders",
      columns: ["id", "name", "amount"],
    },
    result,
  };
}

// ============================================================================
// Query Diff Fixtures
// ============================================================================

/**
 * Creates a query_diff run fixture with base/current results
 */
export function createQueryDiffRun(): Extract<Run, { type: "query_diff" }> {
  const result: QueryDiffResult = {
    base: {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "name", name: "name", type: "text" },
        { key: "total", name: "total", type: "number" },
      ],
      data: [
        [1, "Alice", 100.0],
        [2, "Bob", 200.0],
        [3, "Charlie", 300.0],
      ],
    },
    current: {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "name", name: "name", type: "text" },
        { key: "total", name: "total", type: "number" },
      ],
      data: [
        [1, "Alice", 105.0],
        [2, "Bob", 200.0],
        [4, "Diana", 400.0],
      ],
    },
  };

  return {
    type: "query_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      sql_template: "SELECT * FROM orders LIMIT 100",
      primary_keys: ["id"],
    },
    result,
  };
}

/**
 * Creates a query run fixture (single environment)
 */
export function createQueryRun(): Extract<Run, { type: "query" }> {
  const result: QueryResult = {
    columns: [
      { key: "id", name: "id", type: "integer" },
      { key: "name", name: "name", type: "text" },
      { key: "total", name: "total", type: "number" },
    ],
    data: [
      [1, "Alice", 100.0],
      [2, "Bob", 200.0],
      [3, "Charlie", 300.0],
    ],
  };

  return {
    type: "query",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Finished",
    params: {
      sql_template: "SELECT * FROM orders LIMIT 100",
    },
    result,
  };
}

// ============================================================================
// Error Case Fixtures
// ============================================================================

/**
 * Creates a run fixture with error status
 */
export function createRunWithError(): Extract<Run, { type: "row_count_diff" }> {
  return {
    type: "row_count_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Failed",
    error: "Database connection timeout after 30 seconds",
    params: { node_names: ["orders"] },
    result: undefined,
  };
}

/**
 * Creates a run fixture in running status (for loading states)
 */
export function createRunningRun(): Extract<Run, { type: "row_count_diff" }> {
  return {
    type: "row_count_diff",
    run_id: generateRunId(),
    run_at: getCurrentTimestamp(),
    status: "Running",
    progress: {
      message: "Querying database...",
      percentage: 50,
    },
    params: { node_names: ["orders"] },
    result: undefined,
  };
}

// ============================================================================
// Type-Specific Run Creators (for parameterized tests)
// ============================================================================

/**
 * Map of run type to fixture creator function
 * Useful for parameterized tests that need to test all run types
 */
export const runFixtureCreators = {
  row_count_diff: createRowCountDiffRun,
  row_count: createRowCountRun,
  value_diff: createValueDiffRun,
  histogram_diff: createHistogramDiffRun,
  top_k_diff: createTopKDiffRun,
  profile_diff: createProfileDiffRun,
  profile: createProfileRun,
  query_diff: createQueryDiffRun,
  query: createQueryRun,
} as const;

/**
 * Run types that have ResultView components
 */
export const runTypesWithResultView = [
  "row_count_diff",
  "row_count",
  "value_diff",
  "histogram_diff",
  "top_k_diff",
  "profile_diff",
  "profile",
  "query_diff",
  "query",
] as const;
