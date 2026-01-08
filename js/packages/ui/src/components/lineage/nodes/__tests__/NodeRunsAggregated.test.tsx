/**
 * @file NodeRunsAggregated.test.tsx
 * @description Tests for NodeRunsAggregated component
 *
 * Tests verify:
 * - Row count diff display with increase/decrease/no change
 * - Value diff display with match/mismatch
 * - Handling of null values
 * - Dark mode styling
 * - Empty state (no data)
 */

import { render, screen } from "@testing-library/react";
import {
  NodeRunsAggregated,
  type NodeRunsAggregatedProps,
  type RowCountDiffData,
  type ValueDiffData,
} from "../NodeRunsAggregated";

// =============================================================================
// Row Count Diff Tests
// =============================================================================

describe("NodeRunsAggregated - row count diff", () => {
  it("shows increase indicator when current > base", () => {
    const rowCountDiff: RowCountDiffData = { base: 100, curr: 150 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("150 rows")).toBeInTheDocument();
    expect(screen.getByText("+50.0%")).toBeInTheDocument();
  });

  it("shows decrease indicator when current < base", () => {
    const rowCountDiff: RowCountDiffData = { base: 200, curr: 100 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("100 rows")).toBeInTheDocument();
    expect(screen.getByText("-50.0%")).toBeInTheDocument();
  });

  it("shows no change indicator when counts are equal", () => {
    const rowCountDiff: RowCountDiffData = { base: 100, curr: 100 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("100 rows")).toBeInTheDocument();
    expect(screen.getByText("No Change")).toBeInTheDocument();
  });

  it("shows N/A for null base", () => {
    const rowCountDiff: RowCountDiffData = { base: null, curr: 100 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("100 rows")).toBeInTheDocument();
  });

  it("shows N/A for null current", () => {
    const rowCountDiff: RowCountDiffData = { base: 100, curr: null };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("100 rows")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("shows failed to load when both are null", () => {
    const rowCountDiff: RowCountDiffData = { base: null, curr: null };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("formats large numbers with locale string", () => {
    const rowCountDiff: RowCountDiffData = { base: 1000000, curr: 2000000 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("2,000,000 rows")).toBeInTheDocument();
    expect(screen.getByText("+100.0%")).toBeInTheDocument();
  });

  it("handles zero base correctly", () => {
    const rowCountDiff: RowCountDiffData = { base: 0, curr: 100 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("100 rows")).toBeInTheDocument();
    // Infinity symbol for division by zero
    expect(screen.getByText("∞")).toBeInTheDocument();
  });

  it("handles both zero correctly", () => {
    const rowCountDiff: RowCountDiffData = { base: 0, curr: 0 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("0 rows")).toBeInTheDocument();
    // When both are equal (including both zero), shows "No Change"
    expect(screen.getByText("No Change")).toBeInTheDocument();
  });
});

// =============================================================================
// Value Diff Tests
// =============================================================================

describe("NodeRunsAggregated - value diff", () => {
  it("shows all columns match when no mismatches", () => {
    const valueDiff: ValueDiffData = { mismatchedColumns: 0, totalColumns: 10 };
    render(
      <NodeRunsAggregated
        valueDiff={valueDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("All columns match")).toBeInTheDocument();
  });

  it("shows mismatch count when columns differ", () => {
    const valueDiff: ValueDiffData = { mismatchedColumns: 3, totalColumns: 10 };
    render(
      <NodeRunsAggregated
        valueDiff={valueDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("3/10 columns differ")).toBeInTheDocument();
  });

  it("shows single mismatch correctly", () => {
    const valueDiff: ValueDiffData = { mismatchedColumns: 1, totalColumns: 5 };
    render(
      <NodeRunsAggregated
        valueDiff={valueDiff}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByText("1/5 columns differ")).toBeInTheDocument();
  });
});

// =============================================================================
// Combined Display Tests
// =============================================================================

describe("NodeRunsAggregated - combined display", () => {
  it("shows both row count and value diff", () => {
    const props: NodeRunsAggregatedProps = {
      rowCountDiff: { base: 100, curr: 100 },
      valueDiff: { mismatchedColumns: 2, totalColumns: 8 },
    };
    render(<NodeRunsAggregated {...props} data-testid="runs-aggregated" />);

    expect(screen.getByText("100 rows")).toBeInTheDocument();
    expect(screen.getByText("No Change")).toBeInTheDocument();
    expect(screen.getByText("2/8 columns differ")).toBeInTheDocument();
  });
});

// =============================================================================
// Empty State Tests
// =============================================================================

describe("NodeRunsAggregated - empty state", () => {
  it("returns null when no data provided", () => {
    const { container } = render(
      <NodeRunsAggregated data-testid="runs-aggregated" />,
    );

    expect(container.firstChild).toBeNull();
  });
});

// =============================================================================
// Dark Mode Tests
// =============================================================================

describe("NodeRunsAggregated - dark mode", () => {
  it("accepts isDark prop", () => {
    const rowCountDiff: RowCountDiffData = { base: 100, curr: 100 };
    render(
      <NodeRunsAggregated
        rowCountDiff={rowCountDiff}
        isDark={true}
        data-testid="runs-aggregated"
      />,
    );

    expect(screen.getByTestId("runs-aggregated")).toBeInTheDocument();
  });
});

// =============================================================================
// Type Export Tests
// =============================================================================

describe("NodeRunsAggregated types", () => {
  it("RowCountDiffData type accepts valid values", () => {
    const data: RowCountDiffData = { base: 100, curr: 200 };
    expect(data.base).toBe(100);
    expect(data.curr).toBe(200);
  });

  it("RowCountDiffData allows null values", () => {
    const data: RowCountDiffData = { base: null, curr: null };
    expect(data.base).toBeNull();
    expect(data.curr).toBeNull();
  });

  it("ValueDiffData type accepts valid values", () => {
    const data: ValueDiffData = { mismatchedColumns: 5, totalColumns: 20 };
    expect(data.mismatchedColumns).toBe(5);
    expect(data.totalColumns).toBe(20);
  });
});
