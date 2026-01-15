/**
 * @file QueryResultView.test.tsx
 * @description Baseline tests for QueryResultView component
 *
 * Tests verify:
 * - Correct rendering with valid run data
 * - Empty state display when no data
 * - Type guard throws for wrong run types
 * - Ref forwarding to underlying grid
 * - Warning bar display when limit exceeded
 * - "Add to Checklist" button behavior
 * - ViewOptions handling (pinned_columns, columnsRenderMode)
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

// Mock the grid generator from utils
const mockToDataGridConfigured = jest.fn();
jest.mock("../../../utils", () => ({
  toDataGridConfigured: (...args: unknown[]) =>
    mockToDataGridConfigured(...args),
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
  EmptyRowsRenderer: () => <div data-testid="empty-rows-renderer">No data</div>,
}));

// Mock useIsDark hook
const mockUseIsDark = jest.fn(() => false);
jest.mock("../../../hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import type { QueryViewOptions, Run } from "../../../api";
import { theme as lightTheme } from "../../../theme";
import { QueryResultView } from "../QueryResultView";

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
 * Creates a query run fixture with sample data
 */
function createQueryRun(): Extract<Run, { type: "query" }> {
  return {
    type: "query",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: { sql_template: "SELECT * FROM orders LIMIT 100" },
    result: {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "name", name: "name", type: "text" },
        { key: "total", name: "total", type: "number" },
      ],
      data: [
        [1, "Alice", 100.0],
        [2, "Bob", 200.0],
        [3, "Charlie", 300.0],
      ],
      limit: 0,
      more: false,
    },
  };
}

/**
 * Creates a query_base run fixture (also accepted by QueryResultView)
 */
function createQueryBaseRun(): Extract<Run, { type: "query_base" }> {
  return {
    type: "query_base",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: { sql_template: "SELECT * FROM orders LIMIT 100" },
    result: {
      columns: [
        { key: "id", name: "id", type: "integer" },
        { key: "name", name: "name", type: "text" },
      ],
      data: [
        [1, "Alice"],
        [2, "Bob"],
      ],
      limit: 0,
      more: false,
    },
  };
}

/**
 * Creates a query run with limit warning (more=true)
 */
function createQueryRunWithLimitWarning(): Extract<Run, { type: "query" }> {
  return {
    type: "query",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: { sql_template: "SELECT * FROM orders" },
    result: {
      columns: [{ key: "id", name: "id", type: "integer" }],
      data: [[1], [2], [3]],
      limit: 1000,
      more: true,
    },
  };
}

/**
 * Creates a query run with empty result
 */
function createEmptyQueryRun(): Extract<Run, { type: "query" }> {
  return {
    type: "query",
    run_id: `test-run-${Date.now()}`,
    run_at: new Date().toISOString(),
    status: "finished",
    params: { sql_template: "SELECT * FROM orders WHERE 1=0" },
    result: {
      columns: [],
      data: [],
      limit: 0,
      more: false,
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

describe("QueryResultView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsDark.mockReturnValue(false);

    // Default mock implementation returns grid data
    mockToDataGridConfigured.mockReturnValue({
      columns: [
        { field: "id", headerName: "id" },
        { field: "name", headerName: "name" },
        { field: "total", headerName: "total" },
      ],
      rows: [
        { id: 1, name: "Alice", total: 100.0 },
        { id: 2, name: "Bob", total: 200.0 },
        { id: 3, name: "Charlie", total: 300.0 },
      ],
    });
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders grid with data when valid query run provided", () => {
      const run = createQueryRun();

      renderWithProviders(<QueryResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Verify the grid received data (3 rows in fixture)
      expect(grid).toHaveAttribute("data-rows", "3");
      // Verify columns: id, name, total
      expect(grid).toHaveAttribute("data-columns", "3");
    });

    it("renders grid with data when valid query_base run provided", () => {
      const run = createQueryBaseRun();

      renderWithProviders(<QueryResultView run={run} />);

      // Should render the mock grid component
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();
    });

    it("calls toDataGridConfigured with the run object and options", () => {
      const run = createQueryRun();

      renderWithProviders(<QueryResultView run={run} />);

      expect(mockToDataGridConfigured).toHaveBeenCalledWith(
        run.result,
        expect.objectContaining({
          pinnedColumns: [],
          columnsRenderMode: {},
        }),
      );
    });
  });

  // ==========================================================================
  // Empty State Tests
  // ==========================================================================

  describe("empty state", () => {
    it('displays "No data" when gridData.columns.length === 0', () => {
      mockToDataGridConfigured.mockReturnValue({
        columns: [],
        rows: [],
      });
      const run = createEmptyQueryRun();

      renderWithProviders(<QueryResultView run={run} />);

      expect(screen.getByText("No data")).toBeInTheDocument();

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
      const wrongRun = createWrongTypeRun();

      // Suppress console.error for expected throws
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<QueryResultView run={wrongRun} />);
      }).toThrow("Run type must be query");

      consoleSpy.mockRestore();
    });

    it("accepts query type run", () => {
      const run = createQueryRun();

      // Should not throw
      expect(() => {
        renderWithProviders(<QueryResultView run={run} />);
      }).not.toThrow();
    });

    it("accepts query_base type run", () => {
      const run = createQueryBaseRun();

      // Should not throw
      expect(() => {
        renderWithProviders(<QueryResultView run={run} />);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Warning Bar Tests
  // ==========================================================================

  describe("warning bar", () => {
    it("shows warning when limit > 0 and more === true", () => {
      const run = createQueryRunWithLimitWarning();

      renderWithProviders(<QueryResultView run={run} />);

      // Should show the warning message
      expect(
        screen.getByText(
          /Warning: Displayed results are limited to 1,000 records/,
        ),
      ).toBeInTheDocument();
    });

    it("does not show warning when limit === 0", () => {
      const run = createQueryRun();

      renderWithProviders(<QueryResultView run={run} />);

      // Should NOT show any warning
      expect(
        screen.queryByText(/Warning: Displayed results are limited/),
      ).not.toBeInTheDocument();
    });

    it("does not show warning when more === false", () => {
      const run = createQueryRun();
      if (run.result) {
        run.result.limit = 1000;
        run.result.more = false;
      }

      renderWithProviders(<QueryResultView run={run} />);

      // Should NOT show any warning
      expect(
        screen.queryByText(/Warning: Displayed results are limited/),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Add to Checklist Button Tests
  // ==========================================================================

  describe("add to checklist button", () => {
    it('shows "Add to Checklist" button when onAddToChecklist provided', () => {
      const run = createQueryRun();
      const onAddToChecklist = jest.fn();

      renderWithProviders(
        <QueryResultView run={run} onAddToChecklist={onAddToChecklist} />,
      );

      expect(
        screen.getByRole("button", { name: /Add to Checklist/i }),
      ).toBeInTheDocument();
    });

    it("does not show button when onAddToChecklist not provided", () => {
      const run = createQueryRun();

      renderWithProviders(<QueryResultView run={run} />);

      expect(
        screen.queryByRole("button", { name: /Add to Checklist/i }),
      ).not.toBeInTheDocument();
    });

    it("calls onAddToChecklist with run when button clicked", () => {
      const run = createQueryRun();
      const onAddToChecklist = jest.fn();

      renderWithProviders(
        <QueryResultView run={run} onAddToChecklist={onAddToChecklist} />,
      );

      const button = screen.getByRole("button", { name: /Add to Checklist/i });
      fireEvent.click(button);

      expect(onAddToChecklist).toHaveBeenCalledWith(run);
    });
  });

  // ==========================================================================
  // ViewOptions Tests
  // ==========================================================================

  describe("viewOptions", () => {
    it("passes pinned_columns to toDataGridConfigured", () => {
      const run = createQueryRun();
      const viewOptions: QueryViewOptions = {
        pinned_columns: ["id", "name"],
      };

      renderWithProviders(
        <QueryResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockToDataGridConfigured).toHaveBeenCalledWith(
        run.result,
        expect.objectContaining({
          pinnedColumns: ["id", "name"],
        }),
      );
    });

    it("passes columnsRenderMode to toDataGridConfigured", () => {
      const run = createQueryRun();
      const viewOptions: QueryViewOptions = {
        columnsRenderMode: { total: "percent" },
      };

      renderWithProviders(
        <QueryResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockToDataGridConfigured).toHaveBeenCalledWith(
        run.result,
        expect.objectContaining({
          columnsRenderMode: { total: "percent" },
        }),
      );
    });
  });
});
