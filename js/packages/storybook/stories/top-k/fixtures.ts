import type {
  TopKDiffParams,
  TopKDiffResult,
  TopKViewOptions,
} from "@datarecce/ui/api";
import type {
  TopKDiffResultViewProps,
  TopKDiffRun,
} from "@datarecce/ui/components";

// Fixed date for deterministic test data
const FIXED_RUN_DATE = "2024-01-15T10:30:00.000Z";

// Counter for deterministic ID generation
let topKDiffRunCounter = 0;

/**
 * Reset counters (useful for test isolation)
 */
export const resetTopKFixtureCounters = () => {
  topKDiffRunCounter = 0;
};

/**
 * Create top-k diff params
 */
export const createTopKDiffParams = (
  overrides: Partial<TopKDiffParams> = {},
): TopKDiffParams => ({
  model: "users",
  column_name: "status",
  k: 10,
  ...overrides,
});

/**
 * Create top-k diff result
 */
export const createTopKDiffResult = (
  overrides: Partial<TopKDiffResult> = {},
): TopKDiffResult => ({
  base: {
    values: ["active", "pending", "completed", "cancelled", "failed"],
    counts: [1000, 700, 500, 300, 100],
    valids: 2600,
  },
  current: {
    values: ["active", "pending", "completed", "cancelled", "failed"],
    counts: [1100, 750, 550, 320, 120],
    valids: 2840,
  },
  ...overrides,
});

/**
 * Create top-k diff run
 */
export const createTopKDiffRun = (
  overrides: Partial<TopKDiffRun> = {},
): TopKDiffRun => ({
  run_id: `run-topk-${String(++topKDiffRunCounter).padStart(3, "0")}`,
  type: "top_k_diff",
  run_at: FIXED_RUN_DATE,
  params: createTopKDiffParams(),
  result: createTopKDiffResult(),
  ...overrides,
});

/**
 * Top-K result with many values (>10)
 */
export const topKResultManyValues: TopKDiffResult = {
  base: {
    values: [
      "status_1",
      "status_2",
      "status_3",
      "status_4",
      "status_5",
      "status_6",
      "status_7",
      "status_8",
      "status_9",
      "status_10",
      "status_11",
      "status_12",
      "status_13",
      "status_14",
      "status_15",
    ],
    counts: [
      1000, 800, 600, 400, 300, 250, 200, 150, 100, 80, 60, 40, 30, 20, 10,
    ],
    valids: 4040,
  },
  current: {
    values: [
      "status_1",
      "status_2",
      "status_3",
      "status_4",
      "status_5",
      "status_6",
      "status_7",
      "status_8",
      "status_9",
      "status_10",
      "status_11",
      "status_12",
      "status_13",
      "status_14",
      "status_15",
    ],
    counts: [
      1100, 850, 620, 420, 320, 260, 210, 160, 110, 85, 65, 45, 35, 25, 15,
    ],
    valids: 4320,
  },
};
