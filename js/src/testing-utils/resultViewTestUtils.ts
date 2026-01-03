/**
 * @file resultViewTestUtils.ts
 * @description Test utilities for ResultView component testing
 *
 * Provides mocks, rendering helpers, and assertion utilities for testing
 * ResultView components in isolation.
 */

import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { lightTheme } from "@/components/ui/mui-theme";

// ============================================================================
// AG Grid Mock
// ============================================================================

/**
 * Mock for AG Grid Community to avoid React 19 compatibility issues
 * and ES module parsing errors in Jest
 *
 * Use this in test files:
 * ```ts
 * jest.mock("ag-grid-community", () => agGridMock);
 * ```
 */
export const agGridMock = {
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
  ClientSideRowModelModule: {},
  AllCommunityModule: {},
  themeQuartz: {},
};

/**
 * Mock for @ag-grid-community/core
 * Some imports come from the scoped package
 */
export const agGridCoreMock = {
  ModuleRegistry: {
    registerModules: jest.fn(),
  },
};

/**
 * Mock for ag-grid-react to avoid rendering issues in tests
 */
export const agGridReactMock = {
  AgGridReact: jest.fn().mockImplementation(({ children }) => {
    return React.createElement(
      "div",
      { "data-testid": "ag-grid-mock" },
      children,
    );
  }),
};

// ============================================================================
// ScreenshotBox Mock
// ============================================================================

/**
 * Mock for ScreenshotBox component
 * Renders as a simple div with forwarded ref
 *
 * Use this in test files:
 * ```ts
 * jest.mock("@datarecce/ui/primitives", () => ({
 *   ...jest.requireActual("@datarecce/ui/primitives"),
 *   ScreenshotBox: screenshotBoxMock,
 * }));
 * ```
 */
export const screenshotBoxMock = React.forwardRef<
  HTMLDivElement,
  { children?: ReactNode; [key: string]: unknown }
>(function MockScreenshotBox({ children, ...props }, ref) {
  return React.createElement(
    "div",
    { ref, "data-testid": "screenshot-box-mock", ...props },
    children as ReactNode,
  );
});

// ============================================================================
// ScreenshotDataGrid Mock
// ============================================================================

/**
 * Mock DataGridHandle for ref testing
 */
export interface MockDataGridHandle {
  getScreenshotElement: jest.Mock<HTMLDivElement | null>;
  exportToClipboard: jest.Mock<Promise<void>>;
}

/**
 * Mock for ScreenshotDataGrid component
 * Renders as a simple div with data attributes for testing
 */
export const screenshotDataGridMock = React.forwardRef<
  MockDataGridHandle,
  {
    columns?: unknown[];
    rows?: unknown[];
    children?: ReactNode;
    [key: string]: unknown;
  }
>(function MockScreenshotDataGrid({ columns, rows, ...props }, ref) {
  // Expose mock methods via ref
  React.useImperativeHandle(ref, () => ({
    getScreenshotElement: jest.fn(() => null),
    exportToClipboard: jest.fn(() => Promise.resolve()),
  }));

  const columnCount = Array.isArray(columns) ? columns.length : 0;
  const rowCount = Array.isArray(rows) ? rows.length : 0;

  return React.createElement(
    "div",
    {
      "data-testid": "screenshot-data-grid-mock",
      "data-columns": JSON.stringify(columnCount),
      "data-rows": JSON.stringify(rowCount),
      ...props,
    },
    `Mock Grid: ${rowCount} rows, ${columnCount} columns`,
  );
});

// ============================================================================
// Test Providers
// ============================================================================

/**
 * Create a fresh QueryClient for each test
 * Prevents state pollution between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });
}

/**
 * Test wrapper providing all necessary context providers
 */
export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();

  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(ThemeProvider, { theme: lightTheme }, children),
  );
}

// ============================================================================
// Render Utilities
// ============================================================================

/**
 * Custom render function that wraps component with test providers
 * Use this instead of render() from @testing-library/react
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

/**
 * Render a ResultView component with all necessary providers
 * Convenience wrapper for ResultView-specific tests
 */
export function renderResultView(
  ResultViewComponent: React.ComponentType<{
    run: unknown;
    [key: string]: unknown;
  }>,
  run: unknown,
  additionalProps: Record<string, unknown> = {},
) {
  return renderWithProviders(
    React.createElement(ResultViewComponent, { run, ...additionalProps }),
  );
}

// ============================================================================
// Ref Utilities
// ============================================================================

/**
 * Create a mock DataGridHandle ref for testing ref forwarding
 */
export function createGridRef(): React.RefObject<MockDataGridHandle | null> {
  return React.createRef<MockDataGridHandle>();
}

/**
 * Create a mock HTMLDivElement ref for testing ref forwarding
 * Used by components like TopKDiffResultView and HistogramDiffResultView
 */
export function createBoxRef(): React.RefObject<HTMLDivElement | null> {
  return React.createRef<HTMLDivElement>();
}

// ============================================================================
// Assertion Utilities
// ============================================================================

/**
 * Test that a ResultView throws an error when given the wrong run type
 *
 * @example
 * ```ts
 * test("throws for wrong run type", () => {
 *   expectThrowsForWrongType(
 *     RowCountDiffResultView,
 *     createValueDiffRun(),
 *     "row_count_diff"
 *   );
 * });
 * ```
 */
export function expectThrowsForWrongType(
  ResultViewComponent: React.ComponentType<{ run: unknown }>,
  wrongTypeRun: unknown,
  expectedType: string,
) {
  // Suppress console.error for expected throws
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
  const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  expect(() => {
    renderWithProviders(
      React.createElement(ResultViewComponent, { run: wrongTypeRun }),
    );
  }).toThrow();

  consoleSpy.mockRestore();
}

/**
 * Test that a ref is properly forwarded to the component
 * Works with both DataGridHandle and HTMLDivElement refs
 */
export function expectRefForwarded(
  ref: React.RefObject<unknown>,
  expectedTestId?: string,
) {
  expect(ref.current).not.toBeNull();
  if (expectedTestId) {
    // For mock components, check the testid
    const element = ref.current as
      | { getScreenshotElement?: unknown }
      | HTMLElement;
    if ("getScreenshotElement" in element) {
      // It's a DataGridHandle mock
      expect(typeof element.getScreenshotElement).toBe("function");
    } else if (element instanceof HTMLElement) {
      expect(element.getAttribute("data-testid")).toBe(expectedTestId);
    }
  }
}

// ============================================================================
// Hook Mocks
// ============================================================================

/**
 * Mock for useIsDark hook
 * Returns false (light mode) by default
 */
export const useIsDarkMock = jest.fn(() => false);

/**
 * Set dark mode for tests
 */
export function setDarkMode(isDark: boolean) {
  useIsDarkMock.mockReturnValue(isDark);
}

/**
 * Reset useIsDark mock to default (light mode)
 */
export function resetDarkModeMock() {
  useIsDarkMock.mockReturnValue(false);
}

// ============================================================================
// Common Mock Setup Functions
// ============================================================================

/**
 * Setup all common mocks for ResultView tests
 * Call this in beforeEach or at the top of your test file
 *
 * @example
 * ```ts
 * // In your test file
 * setupResultViewMocks();
 *
 * // Or in beforeEach
 * beforeEach(() => {
 *   setupResultViewMocks();
 * });
 * ```
 */
export function setupResultViewMocks() {
  // Reset dark mode to light
  resetDarkModeMock();
}

/**
 * Common Jest mock setup that should be called at module level
 * Returns an object with all the mocks for use in jest.mock calls
 *
 * @example
 * ```ts
 * // At the top of your test file, before imports
 * const mocks = getResultViewMockConfig();
 * jest.mock("ag-grid-community", () => mocks.agGrid);
 * jest.mock("@/lib/hooks/useIsDark", () => ({ useIsDark: mocks.useIsDark }));
 * ```
 */
export function getResultViewMockConfig() {
  return {
    agGrid: agGridMock,
    agGridCore: agGridCoreMock,
    agGridReact: agGridReactMock,
    screenshotBox: screenshotBoxMock,
    screenshotDataGrid: screenshotDataGridMock,
    useIsDark: useIsDarkMock,
  };
}
