// packages/storybook/stories/query/fixtures.ts

import type {
  DataFrame,
  QueryDiffParams,
  QueryRunParams,
  Run,
} from "@datarecce/ui/api";
import type { QueryResultViewProps } from "@datarecce/ui/components";

// Fixed date for deterministic test data
const FIXED_RUN_DATE = "2024-01-15T10:30:00.000Z";

// ============================================
// DataFrame Factories
// ============================================

/**
 * Create a simple DataFrame with sensible defaults
 */
export const createDataFrame = (
  overrides: Partial<DataFrame> = {},
): DataFrame => ({
  columns: [
    { key: "id", name: "id", type: "integer" },
    { key: "customer_name", name: "customer_name", type: "text" },
    { key: "order_total", name: "order_total", type: "number" },
    { key: "status", name: "status", type: "text" },
    { key: "created_at", name: "created_at", type: "datetime" },
  ],
  data: [
    [1, "Alice Johnson", 150.0, "completed", "2024-01-10T08:30:00Z"],
    [2, "Bob Smith", 89.99, "pending", "2024-01-11T14:22:00Z"],
    [3, "Carol White", 250.5, "completed", "2024-01-12T09:15:00Z"],
    [4, "David Brown", 45.0, "cancelled", "2024-01-13T11:45:00Z"],
    [5, "Eve Davis", 320.75, "completed", "2024-01-14T16:00:00Z"],
  ],
  ...overrides,
});

/**
 * DataFrame with limit/more for truncation warning testing
 */
export const createTruncatedDataFrame = (
  overrides: Partial<DataFrame> = {},
): DataFrame =>
  createDataFrame({
    limit: 500,
    more: true,
    ...overrides,
  });

/**
 * Large DataFrame with many rows for scroll testing
 */
export const largeDataFrame: DataFrame = {
  columns: [
    { key: "id", name: "id", type: "integer" },
    { key: "name", name: "name", type: "text" },
    { key: "value", name: "value", type: "number" },
    { key: "category", name: "category", type: "text" },
  ],
  data: Array.from({ length: 100 }, (_, i) => [
    i + 1,
    `Row ${i + 1}`,
    ((i + 1) * 17389) % 10000, // Deterministic pseudo-random
    ["A", "B", "C", "D"][(i * 7) % 4],
  ]),
};

/**
 * Wide DataFrame with many columns for horizontal scroll testing
 */
export const wideDataFrame: DataFrame = {
  columns: [
    { key: "id", name: "id", type: "integer" },
    ...Array.from({ length: 20 }, (_, i) => ({
      key: `col_${i + 1}`,
      name: `column_${i + 1}`,
      type: "text" as const,
    })),
  ],
  data: Array.from({ length: 10 }, (_, row) => [
    row + 1,
    ...Array.from({ length: 20 }, (_, col) => `r${row + 1}_c${col + 1}`),
  ]),
};

// ============================================
// Diff DataFrame Factories
// ============================================

/**
 * Create a diff DataFrame (JOIN mode) with in_a/in_b columns
 * in_a=true means row exists in base, in_b=true means row exists in current
 * Both true = unchanged or modified, only in_a = removed, only in_b = added
 */
export const createDiffDataFrame = (
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
    [2, "Bob Smith", 89.99, "pending", true, true], // base values (modified pair)
    [2, "Bob Smith", 99.99, "completed", true, true], // current values (modified pair)
    [3, "Carol White", 250.5, "completed", true, true], // unchanged
    [4, "David Brown", 45.0, "cancelled", true, false], // removed
    [6, "Frank Green", 180.0, "pending", false, true], // added
  ],
  ...overrides,
});

// ============================================
// Query Run Factories
// ============================================

/**
 * Create query run params
 */
export const createQueryParams = (
  overrides: Partial<QueryRunParams> = {},
): QueryRunParams => ({
  sql_template: "SELECT * FROM {{ ref('orders') }} LIMIT 100",
  ...overrides,
});

/**
 * Create a query run
 */
export const createQueryRun = (
  overrides: Partial<QueryResultViewProps["run"]> = {},
) => ({
  run_id: "run-query-default",
  type: "query" as const,
  run_at: FIXED_RUN_DATE,
  params: createQueryParams(),
  result: createDataFrame(),
  ...overrides,
});

/**
 * Create a query_base run (single environment)
 */
export const createQueryBaseRun = (
  overrides: Partial<QueryResultViewProps["run"]> = {},
) => ({
  run_id: "run-querybase-default",
  type: "query_base" as const,
  run_at: FIXED_RUN_DATE,
  params: createQueryParams(),
  result: createDataFrame(),
  ...overrides,
});

// ============================================
// Query Diff Run Factories
// ============================================

type QueryDiffRun = Extract<Run, { type: "query_diff" }>;

/**
 * Create query diff params
 */
export const createQueryDiffParams = (
  overrides: Partial<QueryDiffParams> = {},
): QueryDiffParams => ({
  sql_template: "SELECT * FROM {{ ref('orders') }}",
  primary_keys: ["id"],
  ...overrides,
});

/**
 * Create a query diff run (JOIN mode — server-side diff)
 */
export const createQueryDiffRunJoin = (
  overrides: Partial<QueryDiffRun> = {},
) => ({
  run_id: "run-querydiff-join-default",
  type: "query_diff" as const,
  run_at: FIXED_RUN_DATE,
  params: createQueryDiffParams(),
  result: {
    diff: createDiffDataFrame(),
  },
  ...overrides,
});

/**
 * Create a query diff run (non-JOIN mode — client-side diff)
 */
export const createQueryDiffRunNonJoin = (
  overrides: Partial<QueryDiffRun> = {},
) => ({
  run_id: "run-querydiff-nonjoin-default",
  type: "query_diff" as const,
  run_at: FIXED_RUN_DATE,
  params: createQueryDiffParams({ primary_keys: undefined }),
  result: {
    base: createDataFrame(),
    current: createDataFrame({
      data: [
        [1, "Alice Johnson", 155.0, "completed", "2024-01-10T08:30:00Z"],
        [2, "Bob Smith", 89.99, "shipped", "2024-01-11T14:22:00Z"],
        [3, "Carol White", 250.5, "completed", "2024-01-12T09:15:00Z"],
        [5, "Eve Davis", 320.75, "completed", "2024-01-14T16:00:00Z"],
        [6, "Frank Green", 180.0, "pending", "2024-01-15T10:30:00Z"],
      ],
    }),
  },
  ...overrides,
});

/**
 * Query diff run with no changes (JOIN mode)
 */
export const queryDiffNoChanges = {
  run_id: "run-querydiff-nochange",
  type: "query_diff" as const,
  run_at: FIXED_RUN_DATE,
  params: createQueryDiffParams(),
  result: {
    diff: {
      columns: [
        { key: "id", name: "id", type: "integer" as const },
        { key: "name", name: "name", type: "text" as const },
        { key: "in_a", name: "in_a", type: "boolean" as const },
        { key: "in_b", name: "in_b", type: "boolean" as const },
      ],
      data: [],
    },
  },
};
