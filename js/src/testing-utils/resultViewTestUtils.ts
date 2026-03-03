/**
 * @file resultViewTestUtils.ts
 * @description Test utilities for ResultView component testing
 *
 * Provides mocks, rendering helpers, and assertion utilities for testing
 * ResultView components in isolation.
 */

import { theme as lightTheme } from "@datarecce/ui/theme";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { type Mock, vi } from "vitest";

// ============================================================================
// AG Grid Mock
// ============================================================================

/**
 * Mock for AG Grid Community to avoid React 19 compatibility issues
 * and ES module parsing errors in Vitest
 *
 * Use this in test files:
 * ```ts
 * vi.mock("ag-grid-community", () => agGridMock);
 * ```
 */
export const agGridMock = {
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
  ClientSideRowModelModule: {},
  AllCommunityModule: {},
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
};

/**
 * Mock for @ag-grid-community/core
 * Some imports come from the scoped package
 */
export const agGridCoreMock = {
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
};

/**
 * Mock for ag-grid-react to avoid rendering issues in tests
 */
export const agGridReactMock = {
  AgGridReact: vi.fn().mockImplementation(({ children }) => {
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
 * Props that ScreenshotBox accepts but should NOT be passed to DOM elements.
 * These are filtered out to avoid React warnings about invalid DOM attributes.
 *
 * Keep this list updated as ScreenshotBox props change.
 */
const SCREENSHOT_BOX_NON_DOM_PROPS = [
  // ScreenshotBox-specific props
  "backgroundColor",
  "blockSize",
  // MUI Box props that don't map to DOM attributes
  "sx",
  "component",
  // Common props that might be passed but aren't valid DOM attrs
  "height",
  "width",
  "minHeight",
  "maxHeight",
  "minWidth",
  "maxWidth",
  "padding",
  "margin",
  "overflow",
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
] as const;

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
>(function MockScreenshotBox({ children, ...allProps }, ref) {
  // Filter out non-DOM props to avoid React warnings
  const domProps: Record<string, unknown> = {};
  const filteredProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(allProps)) {
    if (
      SCREENSHOT_BOX_NON_DOM_PROPS.includes(
        key as (typeof SCREENSHOT_BOX_NON_DOM_PROPS)[number],
      )
    ) {
      filteredProps[key] = value;
    } else {
      domProps[key] = value;
    }
  }

  // Store filtered props as data attributes for test assertions
  // Build props object to avoid TypeScript spread issues with conditional objects
  const elementProps: Record<string, unknown> = {
    ref,
    "data-testid": "screenshot-box-mock",
    ...domProps,
  };

  // Add data attributes for testing (use data-* for React compatibility)
  if (filteredProps.backgroundColor) {
    elementProps["data-background-color"] = filteredProps.backgroundColor;
  }
  if (filteredProps.height) {
    elementProps["data-height"] = filteredProps.height;
  }

  return React.createElement("div", elementProps, children as ReactNode);
});

// ============================================================================
// ScreenshotDataGrid Mock
// ============================================================================

/**
 * Props that ScreenshotDataGrid accepts but should NOT be passed to DOM elements.
 * These are filtered out to avoid React warnings about invalid DOM attributes.
 *
 * Keep this list updated as ScreenshotDataGrid/AG Grid props change.
 */
const SCREENSHOT_DATA_GRID_NON_DOM_PROPS = [
  // ScreenshotDataGrid-specific props
  "columns",
  "rows",
  "renderers",
  // AG Grid props
  "defaultColumnOptions",
  "columnDefs",
  "rowData",
  "getRowId",
  "rowHeight",
  "headerHeight",
  "defaultColDef",
  "domLayout",
  "suppressHorizontalScroll",
  "suppressVerticalScroll",
  "animateRows",
  "pagination",
  "paginationPageSize",
  "rowSelection",
  "suppressRowClickSelection",
  "suppressCellSelection",
  "enableCellTextSelection",
  "ensureDomOrder",
  "getRowClass",
  "getRowStyle",
  "rowBuffer",
  "suppressMovableColumns",
  "suppressColumnVirtualisation",
  "suppressRowVirtualisation",
  "theme",
  // Style props that aren't valid DOM attrs
  "rowClassName",
  "containerClassName",
  // Common style props (same as ScreenshotBox)
  "sx",
  "component",
] as const;

/**
 * Mock DataGridHandle for ref testing
 * Matches the real DataGridHandle interface from @datarecce/ui
 */
export interface MockDataGridHandle {
  api: unknown | null;
  element: HTMLElement | null;
  // Legacy methods (kept for backward compatibility with existing tests)
  getScreenshotElement?: Mock<() => HTMLDivElement | null>;
  exportToClipboard?: Mock<() => Promise<void>>;
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
>(function MockScreenshotDataGrid(
  { columns, rows, children, ...allProps },
  ref,
) {
  // Expose mock methods via ref (matching DataGridHandle interface)
  React.useImperativeHandle(ref, () => ({
    api: null,
    element: null,
    // Legacy methods for backward compatibility
    getScreenshotElement: vi.fn(() => null),
    exportToClipboard: vi.fn(() => Promise.resolve()),
  }));

  // Filter out non-DOM props to avoid React warnings
  const domProps: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(allProps)) {
    // Filter out known non-DOM props and any AG Grid event handlers (on*)
    const isNonDomProp = SCREENSHOT_DATA_GRID_NON_DOM_PROPS.includes(
      key as (typeof SCREENSHOT_DATA_GRID_NON_DOM_PROPS)[number],
    );
    const isEventHandler = key.startsWith("on") && typeof value === "function";

    if (!isNonDomProp && !isEventHandler) {
      domProps[key] = value;
    }
  }

  const columnCount = Array.isArray(columns) ? columns.length : 0;
  const rowCount = Array.isArray(rows) ? rows.length : 0;

  // Build props object to avoid TypeScript spread issues
  const elementProps: Record<string, unknown> = {
    "data-testid": "screenshot-data-grid-mock",
    "data-columns": JSON.stringify(columnCount),
    "data-rows": JSON.stringify(rowCount),
    ...domProps,
  };

  const content: ReactNode =
    (children as ReactNode) ??
    `Mock Grid: ${rowCount} rows, ${columnCount} columns`;
  return React.createElement("div", elementProps, content);
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
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

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
export const useIsDarkMock = vi.fn(() => false);

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
 * jest.mock("@datarecce/ui/hooks", () => ({ useIsDark: mocks.useIsDark }));
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
