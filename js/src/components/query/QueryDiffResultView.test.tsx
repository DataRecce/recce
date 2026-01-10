/**
 * @file QueryDiffResultView.test.tsx
 * @description Tests for QueryDiffResultView component (using createResultView factory)
 *
 * The component handles both JOIN and non-JOIN modes internally via `isJoinMode` flag:
 * - JOIN mode: Server computes the diff, result has `run.result.diff`
 * - Non-JOIN mode: Client-side diff, result has `run.result.base` and `run.result.current`
 *
 * Tests verify:
 * - Correct bifurcation based on result.diff presence
 * - Correct rendering with valid run data for both views
 * - Empty state display when no data for both views
 * - Type guard throws for wrong run types
 * - Ref forwarding to underlying grid
 * - RunToolbar with DiffDisplayModeSwitch and ChangedOnlyCheckbox
 * - ViewOptions handling (changed_only, display_mode, pinned_columns, primary_keys)
 * - Warning for limit exceeded (both views)
 * - Warning for invalid primary key (only non-Join view)
 * - "No change" state when changedOnly + no rows (only Join view)
 * - baseTitle/currentTitle for sandbox editor
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

// Mock dataGridFactory - use factory pattern that returns mock from closure
const mockCreateDataGrid = jest.fn();
jest.mock("@/lib/dataGrid/dataGridFactory", () => ({
  createDataGrid: (...args: unknown[]) => mockCreateDataGrid(...args),
}));

// Mock ScreenshotDataGrid with our test utility mock
jest.mock("@/components/data-grid/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="empty-rows-renderer">{emptyMessage ?? "No data"}</div>
  ),
}));

// Mock useIsDark hook from @datarecce/ui
const mockUseIsDark = jest.fn(() => false);

// Mock packages/ui ScreenshotDataGrid (used by createResultView factory)
jest.mock("@datarecce/ui/components/data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="empty-rows-renderer">{emptyMessage ?? "No rows"}</div>
  ),
}));

// Mock packages/ui hooks
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import type { QueryDiffViewOptions } from "@datarecce/ui/api";
import { fireEvent, screen } from "@testing-library/react";
import React from "react";
// Import Run from OSS types for proper discriminated union support with Extract<>
import type { Run } from "@/lib/api/types";
import {
  createGridRef,
  renderWithProviders,
} from "@/testing-utils/resultViewTestUtils";
import { QueryDiffResultView } from "./QueryDiffResultView";

// ============================================================================
// Local Test Fixtures
// ============================================================================

/**
 * Creates a query_diff run fixture with base/current results (NO diff property)
 * This triggers PrivateQueryDiffResultView (non-Join view)
 */
function createQueryDiffRun(): Extract<Run, { type: "query_diff" }> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders LIMIT 100",
      primary_keys: ["id"],
    },
    result: {
      base: {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "name", name: "name", type: "text" },
          { key: "total", name: "total", type: "number" },
        ],
        data: [
          [1, "Alice", 100.0],
          [2, "Bob", 200.0],
        ],
        limit: 0,
        more: false,
      },
      current: {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "name", name: "name", type: "text" },
          { key: "total", name: "total", type: "number" },
        ],
        data: [
          [1, "Alice", 105.0],
          [3, "Charlie", 300.0],
        ],
        limit: 0,
        more: false,
      },
    },
  };
}

/**
 * Creates a query_diff run fixture WITH diff property (triggers Join view)
 * This triggers PrivateQueryDiffJoinResultView
 */
function createQueryDiffJoinRun(): Extract<Run, { type: "query_diff" }> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders LIMIT 100",
    },
    result: {
      diff: {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "name", name: "name", type: "text" },
          { key: "total", name: "total", type: "number" },
        ],
        data: [
          [1, "Alice", 100.0],
          [2, "Bob", 200.0],
        ],
        limit: 0,
        more: false,
      },
    },
  };
}

/**
 * Creates a query_diff run with limit warning (more=true) - non-Join view
 */
function createQueryDiffRunWithLimitWarning(): Extract<
  Run,
  { type: "query_diff" }
> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders",
      primary_keys: ["id"],
    },
    result: {
      base: {
        columns: [{ key: "id", name: "id", type: "integer" }],
        data: [[1], [2]],
        limit: 1000,
        more: true,
      },
      current: {
        columns: [{ key: "id", name: "id", type: "integer" }],
        data: [[1], [3]],
        limit: 1000,
        more: false,
      },
    },
  };
}

/**
 * Creates a query_diff Join run with limit warning (more=true)
 */
function createQueryDiffJoinRunWithLimitWarning(): Extract<
  Run,
  { type: "query_diff" }
> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders",
    },
    result: {
      diff: {
        columns: [{ key: "id", name: "id", type: "integer" }],
        data: [[1], [2]],
        limit: 1000,
        more: true,
      },
    },
  };
}

/**
 * Creates a query_diff run with empty result
 */
function createEmptyQueryDiffRun(): Extract<Run, { type: "query_diff" }> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders WHERE 1=0",
      primary_keys: ["id"],
    },
    result: {
      base: {
        columns: [],
        data: [],
        limit: 0,
        more: false,
      },
      current: {
        columns: [],
        data: [],
        limit: 0,
        more: false,
      },
    },
  };
}

/**
 * Creates a query_diff Join run with empty result
 */
function createEmptyQueryDiffJoinRun(): Extract<Run, { type: "query_diff" }> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders WHERE 1=0",
    },
    result: {
      diff: {
        columns: [],
        data: [],
        limit: 0,
        more: false,
      },
    },
  };
}

/**
 * Creates a query_diff run for sandbox editor (has current_model in params)
 */
function createSandboxEditorRun(): Extract<Run, { type: "query_diff" }> {
  return {
    type: "query_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: {
      sql_template: "SELECT * FROM orders",
      primary_keys: ["id"],
      // biome-ignore lint/suspicious/noExplicitAny: testing QueryPreviewChangeParams
    } as any,
    result: {
      base: {
        columns: [{ key: "id", name: "id", type: "integer" }],
        data: [[1]],
        limit: 0,
        more: false,
      },
      current: {
        columns: [{ key: "id", name: "id", type: "integer" }],
        data: [[1]],
        limit: 0,
        more: false,
      },
    },
  };
}

/**
 * Creates a wrong run type for type guard testing
 */
function createWrongTypeRun(): Extract<Run, { type: "row_count_diff" }> {
  return {
    type: "row_count_diff",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: { node_names: ["orders"] },
    result: { orders: { base: 100, curr: 200 } },
  };
}

// ============================================================================
// Test Setup
// ============================================================================

describe("QueryDiffResultView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsDark.mockReturnValue(false);

    // Default mock implementation returns grid data
    mockCreateDataGrid.mockReturnValue({
      columns: [
        { field: "id", headerName: "id" },
        { field: "name", headerName: "name" },
        { field: "total", headerName: "total" },
      ],
      rows: [
        { id: 1, name: "Alice", total: 100.0, __status: undefined },
        { id: 2, name: "Bob", total: 200.0, __status: "added" },
        { id: 3, name: "Charlie", total: 300.0, __status: "removed" },
      ],
    });
  });

  // ==========================================================================
  // Bifurcation Tests
  // ==========================================================================

  describe("bifurcation", () => {
    it("uses non-Join view when result has base/current but no diff", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Both views render a grid and toolbar, but we can verify createDataGrid was called
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          changedOnly: false,
        }),
      );
    });

    it("uses Join view when result.diff is not null", () => {
      const run = createQueryDiffJoinRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Both views render a grid and toolbar, we verify createDataGrid was called
      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          changedOnly: false,
        }),
      );
    });
  });

  // ==========================================================================
  // Rendering Tests (Non-Join View)
  // ==========================================================================

  describe("rendering (non-Join view)", () => {
    it("renders grid with data when valid query_diff run provided", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data
      expect(grid).toHaveAttribute("data-rows", "3");
      expect(grid).toHaveAttribute("data-columns", "3");
    });

    it("calls createDataGrid with the run object and options", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
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
  // Rendering Tests (Join View)
  // ==========================================================================

  describe("rendering (Join view)", () => {
    it("renders grid with data when query_diff run has diff property", () => {
      const run = createQueryDiffJoinRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();
    });

    it("calls createDataGrid with the run object and options", () => {
      const run = createQueryDiffJoinRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
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

  describe("empty state", () => {
    it('displays "No data" when gridData.columns.length === 0 (non-Join view)', () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [],
        rows: [],
      });
      const run = createEmptyQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it('displays "No data" when gridData.columns.length === 0 (Join view)', () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [],
        rows: [],
      });
      const run = createEmptyQueryDiffJoinRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it('displays "No change" when changedOnly + no rows (Join view only)', () => {
      // Set up mock to return columns but no rows
      mockCreateDataGrid.mockReturnValue({
        columns: [
          { field: "id", headerName: "id" },
          { field: "name", headerName: "name" },
        ],
        rows: [],
      });
      const run = createQueryDiffJoinRun();
      const viewOptions: QueryDiffViewOptions = {
        changed_only: true,
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(screen.getByText("No change")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("throws error when wrong run type provided", () => {
      const wrongRun = createWrongTypeRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<QueryDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be query_diff");

      consoleSpy.mockRestore();
    });

    it("accepts query_diff type run (non-Join)", () => {
      const run = createQueryDiffRun();

      // Should not throw
      expect(() => {
        renderWithProviders(<QueryDiffResultView run={run} />);
      }).not.toThrow();
    });

    it("accepts query_diff type run (Join)", () => {
      const run = createQueryDiffJoinRun();

      // Should not throw
      expect(() => {
        renderWithProviders(<QueryDiffResultView run={run} />);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotDataGrid (non-Join view)", () => {
      const run = createQueryDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <QueryDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected (mocked to provide methods)
      expect(ref.current).not.toBeNull();
      // Check for real DataGridHandle properties
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("forwards ref to ScreenshotDataGrid (Join view)", () => {
      const run = createQueryDiffJoinRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <QueryDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected
      expect(ref.current).not.toBeNull();
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("ref is null when empty state is displayed", () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [],
        rows: [],
      });
      const run = createEmptyQueryDiffRun();
      const ref = createGridRef();

      // Cast ref to any for test flexibility
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <QueryDiffResultView run={run} ref={ref as any} />,
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
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should render the toggle buttons for display mode
      expect(screen.getByText("Inline")).toBeInTheDocument();
      expect(screen.getByText("Side by side")).toBeInTheDocument();
    });

    it("renders RunToolbar with ChangedOnlyCheckbox", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should render the "Changed only" checkbox
      expect(screen.getByText("Changed only")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // ViewOptions Tests
  // ==========================================================================

  describe("viewOptions", () => {
    it("passes changed_only to createDataGrid", () => {
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        changed_only: true,
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          changedOnly: true,
        }),
      );
    });

    it("passes display_mode to createDataGrid", () => {
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        display_mode: "side_by_side",
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          displayMode: "side_by_side",
        }),
      );
    });

    it("passes pinned_columns to createDataGrid", () => {
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        pinned_columns: ["id", "name"],
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          pinnedColumns: ["id", "name"],
        }),
      );
    });

    it("passes columnsRenderMode to createDataGrid", () => {
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        columnsRenderMode: { total: "percent" },
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          columnsRenderMode: { total: "percent" },
        }),
      );
    });

    it("calls onViewOptionsChanged when changed_only checkbox toggled", () => {
      const run = createQueryDiffRun();
      const onViewOptionsChanged = jest.fn();

      renderWithProviders(
        <QueryDiffResultView
          run={run}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Find and click the checkbox
      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          changed_only: true,
        }),
      );
    });

    it("calls onViewOptionsChanged when display mode changed to side_by_side", () => {
      const run = createQueryDiffRun();
      const onViewOptionsChanged = jest.fn();

      renderWithProviders(
        <QueryDiffResultView
          run={run}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Click "Side by side" button
      const sideBySideButton = screen.getByText("Side by side");
      fireEvent.click(sideBySideButton);

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          display_mode: "side_by_side",
        }),
      );
    });
  });

  // ==========================================================================
  // Warning Tests (Non-Join View)
  // ==========================================================================

  describe("warnings (non-Join view)", () => {
    it("shows limit warning when limit > 0 and base.more or current.more", () => {
      const run = createQueryDiffRunWithLimitWarning();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should show the warning message
      expect(
        screen.getByText(
          /Warning: Displayed results are limited to 1,000 records/,
        ),
      ).toBeInTheDocument();
    });

    it("shows invalid primary key warning when invalidPKeyBase is true", () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [{ field: "id", headerName: "id" }],
        rows: [{ id: 1 }],
        invalidPKeyBase: true,
        invalidPKeyCurrent: false,
      });
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        primary_keys: ["id"],
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(
        screen.getByText(
          /Warning: The primary key 'id' is not unique in the base environment/,
        ),
      ).toBeInTheDocument();
    });

    it("shows invalid primary key warning when invalidPKeyCurrent is true", () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [{ field: "id", headerName: "id" }],
        rows: [{ id: 1 }],
        invalidPKeyBase: false,
        invalidPKeyCurrent: true,
      });
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        primary_keys: ["id"],
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(
        screen.getByText(
          /Warning: The primary key 'id' is not unique in the current environment/,
        ),
      ).toBeInTheDocument();
    });

    it("shows invalid primary key warning for both environments when both invalid", () => {
      mockCreateDataGrid.mockReturnValue({
        columns: [{ field: "id", headerName: "id" }],
        rows: [{ id: 1 }],
        invalidPKeyBase: true,
        invalidPKeyCurrent: true,
      });
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        primary_keys: ["id"],
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(
        screen.getByText(
          /Warning: The primary key 'id' is not unique in the base and current environments/,
        ),
      ).toBeInTheDocument();
    });

    it("does not show limit warning when limit === 0", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should NOT show any limit warning
      expect(
        screen.queryByText(/Warning: Displayed results are limited/),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Warning Tests (Join View)
  // ==========================================================================

  describe("warnings (Join view)", () => {
    it("shows limit warning when limit > 0 and diff.more", () => {
      const run = createQueryDiffJoinRunWithLimitWarning();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should show the warning message
      expect(
        screen.getByText(
          /Warning: Displayed results are limited to 1,000 records/,
        ),
      ).toBeInTheDocument();
    });

    it("does not show limit warning when limit === 0", () => {
      const run = createQueryDiffJoinRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should NOT show any limit warning
      expect(
        screen.queryByText(/Warning: Displayed results are limited/),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Sandbox Editor Title Tests
  // ==========================================================================

  describe("sandbox editor titles", () => {
    it('passes baseTitle="Original" and currentTitle="Editor" when current_model in params', () => {
      // Create a run with current_model in params
      const run = createSandboxEditorRun();
      // Add current_model to params
      // biome-ignore lint/suspicious/noExplicitAny: testing QueryPreviewChangeParams
      (run.params as any).current_model = "stg_orders";

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          baseTitle: "Original",
          currentTitle: "Editor",
        }),
      );
    });

    it("does not pass baseTitle/currentTitle when current_model not in params", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(mockCreateDataGrid).toHaveBeenCalledWith(
        run,
        expect.objectContaining({
          baseTitle: undefined,
          currentTitle: undefined,
        }),
      );
    });
  });

  // ==========================================================================
  // Dark Mode Tests
  // ==========================================================================

  describe("dark mode", () => {
    it("applies light mode styling when useIsDark returns false", () => {
      mockUseIsDark.mockReturnValue(false);
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Verify useIsDark is called
      expect(mockUseIsDark).toHaveBeenCalled();
    });

    it("applies dark mode styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Verify useIsDark is called
      expect(mockUseIsDark).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Data Flow Tests
  // ==========================================================================

  describe("data flow", () => {
    it("passes columns from createDataGrid to ScreenshotDataGrid", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 3 columns
      expect(grid).toHaveAttribute("data-columns", "3");
    });

    it("passes rows from createDataGrid to ScreenshotDataGrid", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      // Mock returns 3 rows
      expect(grid).toHaveAttribute("data-rows", "3");
    });
  });

  // ==========================================================================
  // Callback Tests (Non-Join View)
  // ==========================================================================

  describe("callbacks (non-Join view)", () => {
    it("calls onViewOptionsChanged when primary keys change", () => {
      const run = createQueryDiffRun();
      const onViewOptionsChanged = jest.fn();
      const callbacks: { onPrimaryKeyChange?: (keys: string[]) => void } = {};

      // Capture the callback passed to createDataGrid
      mockCreateDataGrid.mockImplementation((_run, options) => {
        callbacks.onPrimaryKeyChange = options?.onPrimaryKeyChange;
        return {
          columns: [{ field: "id", headerName: "id" }],
          rows: [{ id: 1 }],
        };
      });

      renderWithProviders(
        <QueryDiffResultView
          run={run}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Simulate primary key change
      callbacks.onPrimaryKeyChange?.(["id", "name"]);

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          primary_keys: ["id", "name"],
        }),
      );
    });

    it("calls onViewOptionsChanged when pinned columns change", () => {
      const run = createQueryDiffRun();
      const onViewOptionsChanged = jest.fn();
      const callbacks: { onPinnedColumnsChange?: (columns: string[]) => void } =
        {};

      // Capture the callback passed to createDataGrid
      mockCreateDataGrid.mockImplementation((_run, options) => {
        callbacks.onPinnedColumnsChange = options?.onPinnedColumnsChange;
        return {
          columns: [{ field: "id", headerName: "id" }],
          rows: [{ id: 1 }],
        };
      });

      renderWithProviders(
        <QueryDiffResultView
          run={run}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Simulate pinned columns change
      callbacks.onPinnedColumnsChange?.(["id"]);

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          pinned_columns: ["id"],
        }),
      );
    });

    it("calls onViewOptionsChanged when columnsRenderMode change", () => {
      const run = createQueryDiffRun();
      const onViewOptionsChanged = jest.fn();
      const callbacks: {
        onColumnsRenderModeChanged?: (cols: Record<string, string>) => void;
      } = {};

      // Capture the callback passed to createDataGrid
      mockCreateDataGrid.mockImplementation((_run, options) => {
        callbacks.onColumnsRenderModeChanged =
          options?.onColumnsRenderModeChanged;
        return {
          columns: [{ field: "id", headerName: "id" }],
          rows: [{ id: 1 }],
        };
      });

      renderWithProviders(
        <QueryDiffResultView
          run={run}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Simulate columnsRenderMode change
      callbacks.onColumnsRenderModeChanged?.({ total: "percent" });

      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          columnsRenderMode: { total: "percent" },
        }),
      );
    });
  });
});
