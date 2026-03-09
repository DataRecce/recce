// packages/storybook/stories/valuediff/fixtures.ts

import type {
  DataFrame,
  ValueDiffDetailParams,
  ValueDiffParams,
  ValueDiffResult,
} from "@datarecce/ui/api";
import type {
  ValueDiffDetailRun,
  ValueDiffRun,
} from "@datarecce/ui/components";

// Fixed date for deterministic test data
const FIXED_RUN_DATE = "2024-01-15T10:30:00.000Z";

// ============================================
// Shared column definitions
// ============================================

const VALUE_DIFF_COLUMNS: DataFrame["columns"] = [
  { key: "column_name", name: "column_name", type: "text" },
  { key: "match", name: "match", type: "integer" },
  { key: "match_percentage", name: "match_percentage", type: "number" },
];

// ============================================
// ValueDiff (Summary) Factories
// ============================================

/**
 * Create value diff params
 */
export const createValueDiffParams = (
  overrides: Partial<ValueDiffParams> = {},
): ValueDiffParams => ({
  model: "orders",
  primary_key: "id",
  ...overrides,
});

/**
 * Create value diff result (column-level summary)
 */
export const createValueDiffResult = (
  overrides: Partial<ValueDiffResult> = {},
): ValueDiffResult => ({
  summary: {
    total: 1000,
    added: 50,
    removed: 30,
  },
  data: {
    columns: VALUE_DIFF_COLUMNS,
    data: [
      ["customer_name", 910, 98.91],
      ["order_total", 880, 95.65],
      ["status", 920, 100.0],
      ["created_at", 900, 97.83],
      ["email", 850, 92.39],
    ],
  },
  ...overrides,
});

/**
 * Create a value diff run
 */
export const createValueDiffRun = (
  overrides: Partial<ValueDiffRun> = {},
): ValueDiffRun => ({
  run_id: "run-valuediff-default",
  type: "value_diff",
  run_at: FIXED_RUN_DATE,
  params: createValueDiffParams(),
  result: createValueDiffResult(),
  ...overrides,
});

/**
 * Value diff with all columns matching 100%
 */
export const valueDiffAllMatch: ValueDiffResult = {
  summary: { total: 500, added: 0, removed: 0 },
  data: {
    columns: VALUE_DIFF_COLUMNS,
    data: [
      ["id", 500, 100.0],
      ["name", 500, 100.0],
      ["email", 500, 100.0],
    ],
  },
};

/**
 * Value diff with many columns (20+)
 */
export const valueDiffManyColumns: ValueDiffResult = {
  summary: { total: 2000, added: 100, removed: 50 },
  data: {
    columns: VALUE_DIFF_COLUMNS,
    data: Array.from({ length: 20 }, (_, i) => [
      `column_${i + 1}`,
      1850 - i * 25, // Deterministic decreasing match counts
      Number((100 - i * 1.35).toFixed(2)),
    ]),
  },
};

// ============================================
// ValueDiffDetail (Row-Level) Factories
// ============================================

/**
 * Create a value diff detail DataFrame result
 * Uses in_a/in_b boolean columns for diff indication:
 * - in_a=true, in_b=true: row exists in both (unchanged or modified)
 * - in_a=true, in_b=false: row removed from current
 * - in_a=false, in_b=true: row added in current
 */
export const createValueDiffDetailResult = (
  overrides: Partial<DataFrame> = {},
): DataFrame => ({
  columns: [
    { key: "id", name: "id", type: "integer" },
    { key: "customer_name", name: "customer_name", type: "text" },
    { key: "order_total", name: "order_total", type: "number" },
    { key: "status", name: "status", type: "text" },
    { key: "in_a", name: "in_a", type: "boolean" },
    { key: "in_b", name: "in_b", type: "boolean" },
  ],
  data: [
    [1, "Alice Johnson", 150.0, "completed", true, true], // unchanged
    [2, "Bob Smith", 89.99, "pending", true, true], // base (modified pair)
    [2, "Bob Smith", 99.99, "completed", true, true], // current (modified pair)
    [3, "Carol White", 250.5, "completed", true, true], // unchanged
    [4, "David Brown", 45.0, "cancelled", true, false], // removed
    [6, "Frank Green", 180.0, "pending", false, true], // added
    [7, "Grace Lee", 210.0, "shipped", true, true], // unchanged
    [8, "Henry Park", 95.5, "completed", true, true], // unchanged
  ],
  ...overrides,
});

/**
 * Create value diff detail params
 */
export const createValueDiffDetailParams = (
  overrides: Partial<ValueDiffDetailParams> = {},
): ValueDiffDetailParams => ({
  model: "orders",
  primary_key: "id",
  ...overrides,
});

/**
 * Create a value diff detail run
 */
export const createValueDiffDetailRun = (
  overrides: Partial<ValueDiffDetailRun> = {},
): ValueDiffDetailRun => ({
  run_id: "run-valuediff-detail-default",
  type: "value_diff_detail",
  run_at: FIXED_RUN_DATE,
  params: createValueDiffDetailParams(),
  result: createValueDiffDetailResult(),
  ...overrides,
});

/**
 * Value diff detail with no changes (all rows match)
 */
export const valueDiffDetailNoChanges: DataFrame = {
  columns: [
    { key: "id", name: "id", type: "integer" },
    { key: "name", name: "name", type: "text" },
    { key: "value", name: "value", type: "number" },
    { key: "in_a", name: "in_a", type: "boolean" },
    { key: "in_b", name: "in_b", type: "boolean" },
  ],
  data: [
    [1, "Alice", 100.0, true, true],
    [2, "Bob", 200.0, true, true],
    [3, "Carol", 300.0, true, true],
  ],
};

/**
 * Value diff detail with truncation
 */
export const valueDiffDetailTruncated: DataFrame = {
  ...createValueDiffDetailResult(),
  limit: 500,
  more: true,
};
