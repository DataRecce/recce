// packages/storybook/stories/rowcount/fixtures.ts
import type { RowCountDiffRun, RowCountRun } from "@datarecce/ui/components";

// Fixed date for deterministic test data
const FIXED_RUN_DATE = "2024-01-15T10:30:00.000Z";

// Counter for deterministic ID generation
let rowCountRunCounter = 0;
let rowCountDiffRunCounter = 0;

/**
 * Reset counters (useful for test isolation)
 */
export const resetRowCountFixtureCounters = () => {
  rowCountRunCounter = 0;
  rowCountDiffRunCounter = 0;
};

/**
 * Create row count result
 */
export const createRowCountResult = (
  overrides: Record<string, { name?: string; curr: number | null }> = {},
) => ({
  "model.orders": { curr: 1000 },
  "model.customers": { curr: 500 },
  "model.products": { curr: 250 },
  ...overrides,
});

/**
 * Create row count diff result
 */
export const createRowCountDiffResult = (
  overrides: Record<
    string,
    { name?: string; base: number | null; curr: number | null }
  > = {},
) => ({
  "model.orders": { base: 1000, curr: 1050 },
  "model.customers": { base: 500, curr: 500 },
  "model.products": { base: 250, curr: 240 },
  ...overrides,
});

/**
 * Create row count run
 */
export const createRowCountRun = (
  overrides: Partial<RowCountRun> = {},
): RowCountRun => ({
  run_id: `run-rowcount-${String(++rowCountRunCounter).padStart(3, "0")}`,
  type: "row_count",
  run_at: FIXED_RUN_DATE,
  result: createRowCountResult(),
  ...overrides,
});

/**
 * Create row count diff run
 */
export const createRowCountDiffRun = (
  overrides: Partial<RowCountDiffRun> = {},
): RowCountDiffRun => ({
  run_id: `run-rowcount-diff-${String(++rowCountDiffRunCounter).padStart(3, "0")}`,
  type: "row_count_diff",
  run_at: FIXED_RUN_DATE,
  result: createRowCountDiffResult(),
  ...overrides,
});

/**
 * Large row count result with many models
 * Uses seeded values for deterministic output
 */
export const largeRowCountResult = Object.fromEntries(
  Array.from({ length: 50 }, (_, i) => [
    `model.table_${i}`,
    { curr: ((i + 1) * 17389) % 1000000 }, // Deterministic pseudo-random values
  ]),
);

/**
 * Row count diff with significant changes
 */
export const rowCountDiffWithChanges = {
  "model.orders": { base: 1000, curr: 1500 }, // 50% increase
  "model.customers": { base: 500, curr: 500 }, // No change
  "model.products": { base: 250, curr: 200 }, // 20% decrease
  "model.removed": { base: 100, curr: null }, // This model was removed
  "model.new": { base: null, curr: 300 }, // New model added
};
