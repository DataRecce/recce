/**
 * @file ValueDiffDetailResultView.test.tsx
 * @description Baseline tests for ValueDiffDetailResultView component
 *
 * These tests capture current component behavior before refactoring to factory pattern.
 * Tests verify:
 * - Correct rendering with valid run data
 * - Empty state: "No data" when columns empty (no toolbar)
 * - Empty state: "No change" when changedOnly && rows empty (has toolbar)
 * - Type guard throws for wrong run types
 * - Ref forwarding to underlying grid
 * - Toolbar with DiffDisplayModeSwitch and ChangedOnlyCheckbox
 * - ViewOptions: changed_only, display_mode defaults and toggling
 * - Warning message when limit > 0 && result.more
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

// Mock toValueDiffGridConfigured - use factory pattern
const mockCreateDataGrid = jest.fn();
jest.mock("@datarecce/ui/utils", () => ({
  toValueDiffGridConfigured: (...args: unknown[]) =>
    mockCreateDataGrid(...args),
}));

// Mock ScreenshotDataGrid with our test utility mock
jest.mock("@datarecce/ui/primitives", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: ({ emptyMessage }: { emptyMessage: string }) => (
    <div data-testid="empty-rows-renderer">{emptyMessage}</div>
  ),
  RunToolbar: jest.fn(
    ({
      children,
      warnings,
    }: {
      children?: React.ReactNode;
      warnings?: string[];
    }) => (
      <div data-testid="run-toolbar">
        {warnings?.map((w) => (
          <div key={w} data-testid="warning">
            {w}
          </div>
        ))}
        {children}
      </div>
    ),
  ),
}));

// Mock DiffDisplayModeSwitch and ChangedOnlyCheckbox from @datarecce/ui
jest.mock("@datarecce/ui/components/ui/DiffDisplayModeSwitch", () => ({
  DiffDisplayModeSwitch: jest.fn(
    ({
      displayMode,
      onDisplayModeChanged,
    }: {
      displayMode: string;
      onDisplayModeChanged: (mode: "inline" | "side_by_side") => void;
    }) => (
      <button
        data-testid="display-mode-switch"
        data-display-mode={displayMode}
        onClick={() => onDisplayModeChanged("side_by_side")}
      >
        {displayMode}
      </button>
    ),
  ),
}));

jest.mock("@datarecce/ui/components/ui/ChangedOnlyCheckbox", () => ({
  ChangedOnlyCheckbox: jest.fn(
    ({
      changedOnly,
      onChange,
    }: {
      changedOnly?: boolean;
      onChange: () => void;
    }) => (
      <input
        type="checkbox"
        data-testid="changed-only-checkbox"
        checked={changedOnly ?? false}
        onChange={onChange}
      />
    ),
  ),
}));

// Mock packages/ui ScreenshotDataGrid (used by createResultView factory)
jest.mock("@datarecce/ui/components/data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="empty-rows-renderer">{emptyMessage ?? "No rows"}</div>
  ),
}));

// Mock useIsDark hook from @datarecce/ui
const mockUseIsDark = jest.fn(() => false);
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import type { Run } from "@datarecce/ui/api";
import { ValueDiffDetailResultView } from "@datarecce/ui/components/valuediff/ValueDiffDetailResultView";
import { fireEvent, screen } from "@testing-library/react";
import React from "react";
import { createRowCountDiffRun } from "@/testing-utils/fixtures/runFixtures";
import {
  createGridRef,
  expectThrowsForWrongType,
  renderWithProviders,
} from "@/testing-utils/resultViewTestUtils";

// ============================================================================
// Fixtures
// ============================================================================

/**
 * Creates a value_diff_detail run fixture with sample data
 */
function createValueDiffDetailRun(): Extract<
  Run,
  { type: "value_diff_detail" }
> {
  return {
    type: "value_diff_detail",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      model: "orders",
      primary_key: "id",
    },
    result: {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "name", name: "name", type: "text" },
        { key: "amount", name: "amount", type: "number" },
      ],
      data: [
        [1, "test", 100],
        [2, "test2", 200],
      ],
      limit: 0,
      more: false,
    },
  };
}

/**
 * Creates a value_diff_detail run with limit > 0 and more=true for warning tests
 */
function createValueDiffDetailRunWithMore(): Extract<
  Run,
  { type: "value_diff_detail" }
> {
  return {
    type: "value_diff_detail",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      model: "orders",
      primary_key: "id",
    },
    result: {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "name", name: "name", type: "text" },
      ],
      data: [[1, "test"]],
      limit: 1000,
      more: true,
    },
  };
}

/**
 * Creates a value_diff_detail run with empty columns (no data state)
 */
function createValueDiffDetailRunEmpty(): Extract<
  Run,
  { type: "value_diff_detail" }
> {
  return {
    type: "value_diff_detail",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      model: "orders",
      primary_key: "id",
    },
    result: {
      columns: [],
      data: [],
      limit: 0,
      more: false,
    },
  };
}

// ============================================================================
// Test Setup
// ============================================================================

describe("ValueDiffDetailResultView", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation returns grid data
    mockCreateDataGrid.mockReturnValue({
      columns: [
        { field: "id", headerName: "id" },
        { field: "name", headerName: "name" },
        { field: "amount", headerName: "amount" },
      ],
      rows: [
        { id: 1, name: "test", amount: 100 },
        { id: 2, name: "test2", amount: 200 },
      ],
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid value_diff_detail run provided", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data
      expect(grid).toHaveAttribute("data-rows", "2");
      expect(grid).toHaveAttribute("data-columns", "3");
    });

    it("calls toValueDiffGridConfigured with result and options", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          changedOnly: false,
          pinnedColumns: [],
          displayMode: "inline",
          columnsRenderMode: {},
        }),
      );
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe("empty states", () => {
    it("displays 'No data' when columns are empty (without toolbar)", () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [],
        rows: [],
      });
      const run = createValueDiffDetailRunEmpty();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      // Should show "No data" message
      expect(screen.getByText("No data")).toBeInTheDocument();

      // Should NOT render toolbar controls
      expect(
        screen.queryByTestId("display-mode-switch"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("changed-only-checkbox"),
      ).not.toBeInTheDocument();

      // Should NOT render grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("displays 'No change' when changedOnly is true and rows are empty (WITH toolbar)", () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [
          { field: "id", headerName: "id" },
          { field: "name", headerName: "name" },
        ],
        rows: [],
      });
      const run = createValueDiffDetailRun();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ changed_only: true }}
        />,
      );

      // Should show "No change" message
      expect(screen.getByText("No change")).toBeInTheDocument();

      // Should STILL render toolbar controls
      expect(screen.getByTestId("display-mode-switch")).toBeInTheDocument();
      expect(screen.getByTestId("changed-only-checkbox")).toBeInTheDocument();

      // Should NOT render grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
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
        renderWithProviders(<ValueDiffDetailResultView run={wrongRun} />);
      }).toThrow("Run type must be value_diff_detail");

      consoleSpy.mockRestore();
    });

    it("throws error with correct message format for type guard failure", () => {
      expectThrowsForWrongType(
        ValueDiffDetailResultView as React.ComponentType<{ run: unknown }>,
        createRowCountDiffRun(),
        "value_diff_detail",
      );
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid", () => {
      const run = createValueDiffDetailRun();
      const ref = createGridRef();

      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ValueDiffDetailResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected (mocked to provide methods)
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });
  });

  // ==========================================================================
  // Toolbar Tests
  // ==========================================================================

  describe("toolbar", () => {
    it("renders toolbar controls", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      // Factory renders toolbar controls directly (not via RunToolbar)
      expect(screen.getByTestId("display-mode-switch")).toBeInTheDocument();
      expect(screen.getByTestId("changed-only-checkbox")).toBeInTheDocument();
    });

    it("renders DiffDisplayModeSwitch in toolbar", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(screen.getByTestId("display-mode-switch")).toBeInTheDocument();
    });

    it("renders ChangedOnlyCheckbox in toolbar", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(screen.getByTestId("changed-only-checkbox")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ViewOptions Tests
  // ==========================================================================

  describe("viewOptions", () => {
    it("uses default changed_only value of false", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          changedOnly: false,
        }),
      );
    });

    it("respects changed_only viewOption when set to true", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ changed_only: true }}
        />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          changedOnly: true,
        }),
      );
    });

    it("uses default display_mode value of 'inline'", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          displayMode: "inline",
        }),
      );

      // Also verify the switch shows inline
      const switchButton = screen.getByTestId("display-mode-switch");
      expect(switchButton).toHaveAttribute("data-display-mode", "inline");
    });

    it("respects display_mode viewOption when set to side_by_side", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ display_mode: "side_by_side" }}
        />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          displayMode: "side_by_side",
        }),
      );
    });

    it("calls onViewOptionsChanged when changed_only checkbox is toggled", () => {
      const run = createValueDiffDetailRun();
      const mockOnViewOptionsChanged = jest.fn();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ changed_only: false }}
          onViewOptionsChanged={mockOnViewOptionsChanged}
        />,
      );

      const checkbox = screen.getByTestId("changed-only-checkbox");
      // The component's onChange callback doesn't use the event, so click works
      fireEvent.click(checkbox);

      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          changed_only: true,
        }),
      );
    });

    it("calls onViewOptionsChanged when display_mode is toggled", () => {
      const run = createValueDiffDetailRun();
      const mockOnViewOptionsChanged = jest.fn();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ display_mode: "inline" }}
          onViewOptionsChanged={mockOnViewOptionsChanged}
        />,
      );

      const switchButton = screen.getByTestId("display-mode-switch");
      fireEvent.click(switchButton);

      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          display_mode: "side_by_side",
        }),
      );
    });

    it("uses default pinned_columns value of empty array", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          pinnedColumns: [],
        }),
      );
    });

    it("respects pinned_columns viewOption", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ pinned_columns: ["id", "name"] }}
        />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          pinnedColumns: ["id", "name"],
        }),
      );
    });

    it("uses default columnsRenderMode value of empty object", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          columnsRenderMode: {},
        }),
      );
    });

    it("respects columnsRenderMode viewOption", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ columnsRenderMode: { amount: "percent" } }}
        />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          columnsRenderMode: { amount: "percent" },
        }),
      );
    });
  });

  // ==========================================================================
  // Warning Tests
  // ==========================================================================

  describe("warnings", () => {
    it("shows warning when limit > 0 and result.more is true", () => {
      const run = createValueDiffDetailRunWithMore();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      // Factory renders warning text directly in the toolbar area
      expect(screen.getByText(/Warning:/)).toBeInTheDocument();
      expect(screen.getByText(/1,000/)).toBeInTheDocument();
    });

    it("does not show warning when limit is 0", () => {
      const run = createValueDiffDetailRun();
      // Ensure limit is 0 and more is false (default fixture)

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(screen.queryByText(/Warning:/)).not.toBeInTheDocument();
    });

    it("does not show warning when result.more is false", () => {
      const run = createValueDiffDetailRun();
      // Override to have limit but more=false
      if (run.result) {
        run.result.limit = 1000;
        run.result.more = false;
      }

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      expect(screen.queryByText(/Warning:/)).not.toBeInTheDocument();
    });

    it("warning message contains correct limit value", () => {
      const run = createValueDiffDetailRunWithMore();

      renderWithProviders(<ValueDiffDetailResultView run={run} />);

      // Limit is 1000, should be formatted with locale (1,000)
      expect(screen.getByText(/1,000 records/)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // onAddToChecklist Prop Tests
  // ==========================================================================

  describe("onAddToChecklist", () => {
    it("accepts onAddToChecklist prop without error", () => {
      const run = createValueDiffDetailRun();
      const mockOnAddToChecklist = jest.fn();

      // Should not throw
      expect(() => {
        renderWithProviders(
          <ValueDiffDetailResultView
            run={run}
            onAddToChecklist={mockOnAddToChecklist}
          />,
        );
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles undefined viewOptions gracefully", () => {
      const run = createValueDiffDetailRun();

      // Should not throw with undefined viewOptions
      expect(() => {
        renderWithProviders(
          <ValueDiffDetailResultView run={run} viewOptions={undefined} />,
        );
      }).not.toThrow();
    });

    it("handles partial viewOptions", () => {
      const run = createValueDiffDetailRun();

      renderWithProviders(
        <ValueDiffDetailResultView
          run={run}
          viewOptions={{ changed_only: true }}
        />,
      );

      // Should use default for display_mode while respecting changed_only
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run.result,
        ["id"],
        expect.objectContaining({
          changedOnly: true,
          displayMode: "inline",
        }),
      );
    });

    it("handles result with undefined limit", () => {
      const run = createValueDiffDetailRun();
      if (run.result) {
        delete (run.result as unknown as Record<string, unknown>).limit;
      }

      // Should not throw and should not show warning
      expect(() => {
        renderWithProviders(<ValueDiffDetailResultView run={run} />);
      }).not.toThrow();

      expect(screen.queryByTestId("warning")).not.toBeInTheDocument();
    });
  });
});
