import type {
  HistogramDiffParams,
  HistogramDiffResult,
} from "@datarecce/ui/api";
import type { HistogramDiffRun } from "@datarecce/ui/components";

// Fixed date for deterministic test data
const FIXED_RUN_DATE = "2024-01-15T10:30:00.000Z";

// Counter for deterministic ID generation
let histogramDiffRunCounter = 0;

/**
 * Reset counters (useful for test isolation)
 */
export const resetHistogramFixtureCounters = () => {
  histogramDiffRunCounter = 0;
};

/**
 * Create histogram diff params
 */
export const createHistogramDiffParams = (
  overrides: Partial<HistogramDiffParams> = {},
): HistogramDiffParams => ({
  model: "orders",
  column_name: "total_amount",
  column_type: "numeric",
  ...overrides,
});

/**
 * Create histogram diff result
 */
export const createHistogramDiffResult = (
  overrides: Partial<HistogramDiffResult> = {},
): HistogramDiffResult => ({
  base: {
    counts: [10, 25, 45, 60, 50, 35, 20, 10, 5, 2],
    total: 262,
  },
  current: {
    counts: [5, 15, 60, 80, 70, 45, 25, 15, 8, 4],
    total: 327,
  },
  min: 0,
  max: 1000,
  bin_edges: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  ...overrides,
});

/**
 * Create histogram diff run
 */
export const createHistogramDiffRun = (
  overrides: Partial<HistogramDiffRun> = {},
): HistogramDiffRun => ({
  run_id: `run-histogram-${String(++histogramDiffRunCounter).padStart(3, "0")}`,
  type: "histogram_diff",
  params: createHistogramDiffParams(),
  result: createHistogramDiffResult(),
  run_at: FIXED_RUN_DATE,
  ...overrides,
});

/**
 * Sample model columns for form
 */
export const sampleModelColumns = [
  { name: "total_amount", type: "DECIMAL" },
  { name: "quantity", type: "INTEGER" },
  { name: "price", type: "FLOAT" },
  { name: "discount", type: "DECIMAL" },
  { name: "user_id", type: "VARCHAR" }, // Should be filtered out
  { name: "created_at", type: "TIMESTAMP" }, // Should be filtered out
];
