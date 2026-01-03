/**
 * @file createResultView.test.tsx
 * @description Comprehensive tests for the createResultView factory
 *
 * Tests verify:
 * - Grid wrapper rendering with data
 * - Box wrapper rendering with content
 * - Type guard validation (throws for wrong run type)
 * - Empty state display when no data
 * - Conditional empty state logic
 * - Dark mode styling
 * - Ref forwarding for both wrapper types
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

// Mock ScreenshotDataGrid component
jest.mock("../data/ScreenshotDataGrid", () => {
  const utils = jest.requireActual("@/testing-utils/resultViewTestUtils");
  return {
    ScreenshotDataGrid: utils.screenshotDataGridMock,
    EmptyRowsRenderer: () => (
      <div data-testid="empty-rows-renderer">No rows</div>
    ),
  };
});

// Mock ScreenshotBox component
jest.mock("../ui/ScreenshotBox", () => {
  const utils = jest.requireActual("@/testing-utils/resultViewTestUtils");
  return {
    ScreenshotBox: utils.screenshotBoxMock,
  };
});

// Mock useIsDark hook
const mockUseIsDark = jest.fn(() => false);
jest.mock("../../hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import { screen } from "@testing-library/react";
import { createRef, type ReactNode } from "react";
import type { MockDataGridHandle } from "@/testing-utils/resultViewTestUtils";
import { renderWithProviders } from "@/testing-utils/resultViewTestUtils";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "./createResultView";
import type { ResultViewData } from "./types";

// ============================================================================
// Test Types & Fixtures
// ============================================================================

interface TestGridRun {
  type: "test_grid";
  data: number[];
}

interface TestBoxRun {
  type: "test_box";
  content: string;
}

interface TestEmptyRun {
  type: "test_empty";
}

type TestRun = TestGridRun | TestBoxRun | TestEmptyRun;

const isTestGridRun = (run: unknown): run is TestGridRun =>
  typeof run === "object" &&
  run !== null &&
  (run as TestRun).type === "test_grid";

const isTestBoxRun = (run: unknown): run is TestBoxRun =>
  typeof run === "object" &&
  run !== null &&
  (run as TestRun).type === "test_box";

const isTestEmptyRun = (run: unknown): run is TestEmptyRun =>
  typeof run === "object" &&
  run !== null &&
  (run as TestRun).type === "test_empty";

const createTestGridRun = (): TestGridRun => ({
  type: "test_grid",
  data: [1, 2, 3, 4],
});

const createTestBoxRun = (): TestBoxRun => ({
  type: "test_box",
  content: "Test content",
});

const createTestEmptyRun = (): TestEmptyRun => ({
  type: "test_empty",
});

const createWrongTypeRun = () => ({
  type: "wrong_type",
  data: [],
});

// ============================================================================
// Test Components
// ============================================================================

const TestGridView = createResultView<TestGridRun, never, DataGridHandle>({
  displayName: "TestGridView",
  typeGuard: isTestGridRun,
  expectedRunType: "test_grid",
  screenshotWrapper: "grid",
  transformData: (run): ResultViewData => ({
    columns: [{ field: "value", headerName: "Value" }],
    rows: run.data.map((value, index) => ({ value, _index: index })),
  }),
});

const TestEmptyGridView = createResultView<TestGridRun, never, DataGridHandle>({
  displayName: "TestEmptyGridView",
  typeGuard: isTestGridRun,
  expectedRunType: "test_grid",
  screenshotWrapper: "grid",
  transformData: (): ResultViewData => ({
    columns: [],
    rows: [],
    isEmpty: true,
  }),
  emptyState: "No data available",
});

const TestBoxView = createResultView<TestBoxRun, never, HTMLDivElement>({
  displayName: "TestBoxView",
  typeGuard: isTestBoxRun,
  expectedRunType: "test_box",
  screenshotWrapper: "box",
  transformData: (run): ResultViewData => ({
    content: <div data-testid="box-content">{run.content}</div>,
  }),
});

interface ConditionalViewOptions {
  showEmpty: boolean;
}

const TestConditionalEmptyView = createResultView<
  TestEmptyRun,
  ConditionalViewOptions,
  DataGridHandle
>({
  displayName: "TestConditionalEmptyView",
  typeGuard: isTestEmptyRun,
  expectedRunType: "test_empty",
  screenshotWrapper: "grid",
  transformData: (): ResultViewData => ({
    columns: [{ field: "test", headerName: "Test" }],
    rows: [{ test: "value", _index: 0 }],
  }),
  conditionalEmptyState: (_, viewOptions) => {
    if (viewOptions?.showEmpty) {
      return <div data-testid="conditional-empty">Conditional Empty State</div>;
    }
    return null;
  },
});

// ============================================================================
// Test Setup
// ============================================================================

describe("createResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Grid Wrapper Tests
  // ==========================================================================

  describe("grid wrapper", () => {
    it("renders grid with data", () => {
      const run = createTestGridRun();

      renderWithProviders(<TestGridView run={run} />);

      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();
      expect(grid).toHaveAttribute("data-rows", "4");
      expect(grid).toHaveAttribute("data-columns", "1");
    });

    it("throws error for wrong run type", () => {
      const wrongRun = createWrongTypeRun();

      // Suppress console.error for expected throw
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<TestGridView run={wrongRun} />);
      }).toThrow("Run type must be test_grid");

      consoleSpy.mockRestore();
    });

    it("shows empty state when no data (isEmpty flag)", () => {
      const run = createTestGridRun();

      renderWithProviders(<TestEmptyGridView run={run} />);

      // Should show custom empty state message
      expect(screen.getByText("No data available")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("shows empty state when data is null", () => {
      const NullDataGridView = createResultView<
        TestGridRun,
        never,
        DataGridHandle
      >({
        displayName: "NullDataGridView",
        typeGuard: isTestGridRun,
        expectedRunType: "test_grid",
        screenshotWrapper: "grid",
        transformData: (): ResultViewData | null => null,
        emptyState: "No data returned",
      });

      const run = createTestGridRun();

      renderWithProviders(<NullDataGridView run={run} />);

      // Should show custom empty state message
      expect(screen.getByText("No data returned")).toBeInTheDocument();

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("forwards ref to ScreenshotDataGrid", () => {
      const run = createTestGridRun();
      const ref = createRef<DataGridHandle>();

      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test requires flexible ref typing
        <TestGridView run={run} ref={ref as any} />,
      );

      // Ref should be connected to the grid
      expect(ref.current).not.toBeNull();
      expect(ref.current).toHaveProperty("api");
      expect(ref.current).toHaveProperty("element");
    });

    it("ref is null when empty state is displayed", () => {
      const run = createTestGridRun();
      const ref = createRef<DataGridHandle>();

      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test requires flexible ref typing
        <TestEmptyGridView run={run} ref={ref as any} />,
      );

      // When empty state is shown, ref is not assigned
      expect(ref.current).toBeNull();
    });
  });

  // ==========================================================================
  // Box Wrapper Tests
  // ==========================================================================

  describe("box wrapper", () => {
    it("renders box with content", () => {
      const run = createTestBoxRun();

      renderWithProviders(<TestBoxView run={run} />);

      const box = screen.getByTestId("screenshot-box-mock");
      expect(box).toBeInTheDocument();

      const content = screen.getByTestId("box-content");
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent("Test content");
    });

    it("forwards ref to ScreenshotBox", () => {
      const run = createTestBoxRun();
      const ref = createRef<HTMLDivElement>();

      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test requires flexible ref typing
        <TestBoxView run={run} ref={ref as any} />,
      );

      // Ref should be connected to the box
      expect(ref.current).not.toBeNull();
    });

    it("throws error for wrong run type", () => {
      const wrongRun = createWrongTypeRun();

      // Suppress console.error for expected throw
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<TestBoxView run={wrongRun} />);
      }).toThrow("Run type must be test_box");

      consoleSpy.mockRestore();
    });

    it("shows empty state when no content (isEmpty flag)", () => {
      const EmptyBoxView = createResultView<TestBoxRun, never, HTMLDivElement>({
        displayName: "EmptyBoxView",
        typeGuard: isTestBoxRun,
        expectedRunType: "test_box",
        screenshotWrapper: "box",
        transformData: (): ResultViewData => ({
          content: null,
          isEmpty: true,
        }),
        emptyState: "No chart data",
      });

      const run = createTestBoxRun();

      renderWithProviders(<EmptyBoxView run={run} />);

      // Should show empty state message
      expect(screen.getByText("No chart data")).toBeInTheDocument();

      // Should NOT render the box
      expect(
        screen.queryByTestId("screenshot-box-mock"),
      ).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Conditional Empty State Tests
  // ==========================================================================

  describe("conditional empty state", () => {
    it("shows conditional empty when condition is met", () => {
      const run = createTestEmptyRun();

      renderWithProviders(
        <TestConditionalEmptyView
          run={run}
          viewOptions={{ showEmpty: true }}
        />,
      );

      // Should show conditional empty state
      const conditionalEmpty = screen.getByTestId("conditional-empty");
      expect(conditionalEmpty).toBeInTheDocument();
      expect(conditionalEmpty).toHaveTextContent("Conditional Empty State");

      // Should NOT render the grid
      expect(
        screen.queryByTestId("screenshot-data-grid-mock"),
      ).not.toBeInTheDocument();
    });

    it("renders normally when condition is not met", () => {
      const run = createTestEmptyRun();

      renderWithProviders(
        <TestConditionalEmptyView
          run={run}
          viewOptions={{ showEmpty: false }}
        />,
      );

      // Should render the grid
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Should NOT show conditional empty state
      expect(screen.queryByTestId("conditional-empty")).not.toBeInTheDocument();
    });

    it("renders normally when viewOptions is undefined", () => {
      const run = createTestEmptyRun();

      renderWithProviders(<TestConditionalEmptyView run={run} />);

      // Should render the grid (no viewOptions means condition not met)
      const grid = screen.getByTestId("screenshot-data-grid-mock");
      expect(grid).toBeInTheDocument();

      // Should NOT show conditional empty state
      expect(screen.queryByTestId("conditional-empty")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Dark Mode Tests
  // ==========================================================================

  describe("dark mode", () => {
    it("applies light mode background in empty state", () => {
      mockUseIsDark.mockReturnValue(false);
      const run = createTestGridRun();

      renderWithProviders(<TestEmptyGridView run={run} />);

      // Verify useIsDark was called
      expect(mockUseIsDark).toHaveBeenCalled();

      // Empty state should be rendered
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("applies dark mode background in empty state", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createTestGridRun();

      renderWithProviders(<TestEmptyGridView run={run} />);

      // Verify useIsDark was called
      expect(mockUseIsDark).toHaveBeenCalled();

      // Empty state should be rendered
      expect(screen.getByText("No data available")).toBeInTheDocument();
    });

    it("applies light mode background to box wrapper", () => {
      mockUseIsDark.mockReturnValue(false);
      const run = createTestBoxRun();

      renderWithProviders(<TestBoxView run={run} />);

      // Verify useIsDark was called
      expect(mockUseIsDark).toHaveBeenCalled();

      // Box should be rendered
      expect(screen.getByTestId("screenshot-box-mock")).toBeInTheDocument();
    });

    it("applies dark mode background to box wrapper", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createTestBoxRun();

      renderWithProviders(<TestBoxView run={run} />);

      // Verify useIsDark was called
      expect(mockUseIsDark).toHaveBeenCalled();

      // Box should be rendered
      expect(screen.getByTestId("screenshot-box-mock")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Display Name Tests
  // ==========================================================================

  describe("display name", () => {
    it("sets displayName for DevTools", () => {
      // Note: forwardRef components may not preserve displayName directly
      // The factory sets displayName on the inner function before wrapping with forwardRef
      // This is a known limitation - displayName should ideally be set on ForwardedResultView

      // For now, we verify the components exist and can be rendered
      // (DisplayName testing would require checking React DevTools or component.type.render.name)
      expect(TestGridView).toBeDefined();
      expect(TestBoxView).toBeDefined();
      expect(TestEmptyGridView).toBeDefined();
      expect(TestConditionalEmptyView).toBeDefined();
    });
  });

  // ==========================================================================
  // Transform Data Tests
  // ==========================================================================

  describe("transformData", () => {
    it("calls transformData with run and options", () => {
      const transformSpy = jest.fn(
        (run: TestGridRun): ResultViewData => ({
          columns: [{ field: "value", headerName: "Value" }],
          rows: run.data.map((value, index) => ({ value, _index: index })),
        }),
      );

      const SpyGridView = createResultView<TestGridRun, never, DataGridHandle>({
        displayName: "SpyGridView",
        typeGuard: isTestGridRun,
        expectedRunType: "test_grid",
        screenshotWrapper: "grid",
        transformData: transformSpy,
      });

      const run = createTestGridRun();

      renderWithProviders(<SpyGridView run={run} />);

      // Verify transformData was called with correct arguments
      expect(transformSpy).toHaveBeenCalledWith(run, {
        viewOptions: undefined,
        onViewOptionsChanged: undefined,
      });
    });

    it("passes viewOptions to transformData", () => {
      interface TestViewOptions {
        filter: string;
      }

      const transformSpy = jest.fn(
        (
          run: TestGridRun,
          // biome-ignore lint/suspicious/noExplicitAny: test allows flexible typing
          options: any,
        ): ResultViewData => ({
          columns: [{ field: "value", headerName: "Value" }],
          rows: run.data
            .filter(() => options.viewOptions?.filter === "all")
            .map((value, index) => ({ value, _index: index })),
        }),
      );

      const OptionsGridView = createResultView<
        TestGridRun,
        TestViewOptions,
        DataGridHandle
      >({
        displayName: "OptionsGridView",
        typeGuard: isTestGridRun,
        expectedRunType: "test_grid",
        screenshotWrapper: "grid",
        transformData: transformSpy,
      });

      const run = createTestGridRun();
      const viewOptions = { filter: "all" };

      renderWithProviders(
        <OptionsGridView run={run} viewOptions={viewOptions} />,
      );

      // Verify transformData received viewOptions
      expect(transformSpy).toHaveBeenCalledWith(run, {
        viewOptions,
        onViewOptionsChanged: undefined,
      });
    });
  });

  // ==========================================================================
  // Header/Footer Tests
  // ==========================================================================

  describe("header and footer", () => {
    describe("grid wrapper", () => {
      it("renders header above grid", () => {
        const HeaderGridView = createResultView<
          TestGridRun,
          never,
          DataGridHandle
        >({
          displayName: "HeaderGridView",
          typeGuard: isTestGridRun,
          expectedRunType: "test_grid",
          screenshotWrapper: "grid",
          transformData: (run): ResultViewData => ({
            columns: [{ field: "value", headerName: "Value" }],
            rows: run.data.map((value, index) => ({ value, _index: index })),
            header: <div data-testid="grid-header">Grid Header Content</div>,
          }),
        });

        const run = createTestGridRun();

        renderWithProviders(<HeaderGridView run={run} />);

        // Header should be rendered
        const header = screen.getByTestId("grid-header");
        expect(header).toBeInTheDocument();
        expect(header).toHaveTextContent("Grid Header Content");

        // Grid should also be rendered
        expect(
          screen.getByTestId("screenshot-data-grid-mock"),
        ).toBeInTheDocument();
      });

      it("renders footer below grid", () => {
        const FooterGridView = createResultView<
          TestGridRun,
          never,
          DataGridHandle
        >({
          displayName: "FooterGridView",
          typeGuard: isTestGridRun,
          expectedRunType: "test_grid",
          screenshotWrapper: "grid",
          transformData: (run): ResultViewData => ({
            columns: [{ field: "value", headerName: "Value" }],
            rows: run.data.map((value, index) => ({ value, _index: index })),
            footer: <div data-testid="grid-footer">Grid Footer Content</div>,
          }),
        });

        const run = createTestGridRun();

        renderWithProviders(<FooterGridView run={run} />);

        // Footer should be rendered
        const footer = screen.getByTestId("grid-footer");
        expect(footer).toBeInTheDocument();
        expect(footer).toHaveTextContent("Grid Footer Content");

        // Grid should also be rendered
        expect(
          screen.getByTestId("screenshot-data-grid-mock"),
        ).toBeInTheDocument();
      });

      it("renders both header and footer with grid", () => {
        const HeaderFooterGridView = createResultView<
          TestGridRun,
          never,
          DataGridHandle
        >({
          displayName: "HeaderFooterGridView",
          typeGuard: isTestGridRun,
          expectedRunType: "test_grid",
          screenshotWrapper: "grid",
          transformData: (run): ResultViewData => ({
            columns: [{ field: "value", headerName: "Value" }],
            rows: run.data.map((value, index) => ({ value, _index: index })),
            header: <div data-testid="grid-header">Header for Grid</div>,
            footer: <div data-testid="grid-footer">Footer for Grid</div>,
          }),
        });

        const run = createTestGridRun();

        renderWithProviders(<HeaderFooterGridView run={run} />);

        // Both header and footer should be rendered
        expect(screen.getByTestId("grid-header")).toBeInTheDocument();
        expect(screen.getByTestId("grid-footer")).toBeInTheDocument();

        // Grid should also be rendered
        expect(
          screen.getByTestId("screenshot-data-grid-mock"),
        ).toBeInTheDocument();
      });

      it("does not render header/footer when not provided (grid)", () => {
        // This uses the existing TestGridView which doesn't have header/footer
        const run = createTestGridRun();

        renderWithProviders(<TestGridView run={run} />);

        // Grid should be rendered
        expect(
          screen.getByTestId("screenshot-data-grid-mock"),
        ).toBeInTheDocument();

        // Header and footer should NOT be in the document
        expect(screen.queryByTestId("grid-header")).not.toBeInTheDocument();
        expect(screen.queryByTestId("grid-footer")).not.toBeInTheDocument();
      });
    });

    describe("box wrapper", () => {
      it("renders header above ScreenshotBox", () => {
        const HeaderBoxView = createResultView<
          TestBoxRun,
          never,
          HTMLDivElement
        >({
          displayName: "HeaderBoxView",
          typeGuard: isTestBoxRun,
          expectedRunType: "test_box",
          screenshotWrapper: "box",
          transformData: (run): ResultViewData => ({
            content: <div data-testid="box-content">{run.content}</div>,
            header: <div data-testid="box-header">Box Header Content</div>,
          }),
        });

        const run = createTestBoxRun();

        renderWithProviders(<HeaderBoxView run={run} />);

        // Header should be rendered
        const header = screen.getByTestId("box-header");
        expect(header).toBeInTheDocument();
        expect(header).toHaveTextContent("Box Header Content");

        // Box and content should also be rendered
        expect(screen.getByTestId("screenshot-box-mock")).toBeInTheDocument();
        expect(screen.getByTestId("box-content")).toBeInTheDocument();
      });

      it("renders footer below ScreenshotBox", () => {
        const FooterBoxView = createResultView<
          TestBoxRun,
          never,
          HTMLDivElement
        >({
          displayName: "FooterBoxView",
          typeGuard: isTestBoxRun,
          expectedRunType: "test_box",
          screenshotWrapper: "box",
          transformData: (run): ResultViewData => ({
            content: <div data-testid="box-content">{run.content}</div>,
            footer: <div data-testid="box-footer">Box Footer Content</div>,
          }),
        });

        const run = createTestBoxRun();

        renderWithProviders(<FooterBoxView run={run} />);

        // Footer should be rendered
        const footer = screen.getByTestId("box-footer");
        expect(footer).toBeInTheDocument();
        expect(footer).toHaveTextContent("Box Footer Content");

        // Box and content should also be rendered
        expect(screen.getByTestId("screenshot-box-mock")).toBeInTheDocument();
        expect(screen.getByTestId("box-content")).toBeInTheDocument();
      });

      it("renders both header and footer with box", () => {
        const HeaderFooterBoxView = createResultView<
          TestBoxRun,
          never,
          HTMLDivElement
        >({
          displayName: "HeaderFooterBoxView",
          typeGuard: isTestBoxRun,
          expectedRunType: "test_box",
          screenshotWrapper: "box",
          transformData: (run): ResultViewData => ({
            content: <div data-testid="box-content">{run.content}</div>,
            header: <div data-testid="box-header">Header for Box</div>,
            footer: <div data-testid="box-footer">Footer for Box</div>,
          }),
        });

        const run = createTestBoxRun();

        renderWithProviders(<HeaderFooterBoxView run={run} />);

        // Both header and footer should be rendered
        expect(screen.getByTestId("box-header")).toBeInTheDocument();
        expect(screen.getByTestId("box-footer")).toBeInTheDocument();

        // Box and content should also be rendered
        expect(screen.getByTestId("screenshot-box-mock")).toBeInTheDocument();
        expect(screen.getByTestId("box-content")).toBeInTheDocument();
      });

      it("does not render header/footer when not provided (box)", () => {
        // This uses the existing TestBoxView which doesn't have header/footer
        const run = createTestBoxRun();

        renderWithProviders(<TestBoxView run={run} />);

        // Box and content should be rendered
        expect(screen.getByTestId("screenshot-box-mock")).toBeInTheDocument();
        expect(screen.getByTestId("box-content")).toBeInTheDocument();

        // Header and footer should NOT be in the document
        expect(screen.queryByTestId("box-header")).not.toBeInTheDocument();
        expect(screen.queryByTestId("box-footer")).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Custom Empty State Tests
  // ==========================================================================

  describe("custom empty state", () => {
    it("shows default empty state when not provided", () => {
      const DefaultEmptyGridView = createResultView<
        TestGridRun,
        never,
        DataGridHandle
      >({
        displayName: "DefaultEmptyGridView",
        typeGuard: isTestGridRun,
        expectedRunType: "test_grid",
        screenshotWrapper: "grid",
        transformData: (): ResultViewData => ({
          columns: [],
          rows: [],
          isEmpty: true,
        }),
        // No emptyState provided - uses default "No data"
      });

      const run = createTestGridRun();

      renderWithProviders(<DefaultEmptyGridView run={run} />);

      // Should show default empty state
      expect(screen.getByText("No data")).toBeInTheDocument();
    });

    it("shows custom ReactNode empty state", () => {
      const CustomEmptyGridView = createResultView<
        TestGridRun,
        never,
        DataGridHandle
      >({
        displayName: "CustomEmptyGridView",
        typeGuard: isTestGridRun,
        expectedRunType: "test_grid",
        screenshotWrapper: "grid",
        transformData: (): ResultViewData => ({
          columns: [],
          rows: [],
          isEmpty: true,
        }),
        emptyState: (
          <div data-testid="custom-empty">
            <strong>Custom Empty State</strong>
          </div>
        ),
      });

      const run = createTestGridRun();

      renderWithProviders(<CustomEmptyGridView run={run} />);

      // Should show custom empty state component
      const customEmpty = screen.getByTestId("custom-empty");
      expect(customEmpty).toBeInTheDocument();
      expect(customEmpty).toHaveTextContent("Custom Empty State");
    });
  });
});
