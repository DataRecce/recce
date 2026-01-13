/**
 * @file ValueDiffResultView.test.tsx
 * @description Baseline tests for ValueDiffResultView component
 *
 * Tests verify:
 * - Correct rendering with valid run data
 * - Summary header displays correct model name and row counts
 * - Returns null when toValueDataGrid returns null
 * - Type guard throws for wrong run types
 * - Ref forwarding to underlying grid
 */

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock AG Grid to avoid ES module parsing errors
jest.mock("ag-grid-community", () => ({
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
  ClientSideRowModelModule: {},
  AllCommunityModule: {},
  themeQuartz: {},
}));

// Mock toValueDataGrid from @datarecce/ui
const mockToValueDataGrid = jest.fn();
jest.mock("@datarecce/ui/components/ui/dataGrid", () => ({
  toValueDataGrid: (...args: unknown[]) => mockToValueDataGrid(...args),
}));

// Mock ScreenshotDataGrid with our test utility mock
jest.mock("@datarecce/ui/primitives", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: () => <div data-testid="empty-rows-renderer">No data</div>,
}));

// Mock @datarecce/ui components used by factory pattern
jest.mock("@datarecce/ui/components/data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: () => <div data-testid="empty-rows-renderer">No data</div>,
}));

jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => false,
}));

// ============================================================================
// Imports
// ============================================================================

import { ValueDiffResultView } from "@datarecce/ui/components/valuediff";
import { screen } from "@testing-library/react";
import React from "react";
import {
  createRowCountDiffRun,
  createValueDiffRun,
} from "@/testing-utils/fixtures/runFixtures";
import {
  createGridRef,
  expectThrowsForWrongType,
  renderWithProviders,
} from "@/testing-utils/resultViewTestUtils";

// ============================================================================
// Test Setup
// ============================================================================

describe("ValueDiffResultView", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation returns grid data
    mockToValueDataGrid.mockReturnValue({
      columns: [
        { field: "column", headerName: "Column" },
        { field: "match", headerName: "Match" },
        { field: "match_pct", headerName: "Match %" },
      ],
      rows: [
        { column: "id", match: 920, match_pct: 100.0 },
        { column: "name", match: 850, match_pct: 92.4 },
        { column: "amount", match: 780, match_pct: 84.8 },
        { column: "created_at", match: 900, match_pct: 97.8 },
      ],
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid value_diff run provided", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data (4 rows in mock)
      expect(grid).toHaveAttribute("data-rows", "4");
      // Verify columns: column, match, match_pct
      expect(grid).toHaveAttribute("data-columns", "3");
    });

    it("calls toValueDataGrid with the result and params", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      expect(mockToValueDataGrid).toHaveBeenCalledWith(run.result, {
        params: run.params,
      });
    });
  });

  // ==========================================================================
  // Summary Header Tests
  // ==========================================================================

  describe("summary header", () => {
    it("displays model name from params", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // The fixture has params.model = "orders"
      expect(screen.getByText(/Model: orders/)).toBeInTheDocument();
    });

    it("displays correct total count from summary", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // The fixture has result.summary.total = 1000
      expect(screen.getByText(/1000 total/)).toBeInTheDocument();
    });

    it("displays calculated common count (total - added - removed)", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // total=1000, added=50, removed=30, so common = 1000 - 50 - 30 = 920
      expect(screen.getByText(/920 common/)).toBeInTheDocument();
    });

    it("displays added count from summary", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // The fixture has result.summary.added = 50
      expect(screen.getByText(/50 added/)).toBeInTheDocument();
    });

    it("displays removed count from summary", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // The fixture has result.summary.removed = 30
      expect(screen.getByText(/30 removed/)).toBeInTheDocument();
    });

    it("displays complete summary header with all values", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      // Find the summary text container and verify full format
      const summaryText = screen.getByText((content) => {
        return (
          content.includes("Model: orders") &&
          content.includes("1000 total") &&
          content.includes("920 common") &&
          content.includes("50 added") &&
          content.includes("30 removed")
        );
      });
      expect(summaryText).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Null Return Tests
  // ==========================================================================

  describe("null return when no grid data", () => {
    it("returns null when toValueDataGrid returns null", () => {
      mockToValueDataGrid.mockReturnValue(null);
      const run = createValueDiffRun();

      const { container } = renderWithProviders(
        <ValueDiffResultView run={run} />,
      );

      // Component should return null, so container should be empty
      expect(container.firstChild).toBeNull();
    });

    it("returns null when toValueDataGrid returns undefined", () => {
      mockToValueDataGrid.mockReturnValue(undefined);
      const run = createValueDiffRun();

      const { container } = renderWithProviders(
        <ValueDiffResultView run={run} />,
      );

      // Component should return null, so container should be empty
      expect(container.firstChild).toBeNull();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("throws error when wrong run type provided", () => {
      const wrongRun = createRowCountDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<ValueDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be value_diff");

      consoleSpy.mockRestore();
    });

    it("throws error with correct message format for type guard failure", () => {
      // Use the utility function for consistency
      expectThrowsForWrongType(
        ValueDiffResultView as React.ComponentType<{ run: unknown }>,
        createRowCountDiffRun(),
        "value_diff",
      );
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid", () => {
      const run = createValueDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ValueDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected (mocked to provide methods)
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("ref is null when component returns null (no grid data)", () => {
      mockToValueDataGrid.mockReturnValue(null);
      const run = createValueDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ValueDiffResultView run={run} ref={ref as any} />,
      );

      // When returning null, no grid is rendered so ref won't be assigned
      expect(ref.current).toBeNull();
    });
  });

  // ==========================================================================
  // Data Flow Tests
  // ==========================================================================

  describe("data flow", () => {
    it("passes columns from toValueDataGrid to ScreenshotDataGrid", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 3 columns
      expect(grid).toHaveAttribute("data-columns", "3");
    });

    it("passes rows from toValueDataGrid to ScreenshotDataGrid", () => {
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 4 rows
      expect(grid).toHaveAttribute("data-rows", "4");
    });

    it("handles varying grid data sizes correctly", () => {
      // Test with different data sizes
      mockToValueDataGrid.mockReturnValue({
        columns: [{ field: "column", headerName: "Column" }],
        rows: [{ column: "test1" }, { column: "test2" }],
      });
      const run = createValueDiffRun();

      renderWithProviders(<ValueDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toHaveAttribute("data-columns", "1");
      expect(grid).toHaveAttribute("data-rows", "2");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles zero values in summary correctly", () => {
      const run = createValueDiffRun();
      // Override summary with zero values (mutate in place to preserve data field)
      if (run.result) {
        run.result.summary = {
          total: 100,
          added: 0,
          removed: 0,
        };
      }

      renderWithProviders(<ValueDiffResultView run={run} />);

      // common should be 100 - 0 - 0 = 100
      expect(screen.getByText(/100 common/)).toBeInTheDocument();
      expect(screen.getByText(/0 added/)).toBeInTheDocument();
      expect(screen.getByText(/0 removed/)).toBeInTheDocument();
    });

    it("handles all rows being added or removed", () => {
      const run = createValueDiffRun();
      // Override summary where all rows are new (mutate in place to preserve data field)
      if (run.result) {
        run.result.summary = {
          total: 50,
          added: 50,
          removed: 0,
        };
      }

      renderWithProviders(<ValueDiffResultView run={run} />);

      // common should be 50 - 50 - 0 = 0
      expect(screen.getByText(/0 common/)).toBeInTheDocument();
      expect(screen.getByText(/50 added/)).toBeInTheDocument();
    });
  });
});
