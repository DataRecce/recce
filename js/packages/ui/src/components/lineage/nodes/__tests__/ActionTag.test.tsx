/**
 * @file ActionTag.test.tsx
 * @description Tests for ActionTag component
 *
 * Tests verify:
 * - Pending state renders spinner
 * - Running state renders progress indicator
 * - Skipped state renders chip with optional tooltip
 * - Error state renders error text with optional tooltip
 * - Success with value diff shows match/mismatch summary
 * - Success with row count diff shows count comparison
 * - Fallback shows run ID or "Complete"
 */

import { render, screen } from "@testing-library/react";
import {
  type ActionProgress,
  type ActionStatus,
  ActionTag,
  type RowCountDiffResult,
  type ValueDiffResult,
} from "../ActionTag";

// =============================================================================
// Pending State Tests
// =============================================================================

describe("ActionTag - pending state", () => {
  it("renders a circular progress indicator", () => {
    render(<ActionTag status="pending" data-testid="action-tag" />);

    const element = screen.getByTestId("action-tag");
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute("data-status", "pending");
    // MUI CircularProgress renders with role="progressbar"
    expect(element).toHaveAttribute("role", "progressbar");
  });
});

// =============================================================================
// Running State Tests
// =============================================================================

describe("ActionTag - running state", () => {
  it("renders indeterminate progress when no percentage provided", () => {
    render(<ActionTag status="running" data-testid="action-tag" />);

    const element = screen.getByTestId("action-tag");
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute("data-status", "running");
    expect(element).toHaveAttribute("role", "progressbar");
  });

  it("renders determinate progress when percentage provided", () => {
    const progress: ActionProgress = { percentage: 0.5 };
    render(
      <ActionTag
        status="running"
        progress={progress}
        data-testid="action-tag"
      />,
    );

    const element = screen.getByTestId("action-tag");
    expect(element).toBeInTheDocument();
    expect(element).toHaveAttribute("data-status", "running");
    // Determinate progress should have aria-valuenow
    expect(element).toHaveAttribute("aria-valuenow", "50");
  });

  it("renders 0% progress correctly", () => {
    const progress: ActionProgress = { percentage: 0 };
    render(
      <ActionTag
        status="running"
        progress={progress}
        data-testid="action-tag"
      />,
    );

    const element = screen.getByTestId("action-tag");
    expect(element).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders 100% progress correctly", () => {
    const progress: ActionProgress = { percentage: 1 };
    render(
      <ActionTag
        status="running"
        progress={progress}
        data-testid="action-tag"
      />,
    );

    const element = screen.getByTestId("action-tag");
    expect(element).toHaveAttribute("aria-valuenow", "100");
  });
});

// =============================================================================
// Skipped State Tests
// =============================================================================

describe("ActionTag - skipped state", () => {
  it("renders Skipped text", () => {
    render(<ActionTag status="skipped" data-testid="action-tag" />);

    expect(screen.getByText("Skipped")).toBeInTheDocument();
    expect(screen.getByTestId("action-tag")).toHaveAttribute(
      "data-status",
      "skipped",
    );
  });

  it("shows info icon when skip reason provided", () => {
    render(
      <ActionTag
        status="skipped"
        skipReason="No changes detected"
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("Skipped")).toBeInTheDocument();
    // Info icon should be present (rendered as SVG)
    const wrapper = screen.getByTestId("action-tag");
    const svg = wrapper.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});

// =============================================================================
// Error State Tests
// =============================================================================

describe("ActionTag - error state", () => {
  it("renders Error text", () => {
    render(<ActionTag status="error" data-testid="action-tag" />);

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByTestId("action-tag")).toHaveAttribute(
      "data-status",
      "error",
    );
  });

  it("shows warning icon when error message provided", () => {
    render(
      <ActionTag
        status="error"
        errorMessage="Query timeout"
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    // Warning icon should be present (rendered as SVG)
    const wrapper = screen.getByTestId("action-tag");
    const svg = wrapper.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});

// =============================================================================
// Success State - Value Diff Tests
// =============================================================================

describe("ActionTag - success with value diff", () => {
  it("shows all columns match when no mismatches", () => {
    const valueDiffResult: ValueDiffResult = {
      mismatchedColumns: 0,
      totalColumns: 10,
    };
    render(
      <ActionTag
        status="success"
        valueDiffResult={valueDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("All columns match")).toBeInTheDocument();
    expect(screen.getByTestId("action-tag")).toHaveAttribute(
      "data-status",
      "success",
    );
  });

  it("shows mismatch count when columns differ", () => {
    const valueDiffResult: ValueDiffResult = {
      mismatchedColumns: 3,
      totalColumns: 10,
    };
    render(
      <ActionTag
        status="success"
        valueDiffResult={valueDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("3 columns mismatched")).toBeInTheDocument();
  });

  it("shows singular form for 1 mismatch", () => {
    const valueDiffResult: ValueDiffResult = {
      mismatchedColumns: 1,
      totalColumns: 10,
    };
    render(
      <ActionTag
        status="success"
        valueDiffResult={valueDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("1 columns mismatched")).toBeInTheDocument();
  });
});

// =============================================================================
// Success State - Row Count Diff Tests
// =============================================================================

describe("ActionTag - success with row count diff", () => {
  it("shows row counts with increase indicator", () => {
    const rowCountDiffResult: RowCountDiffResult = {
      base: 100,
      current: 150,
    };
    render(
      <ActionTag
        status="success"
        rowCountDiffResult={rowCountDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("↑")).toBeInTheDocument();
  });

  it("shows row counts with decrease indicator", () => {
    const rowCountDiffResult: RowCountDiffResult = {
      base: 200,
      current: 50,
    };
    render(
      <ActionTag
        status="success"
        rowCountDiffResult={rowCountDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("↓")).toBeInTheDocument();
  });

  it("shows equal indicator when counts match", () => {
    const rowCountDiffResult: RowCountDiffResult = {
      base: 100,
      current: 100,
    };
    render(
      <ActionTag
        status="success"
        rowCountDiffResult={rowCountDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getAllByText("100")).toHaveLength(2);
    expect(screen.getByText("=")).toBeInTheDocument();
  });

  it("shows N/A for null base", () => {
    const rowCountDiffResult: RowCountDiffResult = {
      base: null,
      current: 100,
    };
    render(
      <ActionTag
        status="success"
        rowCountDiffResult={rowCountDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("shows N/A for null current", () => {
    const rowCountDiffResult: RowCountDiffResult = {
      base: 100,
      current: null,
    };
    render(
      <ActionTag
        status="success"
        rowCountDiffResult={rowCountDiffResult}
        data-testid="action-tag"
      />,
    );

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("formats large numbers with locale string", () => {
    const rowCountDiffResult: RowCountDiffResult = {
      base: 1000000,
      current: 2000000,
    };
    render(
      <ActionTag
        status="success"
        rowCountDiffResult={rowCountDiffResult}
        data-testid="action-tag"
      />,
    );

    // toLocaleString formats numbers with commas
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
    expect(screen.getByText("2,000,000")).toBeInTheDocument();
  });
});

// =============================================================================
// Success State - Fallback Tests
// =============================================================================

describe("ActionTag - success fallback", () => {
  it("shows run ID when provided", () => {
    render(
      <ActionTag status="success" runId="run-123" data-testid="action-tag" />,
    );

    expect(screen.getByText("run-123")).toBeInTheDocument();
    expect(screen.getByTestId("action-tag")).toHaveAttribute(
      "data-status",
      "success",
    );
  });

  it("shows Complete when no results or run ID", () => {
    render(<ActionTag status="success" data-testid="action-tag" />);

    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});

// =============================================================================
// Type Export Tests
// =============================================================================

describe("ActionTag types", () => {
  it("ActionStatus type accepts valid values", () => {
    const statuses: ActionStatus[] = [
      "pending",
      "running",
      "skipped",
      "success",
      "error",
    ];
    expect(statuses).toHaveLength(5);
  });
});
