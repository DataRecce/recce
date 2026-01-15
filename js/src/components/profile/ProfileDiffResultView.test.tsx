/**
 * @file ProfileDiffResultView.test.tsx
 * @description Baseline tests for ProfileDiffResultView and ProfileResultView components
 *
 * These tests capture current component behavior before refactoring to factory pattern.
 * Tests verify:
 * - Correct rendering with valid run data
 * - Empty state display when columns are empty
 * - Type guard throws for wrong run types
 * - Ref forwarding to underlying grid (DataGridHandle)
 * - Toolbar with DiffDisplayModeSwitch (ProfileDiffResultView only)
 * - ViewOptions handling (display_mode, pinned_columns, columnsRenderMode)
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

// Mock ag-grid-react to avoid class extension error
jest.mock("ag-grid-react", () => ({
  AgGridReact: jest.fn(() => null),
}));

// Mock dataGridFactory - use factory pattern that returns mock from closure
const mockCreateDataGrid = jest.fn();
jest.mock("@datarecce/ui/components/ui/dataGrid/dataGridFactory", () => ({
  createDataGrid: (...args: unknown[]) => mockCreateDataGrid(...args),
}));

// Mock ScreenshotDataGrid with our test utility mock
jest.mock("@datarecce/ui/primitives", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  DataGridHandle: {},
}));

// Mock ScreenshotDataGrid from @datarecce/ui package (used by factory)
// This path is resolved by Jest's moduleNameMapper to packages/ui/src
jest.mock("@datarecce/ui/components/data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: () => null,
  DataGridHandle: {},
}));

// Mock RunToolbar component from @datarecce/ui
jest.mock("@datarecce/ui/components/run/RunToolbar", () => ({
  RunToolbar: jest.fn(({ children }) => (
    <div data-testid="run-toolbar">{children}</div>
  )),
}));

// Mock DiffDisplayModeSwitch component from @datarecce/ui/components/ui
const mockOnDisplayModeChanged = jest.fn();
jest.mock("@datarecce/ui/components/ui/DiffDisplayModeSwitch", () => ({
  DiffDisplayModeSwitch: jest.fn(({ displayMode, onDisplayModeChanged }) => (
    <button
      data-testid="display-mode-switch"
      data-display-mode={displayMode}
      onClick={() => {
        mockOnDisplayModeChanged(
          displayMode === "inline" ? "side_by_side" : "inline",
        );
        onDisplayModeChanged(
          displayMode === "inline" ? "side_by_side" : "inline",
        );
      }}
    >
      {displayMode}
    </button>
  )),
}));

// Mock useIsDark hook from @datarecce/ui
const mockUseIsDark = jest.fn(() => false);
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import {
  ProfileDiffResultView,
  ProfileResultView,
} from "@datarecce/ui/components";
import { fireEvent, screen } from "@testing-library/react";
import React from "react";
import {
  createProfileDiffRun,
  createProfileRun,
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

describe("ProfileDiffResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    mockOnDisplayModeChanged.mockClear();
    jest.clearAllMocks();

    // Default mock implementation returns grid data
    mockCreateDataGrid.mockReturnValue({
      columns: [
        { field: "column", headerName: "Column" },
        { field: "type", headerName: "Type" },
        { field: "count", headerName: "Count" },
        { field: "distinct", headerName: "Distinct" },
        { field: "nulls", headerName: "Nulls" },
        { field: "min", headerName: "Min" },
        { field: "max", headerName: "Max" },
      ],
      rows: [
        {
          column: "id",
          type: "integer",
          count: 1000,
          distinct: 1000,
          nulls: 0,
          min: 1,
          max: 1000,
        },
        {
          column: "name",
          type: "text",
          count: 1000,
          distinct: 850,
          nulls: 5,
          min: null,
          max: null,
        },
        {
          column: "amount",
          type: "number",
          count: 1000,
          distinct: 500,
          nulls: 10,
          min: 0.01,
          max: 9999.99,
        },
      ],
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid profile_diff run provided", () => {
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data (3 rows in mock)
      expect(grid).toHaveAttribute("data-rows", "3");
      // Verify columns: column, type, count, distinct, nulls, min, max
      expect(grid).toHaveAttribute("data-columns", "7");
    });

    it("shows empty state when gridData.columns.length === 0", () => {
      mockCreateDataGrid.mockReturnValue({ columns: [], rows: [] });
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // Should display "No data" message
      expect(screen.getByText("No data")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("shows empty state when createDataGrid returns null", () => {
      mockCreateDataGrid.mockReturnValue(null);
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // Should display "No data" message (default from ?? { columns: [], rows: [] })
      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    it("applies light mode background styling when useIsDark returns false", () => {
      mockUseIsDark.mockReturnValue(false);
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // The component should render (we verify useIsDark is called)
      expect(mockUseIsDark).toHaveBeenCalled();
      expect(
        screen.getByTestId("screenshot-data-grid-mock"),
      ).toBeInTheDocument();
    });

    it("applies dark mode background styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // The component should still render
      expect(mockUseIsDark).toHaveBeenCalled();
      expect(
        screen.getByTestId("screenshot-data-grid-mock"),
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("throws error when wrong run type provided", () => {
      const wrongRun = createValueDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // Factory pattern uses standard error message format
      expect(() => {
        renderWithProviders(<ProfileDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be profile_diff");

      consoleSpy.mockRestore();
    });

    it("throws error with correct message format for type guard failure", () => {
      // Use the utility function for consistency
      expectThrowsForWrongType(
        ProfileDiffResultView as React.ComponentType<{ run: unknown }>,
        createValueDiffRun(),
        "profile_diff",
      );
    });

    it("throws when profile run (non-diff) is passed to ProfileDiffResultView", () => {
      const wrongRun = createProfileRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // Factory pattern uses standard error message format
      expect(() => {
        renderWithProviders(<ProfileDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be profile_diff");

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid (DataGridHandle)", () => {
      const run = createProfileDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ProfileDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected (mocked to provide methods)
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("ref is null when empty state is displayed", () => {
      mockCreateDataGrid.mockReturnValue({ columns: [], rows: [] });
      const run = createProfileDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ProfileDiffResultView run={run} ref={ref as any} />,
      );

      // When showing empty state, no grid is rendered so ref won't be assigned
      expect(ref.current).toBeNull();
    });
  });

  // ==========================================================================
  // Toolbar Tests
  // ==========================================================================

  describe("toolbar", () => {
    it("renders RunToolbar with DiffDisplayModeSwitch", () => {
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // Should render the toolbar
      expect(screen.getByTestId("run-toolbar")).toBeInTheDocument();

      // Should render the display mode switch inside toolbar
      expect(screen.getByTestId("display-mode-switch")).toBeInTheDocument();
    });

    it("does not render toolbar when in empty state", () => {
      mockCreateDataGrid.mockReturnValue({ columns: [], rows: [] });
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // Should NOT render the toolbar
      expect(screen.queryByTestId("run-toolbar")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("display-mode-switch"),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ViewOptions Tests
  // ==========================================================================

  describe("viewOptions", () => {
    it("uses default display_mode of 'inline' when not specified", () => {
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      const displayModeSwitch = screen.getByTestId("display-mode-switch");
      expect(displayModeSwitch).toHaveAttribute("data-display-mode", "inline");
    });

    it("uses provided display_mode from viewOptions", () => {
      const run = createProfileDiffRun();

      renderWithProviders(
        <ProfileDiffResultView
          run={run}
          viewOptions={{ display_mode: "side_by_side" }}
        />,
      );

      const displayModeSwitch = screen.getByTestId("display-mode-switch");
      expect(displayModeSwitch).toHaveAttribute(
        "data-display-mode",
        "side_by_side",
      );
    });

    it("calls onViewOptionsChanged when display mode changes", () => {
      const run = createProfileDiffRun();
      const mockOnViewOptionsChanged = jest.fn();

      renderWithProviders(
        <ProfileDiffResultView
          run={run}
          viewOptions={{ display_mode: "inline" }}
          onViewOptionsChanged={mockOnViewOptionsChanged}
        />,
      );

      // Click the display mode switch to toggle
      const displayModeSwitch = screen.getByTestId("display-mode-switch");
      fireEvent.click(displayModeSwitch);

      // Should call onViewOptionsChanged with new display_mode
      expect(mockOnViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          display_mode: "side_by_side",
        }),
      );
    });

    it("passes pinned_columns to createDataGrid", () => {
      const run = createProfileDiffRun();
      const pinnedColumns = ["column", "type"];

      renderWithProviders(
        <ProfileDiffResultView
          run={run}
          viewOptions={{ pinned_columns: pinnedColumns }}
        />,
      );

      // Verify createDataGrid was called with pinned columns in options
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          pinnedColumns: pinnedColumns,
        }),
      );
    });

    it("passes displayMode to createDataGrid", () => {
      const run = createProfileDiffRun();

      renderWithProviders(
        <ProfileDiffResultView
          run={run}
          viewOptions={{ display_mode: "side_by_side" }}
        />,
      );

      // Verify createDataGrid was called with display mode in options
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          displayMode: "side_by_side",
        }),
      );
    });

    it("passes columnsRenderMode to createDataGrid with defaults for proportion columns", () => {
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      // Verify createDataGrid was called with default columnsRenderMode
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          columnsRenderMode: expect.objectContaining({
            distinct_proportion: "percent",
            not_null_proportion: "percent",
          }),
        }),
      );
    });

    it("merges provided columnsRenderMode with defaults", () => {
      const run = createProfileDiffRun();

      renderWithProviders(
        <ProfileDiffResultView
          run={run}
          viewOptions={{
            columnsRenderMode: { custom_column: "raw" as const },
          }}
        />,
      );

      // Verify createDataGrid was called with merged columnsRenderMode
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          columnsRenderMode: expect.objectContaining({
            distinct_proportion: "percent",
            not_null_proportion: "percent",
            custom_column: "raw",
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // Data Flow Tests
  // ==========================================================================

  describe("data flow", () => {
    it("passes columns from createDataGrid to ScreenshotDataGrid", () => {
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 7 columns
      expect(grid).toHaveAttribute("data-columns", "7");
    });

    it("passes rows from createDataGrid to ScreenshotDataGrid", () => {
      const run = createProfileDiffRun();

      renderWithProviders(<ProfileDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 3 rows
      expect(grid).toHaveAttribute("data-rows", "3");
    });
  });
});

// ============================================================================
// ProfileResultView Tests (non-diff version)
// ============================================================================

describe("ProfileResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    jest.clearAllMocks();

    // Default mock implementation returns grid data for single environment
    mockCreateDataGrid.mockReturnValue({
      columns: [
        { field: "column", headerName: "Column" },
        { field: "type", headerName: "Type" },
        { field: "count", headerName: "Count" },
        { field: "distinct", headerName: "Distinct" },
        { field: "nulls", headerName: "Nulls" },
      ],
      rows: [
        {
          column: "id",
          type: "integer",
          count: 1000,
          distinct: 1000,
          nulls: 0,
        },
        { column: "name", type: "text", count: 1000, distinct: 850, nulls: 5 },
        {
          column: "amount",
          type: "number",
          count: 1000,
          distinct: 500,
          nulls: 10,
        },
      ],
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid profile run provided", () => {
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data (3 rows in mock)
      expect(grid).toHaveAttribute("data-rows", "3");
      // Verify columns: column, type, count, distinct, nulls (no min/max for base comparison)
      expect(grid).toHaveAttribute("data-columns", "5");
    });

    it("shows empty state when gridData.columns.length === 0", () => {
      mockCreateDataGrid.mockReturnValue({ columns: [], rows: [] });
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      // Should display "No data" message
      expect(screen.getByText("No data")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("shows empty state when createDataGrid returns null", () => {
      mockCreateDataGrid.mockReturnValue(null);
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      // Should display "No data" message
      expect(screen.getByText("No data")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("throws error when wrong run type provided", () => {
      const wrongRun = createValueDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // Factory pattern uses standard error message format
      expect(() => {
        renderWithProviders(<ProfileResultView run={wrongRun} />);
      }).toThrow("Run type must be profile");

      consoleSpy.mockRestore();
    });

    it("throws when profile_diff run is passed to ProfileResultView", () => {
      const wrongRun = createProfileDiffRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // Factory pattern uses standard error message format
      expect(() => {
        renderWithProviders(<ProfileResultView run={wrongRun} />);
      }).toThrow("Run type must be profile");

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid (DataGridHandle)", () => {
      const run = createProfileRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ProfileResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("ref is null when empty state is displayed", () => {
      mockCreateDataGrid.mockReturnValue({ columns: [], rows: [] });
      const run = createProfileRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <ProfileResultView run={run} ref={ref as any} />,
      );

      // When showing empty state, no grid is rendered so ref won't be assigned
      expect(ref.current).toBeNull();
    });
  });

  // ==========================================================================
  // No Toolbar Tests
  // ==========================================================================

  describe("toolbar", () => {
    it("does NOT have RunToolbar with DiffDisplayModeSwitch", () => {
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      // Should NOT render the toolbar (no diff mode switch for single environment)
      expect(screen.queryByTestId("run-toolbar")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("display-mode-switch"),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ViewOptions Tests
  // ==========================================================================

  describe("viewOptions", () => {
    it("passes pinned_columns to createDataGrid", () => {
      const run = createProfileRun();
      const pinnedColumns = ["column", "type"];

      renderWithProviders(
        <ProfileResultView
          run={run}
          viewOptions={{ pinned_columns: pinnedColumns }}
        />,
      );

      // Verify createDataGrid was called with pinned columns in options
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          pinnedColumns: pinnedColumns,
        }),
      );
    });

    it("passes columnsRenderMode to createDataGrid with defaults for proportion columns", () => {
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      // Verify createDataGrid was called with default columnsRenderMode
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          columnsRenderMode: expect.objectContaining({
            distinct_proportion: "percent",
            not_null_proportion: "percent",
          }),
        }),
      );
    });
  });

  // ==========================================================================
  // Data Transformation Tests
  // ==========================================================================

  describe("data transformation", () => {
    it("passes columns from createDataGrid to ScreenshotDataGrid", () => {
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 5 columns
      expect(grid).toHaveAttribute("data-columns", "5");
    });

    it("passes rows from createDataGrid to ScreenshotDataGrid", () => {
      const run = createProfileRun();

      renderWithProviders(<ProfileResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 3 rows
      expect(grid).toHaveAttribute("data-rows", "3");
    });
  });
});

// ============================================================================
// Shared Behavior Tests
// ============================================================================

describe("ProfileResultView shared behavior", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    jest.clearAllMocks();

    // Default mock for shared tests
    mockCreateDataGrid.mockReturnValue({
      columns: [{ field: "column", headerName: "Column" }],
      rows: [{ column: "test" }],
    });
  });

  it("useIsDark hook is called for both components", () => {
    const diffRun = createProfileDiffRun();
    const singleRun = createProfileRun();

    renderWithProviders(<ProfileDiffResultView run={diffRun} />);
    expect(mockUseIsDark).toHaveBeenCalled();

    mockUseIsDark.mockClear();

    renderWithProviders(<ProfileResultView run={singleRun} />);
    expect(mockUseIsDark).toHaveBeenCalled();
  });

  it("both components use createDataGrid factory", () => {
    const diffRun = createProfileDiffRun();
    const singleRun = createProfileRun();

    renderWithProviders(<ProfileDiffResultView run={diffRun} />);
    expect(mockCreateDataGrid).toHaveBeenCalledWith(
      diffRun,
      expect.any(Object),
    );

    mockCreateDataGrid.mockClear();

    renderWithProviders(<ProfileResultView run={singleRun} />);
    expect(mockCreateDataGrid).toHaveBeenCalledWith(
      singleRun,
      expect.any(Object),
    );
  });

  it("both components show same empty state text", () => {
    mockCreateDataGrid.mockReturnValue({ columns: [], rows: [] });

    const diffRun = createProfileDiffRun();
    const singleRun = createProfileRun();

    const { unmount: unmount1 } = renderWithProviders(
      <ProfileDiffResultView run={diffRun} />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
    unmount1();

    const { unmount: unmount2 } = renderWithProviders(
      <ProfileResultView run={singleRun} />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
    unmount2();
  });
});
