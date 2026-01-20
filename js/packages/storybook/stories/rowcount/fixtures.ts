// packages/storybook/stories/rowcount/fixtures.ts
import type {
  RowCountDiffRun,
  RowCountRun,
} from "@datarecce/ui/components/rowcount/RowCountResultView";

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
  run_id: `run-${Math.random().toString(36).slice(2, 9)}`,
  type: "row_count",
  run_at: new Date().toISOString(),
  result: createRowCountResult(),
  ...overrides,
});

/**
 * Create row count diff run
 */
export const createRowCountDiffRun = (
  overrides: Partial<RowCountDiffRun> = {},
): RowCountDiffRun => ({
  run_id: `run-${Math.random().toString(36).slice(2, 9)}`,
  type: "row_count_diff",
  run_at: new Date().toISOString(),
  result: createRowCountDiffResult(),
  ...overrides,
});

/**
 * Large row count result with many models
 */
export const largeRowCountResult = Object.fromEntries(
  Array.from({ length: 50 }, (_, i) => [
    `model.table_${i}`,
    { curr: Math.floor(Math.random() * 1000000) },
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
