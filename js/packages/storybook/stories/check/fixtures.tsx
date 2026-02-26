// packages/storybook/stories/check/fixtures.ts
import type {
  CheckAction,
  CheckCardData,
  CheckDetailTab,
  CheckType,
} from "@datarecce/ui/components";

// ============================================
// CheckCard Data Factories
// ============================================

let checkCounter = 0;

/**
 * Reset counters (useful for test isolation)
 */
export const resetCheckFixtureCounters = () => {
  checkCounter = 0;
};

/**
 * Create a single check card data item
 */
export const createCheckCardData = (
  overrides: Partial<CheckCardData> = {},
): CheckCardData => ({
  id: `check-${String(++checkCounter).padStart(3, "0")}`,
  name: "Validate order totals",
  type: "query_diff",
  ...overrides,
});

/**
 * Sample checks covering different types and states
 */
export const sampleChecks: CheckCardData[] = [
  {
    id: "check-001",
    name: "Row count validation",
    type: "row_count_diff",
    isApproved: true,
    runStatus: "success",
  },
  {
    id: "check-002",
    name: "Schema change review",
    type: "schema_diff",
    runStatus: "success",
  },
  {
    id: "check-003",
    name: "Customer profile diff",
    type: "profile_diff",
    isApproved: true,
    runStatus: "success",
  },
  {
    id: "check-004",
    name: "Order total query",
    type: "query_diff",
    runStatus: "error",
  },
  {
    id: "check-005",
    name: "Revenue histogram",
    type: "histogram_diff",
    runStatus: "running",
  },
  {
    id: "check-006",
    name: "Status top-k analysis",
    type: "top_k_diff",
    runStatus: "pending",
    isPreset: true,
  },
];

/**
 * Large check list for scroll testing
 */
export const manyChecks: CheckCardData[] = Array.from(
  { length: 30 },
  (_, i) => {
    const types: CheckType[] = [
      "query_diff",
      "row_count_diff",
      "schema_diff",
      "profile_diff",
      "value_diff",
      "histogram_diff",
      "top_k_diff",
    ];
    const statuses = ["success", "error", "running", "pending"] as const;
    return {
      id: `check-${String(i + 1).padStart(3, "0")}`,
      name: `Check ${i + 1}: ${types[i % types.length]} validation`,
      type: types[i % types.length],
      isApproved: i % 3 === 0,
      runStatus: statuses[i % statuses.length],
      isPreset: i % 5 === 0,
    };
  },
);

// ============================================
// CheckDetail Factories
// ============================================

/**
 * Sample primary actions for CheckDetail
 */
export const samplePrimaryActions: CheckAction[] = [
  { type: "run", label: "Run" },
  { type: "approve", label: "Approve" },
];

/**
 * Sample secondary actions for CheckDetail
 */
export const sampleSecondaryActions: CheckAction[] = [
  { type: "duplicate", label: "Duplicate" },
  { type: "copy", label: "Copy Markdown" },
  { type: "delete", label: "Delete", destructive: true },
];

/**
 * Sample tabs for CheckDetail
 */
export const createSampleTabs = (): CheckDetailTab[] => [
  {
    id: "result",
    label: "Result",
    content: (
      <div
        style={{
          padding: "20px",
          background: "var(--mui-palette-action-hover, #f5f5f5)",
          borderRadius: "8px",
          minHeight: "200px",
        }}
      >
        <p style={{ color: "var(--mui-palette-text-secondary, #666)" }}>
          Result view would render here (e.g., QueryDiffResultView,
          RowCountDiffResultView)
        </p>
      </div>
    ),
  },
  {
    id: "query",
    label: "Query",
    content: (
      <div
        style={{
          padding: "20px",
          fontFamily: "monospace",
          background: "var(--mui-palette-action-hover, #f5f5f5)",
          borderRadius: "8px",
          minHeight: "200px",
        }}
      >
        <pre>{`SELECT *\nFROM {{ ref('orders') }}\nWHERE status = 'completed'\nLIMIT 100`}</pre>
      </div>
    ),
  },
  {
    id: "lineage",
    label: "Lineage",
    content: (
      <div
        style={{
          padding: "20px",
          background: "var(--mui-palette-action-hover, #f5f5f5)",
          borderRadius: "8px",
          minHeight: "200px",
        }}
      >
        <p style={{ color: "var(--mui-palette-text-secondary, #666)" }}>
          Lineage diff view would render here
        </p>
      </div>
    ),
  },
];

/**
 * Sample sidebar content for CheckDetail
 */
export const sampleSidebarContent = (
  <div style={{ padding: "16px" }}>
    <h4 style={{ margin: "0 0 12px" }}>Timeline</h4>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[
        { time: "2 hours ago", event: "Check ran successfully" },
        { time: "3 hours ago", event: "Description updated" },
        { time: "1 day ago", event: "Check created" },
      ].map((item) => (
        <div key={item.time} style={{ fontSize: "0.875rem" }}>
          <div style={{ color: "#999" }}>{item.time}</div>
          <div>{item.event}</div>
        </div>
      ))}
    </div>
  </div>
);
