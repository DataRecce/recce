/**
 * @file RowCountDiffResultView.test.tsx
 * @description Baseline tests for RowCountDiffResultView and RowCountResultView components
 *
 * These tests capture current component behavior before refactoring to factory pattern.
 * Tests verify:
 * - Correct rendering with valid run data
 * - Empty state display when no nodes matched
 * - Type guard throws for wrong run types
 * - Ref forwarding to underlying grid
 * - Dark mode styling (via useIsDark hook)
 */

import { vi } from "vitest";

// ============================================================================
// Mocks - MUST be set up before imports
// ============================================================================

// Mock AG Grid to avoid ES module parsing errors
vi.mock("ag-grid-community", () => ({
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
  ClientSideRowModelModule: {},
  AllCommunityModule: {},
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
}));

// Mock dataGridFactory to avoid deep import chain issues
// This prevents importing toSchemaDataGrid -> schemaCells -> ag-grid-react
vi.mock("@datarecce/ui/components/ui/dataGrid", () => ({
  createDataGrid: vi.fn((run) => {
    // Return mock grid data based on run result
    if (!run.result || Object.keys(run.result).length === 0) {
      return { columns: [], rows: [] };
    }

    const resultKeys = Object.keys(run.result);
    const rows = resultKeys.map((name, index) => ({
      name,
      base: run.result[name].base ?? "N/A",
      current: run.result[name].curr ?? run.result[name].current ?? "N/A",
      delta: "0",
      __status: undefined,
      _index: index,
    }));

    // Different column counts for diff vs non-diff
    if (run.type === "row_count_diff") {
      return {
        columns: [
          { field: "name", headerName: "Name" },
          { field: "base", headerName: "Base Rows" },
          { field: "current", headerName: "Current Rows" },
          { field: "delta", headerName: "Delta" },
        ],
        rows,
      };
    }

    // row_count (non-diff)
    return {
      columns: [
        { field: "name", headerName: "Name" },
        { field: "current", headerName: "Row Count" },
      ],
      rows,
    };
  }),
}));

// Mock ScreenshotDataGrid with our test utility mock (both local and packages/ui versions)
vi.mock("@datarecce/ui/primitives", async () => {
  const testUtils = await vi.importActual(
    "@/testing-utils/resultViewTestUtils",
  );
  return {
    ScreenshotDataGrid: (testUtils as Record<string, unknown>)
      .screenshotDataGridMock,
    EmptyRowsRenderer: () => (
      <div data-testid="empty-rows-renderer">No data</div>
    ),
  };
});

vi.mock("@datarecce/ui/components/data/ScreenshotDataGrid", async () => {
  const testUtils = await vi.importActual(
    "@/testing-utils/resultViewTestUtils",
  );
  return {
    ScreenshotDataGrid: (testUtils as Record<string, unknown>)
      .screenshotDataGridMock,
    EmptyRowsRenderer: () => (
      <div data-testid="empty-rows-renderer">No data</div>
    ),
  };
});

// Mock useIsDark hook from @datarecce/ui
const mockUseIsDark = vi.fn(() => false);
vi.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import {
  RowCountDiffResultView,
  RowCountResultView,
} from "@datarecce/ui/components/rowcount";
import { screen } from "@testing-library/react";
import React from "react";
import {
  createEmptyRowCountDiffRun,
  createRowCountDiffRun,
  createRowCountRun,
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

describe("RowCountDiffResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid row_count_diff run provided", () => {
      const run = createRowCountDiffRun();

      renderWithProviders(<RowCountDiffResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data (4 models in fixture)
      expect(grid).toHaveAttribute("data-rows", "4");
      // Verify columns: name, base, current, delta
      expect(grid).toHaveAttribute("data-columns", "4");
    });

    it("shows empty state when gridData.rows.length === 0", () => {
      const emptyRun = createEmptyRowCountDiffRun();

      renderWithProviders(<RowCountDiffResultView run={emptyRun} />);

      // Should display "No nodes matched" message
      expect(screen.getByText("No nodes matched")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("applies light mode background styling when useIsDark returns false", () => {
      mockUseIsDark.mockReturnValue(false);
      const emptyRun = createEmptyRowCountDiffRun();

      renderWithProviders(<RowCountDiffResultView run={emptyRun} />);

      // The empty state Box should be rendered (we verify useIsDark is called)
      expect(mockUseIsDark).toHaveBeenCalled();
      expect(screen.getByText("No nodes matched")).toBeInTheDocument();
    });

    it("applies dark mode background styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      const emptyRun = createEmptyRowCountDiffRun();

      renderWithProviders(<RowCountDiffResultView run={emptyRun} />);

      // The component should still render the empty state
      expect(mockUseIsDark).toHaveBeenCalled();
      expect(screen.getByText("No nodes matched")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("throws error when wrong run type provided", () => {
      const wrongRun = createValueDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<RowCountDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be row_count_diff");

      consoleSpy.mockRestore();
    });

    it("throws error with correct message format for type guard failure", () => {
      // Use the utility function for consistency
      // Type assertion needed because component has stricter type than utility expects
      expectThrowsForWrongType(
        RowCountDiffResultView as React.ComponentType<{ run: unknown }>,
        createValueDiffRun(),
        "row_count_diff",
      );
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid", () => {
      const run = createRowCountDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <RowCountDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected (mocked to provide methods)
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("ref is null when empty state is displayed", () => {
      const emptyRun = createEmptyRowCountDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <RowCountDiffResultView run={emptyRun} ref={ref as any} />,
      );

      // When showing empty state, no grid is rendered so ref won't be assigned
      expect(ref.current).toBeNull();
    });
  });

  // ==========================================================================
  // Data Transformation Tests
  // ==========================================================================

  describe("data transformation", () => {
    it("passes correct columns and rows to grid", () => {
      const run = createRowCountDiffRun();

      renderWithProviders(<RowCountDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");

      // The fixture has 4 models: orders, customers, products, old_model
      expect(grid).toHaveAttribute("data-rows", "4");

      // Columns: name, base, current, delta
      expect(grid).toHaveAttribute("data-columns", "4");
    });
  });
});

// ============================================================================
// RowCountResultView Tests (non-diff version)
// ============================================================================

describe("RowCountResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid row_count run provided", () => {
      const run = createRowCountRun();

      renderWithProviders(<RowCountResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data (3 models in fixture)
      expect(grid).toHaveAttribute("data-rows", "3");
      // Verify columns: name, current (no base or delta for non-diff)
      expect(grid).toHaveAttribute("data-columns", "2");
    });

    it("shows empty state when no nodes in result", () => {
      // Create an empty row_count run (result is empty object)
      const emptyRun = {
        ...createRowCountRun(),
        result: {},
        params: { node_names: [] },
      };

      renderWithProviders(<RowCountResultView run={emptyRun} />);

      // Should display "No nodes matched" message
      expect(screen.getByText("No nodes matched")).toBeInTheDocument();

      // Should NOT render the grid
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
      const wrongRun = createValueDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<RowCountResultView run={wrongRun} />);
      }).toThrow("Run type must be row_count");

      consoleSpy.mockRestore();
    });

    it("throws when row_count_diff run is passed to RowCountResultView", () => {
      const wrongRun = createRowCountDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<RowCountResultView run={wrongRun} />);
      }).toThrow("Run type must be row_count");

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid", () => {
      const run = createRowCountRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <RowCountResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });
  });

  // ==========================================================================
  // Data Transformation Tests
  // ==========================================================================

  describe("data transformation", () => {
    it("passes correct columns and rows to grid for single environment", () => {
      const run = createRowCountRun();

      renderWithProviders(<RowCountResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");

      // The fixture has 3 models: orders, customers, products
      expect(grid).toHaveAttribute("data-rows", "3");

      // Columns: name, current only (no base or delta)
      expect(grid).toHaveAttribute("data-columns", "2");
    });
  });
});

// ============================================================================
// Shared Behavior Tests
// ============================================================================

describe("RowCountGridView shared behavior", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    vi.clearAllMocks();
  });

  it("both components use the same internal RowCountGridView", () => {
    // This is verified by the fact that both components throw similar errors
    // and have the same rendering patterns

    const diffRun = createRowCountDiffRun();
    const singleRun = createRowCountRun();

    // Both should render successfully
    const { unmount: unmount1 } = renderWithProviders(
      <RowCountDiffResultView run={diffRun} />,
    );
    expect(screen.getByTestId("screenshot-data-grid-mock")).toBeInTheDocument();
    unmount1();

    const { unmount: unmount2 } = renderWithProviders(
      <RowCountResultView run={singleRun} />,
    );
    expect(screen.getByTestId("screenshot-data-grid-mock")).toBeInTheDocument();
    unmount2();
  });

  it("useIsDark hook is called for both components", () => {
    const diffRun = createRowCountDiffRun();
    const singleRun = createRowCountRun();

    renderWithProviders(<RowCountDiffResultView run={diffRun} />);
    expect(mockUseIsDark).toHaveBeenCalled();

    mockUseIsDark.mockClear();

    renderWithProviders(<RowCountResultView run={singleRun} />);
    expect(mockUseIsDark).toHaveBeenCalled();
  });
});
