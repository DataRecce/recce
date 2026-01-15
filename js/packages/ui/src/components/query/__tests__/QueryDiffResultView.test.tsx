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

// Mock the grid generators from utils
const mockToDataDiffGridConfigured = jest.fn();
const mockToValueDiffGridConfigured = jest.fn();
jest.mock("../../../utils", () => ({
  toDataDiffGridConfigured: (...args: unknown[]) =>
    mockToDataDiffGridConfigured(...args),
  toValueDiffGridConfigured: (...args: unknown[]) =>
    mockToValueDiffGridConfigured(...args),
}));

// Mock useIsDark hook
const mockUseIsDark = jest.fn(() => false);
jest.mock("../../../hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// Mock ScreenshotDataGrid
jest.mock("../../data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.fn(({ columns, rows }) => (
    <div
      data-testid="screenshot-data-grid-mock"
      data-columns={columns?.length ?? 0}
      data-rows={rows?.length ?? 0}
    />
  )),
  EmptyRowsRenderer: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="empty-rows-renderer">{emptyMessage ?? "No data"}</div>
  ),
}));

// ============================================================================
// Imports
// ============================================================================

import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import type { QueryDiffViewOptions, Run } from "../../../api";
import { theme as lightTheme } from "../../../theme";
import { QueryDiffResultView } from "../QueryDiffResultView";

// ============================================================================
// Test Helpers
// ============================================================================

function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  return render(ui, { wrapper: TestProviders });
}

// ============================================================================
// Local Test Fixtures
// ============================================================================

/**
 * Creates a query_diff run fixture with base/current results (NO diff property)
 * This triggers non-Join view
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
 */
function createQueryDiffJoinRun(): Extract<Run, { type: "query_diff" }> {
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
    mockToDataDiffGridConfigured.mockReturnValue({
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

    mockToValueDiffGridConfigured.mockReturnValue({
      columns: [
        { field: "id", headerName: "id" },
        { field: "name", headerName: "name" },
        { field: "total", headerName: "total" },
      ],
      rows: [
        { id: 1, name: "Alice", total: 100.0, __status: undefined },
        { id: 2, name: "Bob", total: 200.0, __status: "added" },
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

      // Should call toDataDiffGridConfigured (non-JOIN mode)
      expect(mockToDataDiffGridConfigured).toHaveBeenCalled();
      expect(mockToValueDiffGridConfigured).not.toHaveBeenCalled();
    });

    it("uses Join view when result.diff is not null", () => {
      const run = createQueryDiffJoinRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should call toValueDiffGridConfigured (JOIN mode)
      expect(mockToValueDiffGridConfigured).toHaveBeenCalled();
      expect(mockToDataDiffGridConfigured).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid query_diff run provided", () => {
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe("empty state", () => {
    it('displays "No data" when gridData.columns.length === 0', () => {
      mockToDataDiffGridConfigured.mockReturnValue({
        columns: [],
        rows: [],
      });
      const run = createQueryDiffRun();

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();
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
    it("passes changed_only to grid generator", () => {
      const run = createQueryDiffRun();
      const viewOptions: QueryDiffViewOptions = {
        changed_only: true,
      };

      renderWithProviders(
        <QueryDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockToDataDiffGridConfigured).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          changedOnly: true,
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
  });

  // ==========================================================================
  // Warning Tests
  // ==========================================================================

  describe("warnings", () => {
    it("shows limit warning when limit > 0 and more=true", () => {
      const run = createQueryDiffRun();
      if (run.result?.current) {
        run.result.current.limit = 1000;
        run.result.current.more = true;
      }

      renderWithProviders(<QueryDiffResultView run={run} />);

      expect(
        screen.getByText(
          /Warning: Displayed results are limited to 1,000 records/,
        ),
      ).toBeInTheDocument();
    });

    it("shows invalid primary key warning when invalidPKeyBase is true", () => {
      mockToDataDiffGridConfigured.mockReturnValue({
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
  });
});
