/**
 * @file HistogramDiffResultView.test.tsx
 * @description Baseline tests for HistogramDiffResultView component
 *
 * These tests capture current component behavior before refactoring to factory pattern.
 * Tests verify:
 * - Correct rendering with valid run data
 * - Chart title format (Model {model}.{column_name})
 * - Loading state when base or current is null/undefined
 * - Type guard throws for wrong run types
 * - Ref forwarding to ScreenshotBox (HTMLDivElement ref)
 * - Correct data passed to HistogramChart
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

// Define prop interface for mock
interface MockHistogramChartProps {
  title: string;
  dataType?: string;
  baseData?: { counts: number[] };
  currentData?: { counts: number[] };
  samples?: number;
  min?: number;
  max?: number;
  binEdges?: number[];
}

// Mock HistogramChart component to avoid chart.js complexity
const mockHistogramChart = jest.fn((props: MockHistogramChartProps) => (
  <div data-testid="histogram-chart" data-title={props.title}>
    <span data-testid="chart-title">{props.title}</span>
    <span data-testid="chart-type">{props.dataType}</span>
    <span data-testid="chart-samples">{props.samples}</span>
    <span data-testid="chart-min">{props.min}</span>
    <span data-testid="chart-max">{props.max}</span>
    <span data-testid="chart-bin-edges">{JSON.stringify(props.binEdges)}</span>
    <span data-testid="chart-base-counts">
      {JSON.stringify(props.baseData?.counts)}
    </span>
    <span data-testid="chart-current-counts">
      {JSON.stringify(props.currentData?.counts)}
    </span>
  </div>
));

jest.mock("@datarecce/ui/primitives", () => ({
  HistogramChart: (props: MockHistogramChartProps) => mockHistogramChart(props),
}));

// Mock ScreenshotBox component (both local and packages/ui versions)
jest.mock("@datarecce/ui/components/ui/ScreenshotBox", () => ({
  ScreenshotBox: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotBoxMock,
}));

// Mock ScreenshotDataGrid to avoid ag-grid-react ES module issues
jest.mock("@datarecce/ui/components/data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: () => <div data-testid="empty-rows-renderer">No data</div>,
}));

// Mock useIsDark hook from @datarecce/ui
const mockUseIsDark = jest.fn(() => false);
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import { HistogramDiffResultView } from "@datarecce/ui/components/histogram";
import { screen } from "@testing-library/react";
import React from "react";
import {
  createHistogramDiffRun,
  createRowCountDiffRun,
} from "@/testing-utils/fixtures/runFixtures";
import {
  createBoxRef,
  expectThrowsForWrongType,
  renderWithProviders,
} from "@/testing-utils/resultViewTestUtils";

// ============================================================================
// Test Setup
// ============================================================================

describe("HistogramDiffResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    mockHistogramChart.mockClear();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders chart with data when valid histogram_diff run provided", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // Should render the mock chart component
      const chart = screen.getByTestId("histogram-chart");
      expect(chart).toBeInTheDocument();
    });

    it("renders ScreenshotBox container", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // Should render the screenshot box mock
      const screenshotBox = screen.getByTestId("screenshot-box-mock");
      expect(screenshotBox).toBeInTheDocument();
    });

    it("applies light mode background styling when useIsDark returns false", () => {
      mockUseIsDark.mockReturnValue(false);
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The ScreenshotBox should receive white background
      const screenshotBox = screen.getByTestId("screenshot-box-mock");
      expect(screenshotBox).toHaveAttribute("data-background-color", "white");
    });

    it("applies dark mode background styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The ScreenshotBox should receive dark background
      const screenshotBox = screen.getByTestId("screenshot-box-mock");
      expect(screenshotBox).toHaveAttribute("data-background-color", "#1f2937");
    });
  });

  // ==========================================================================
  // Chart Title Format Tests
  // ==========================================================================

  describe("chart title format", () => {
    it("displays chart title with correct format: Model {model}.{column_name}", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The fixture has params.model = "orders" and params.column_name = "amount"
      const chartTitle = screen.getByTestId("chart-title");
      expect(chartTitle).toHaveTextContent("Model orders.amount");
    });

    it("passes title from params to HistogramChart prop", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // Verify the mock was called with correct title
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Model orders.amount",
        }),
      );
    });
  });

  // ==========================================================================
  // Loading State Tests
  // ==========================================================================

  describe("loading state", () => {
    it('shows "Loading..." when base is null', () => {
      const run = createHistogramDiffRun();
      const originalResult = run.result;
      // Override result to have null base
      // biome-ignore lint/suspicious/noExplicitAny: testing loading state with partial data
      (run as any).result = {
        ...originalResult,
        base: undefined,
        current: originalResult?.current,
        min: 0,
        max: 1000,
        bin_edges: [],
      };

      renderWithProviders(<HistogramDiffResultView run={run} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByTestId("histogram-chart")).not.toBeInTheDocument();
    });

    it('shows "Loading..." when current is null', () => {
      const run = createHistogramDiffRun();
      const originalResult = run.result;
      // Override result to have null current
      // biome-ignore lint/suspicious/noExplicitAny: testing loading state with partial data
      (run as any).result = {
        ...originalResult,
        base: originalResult?.base,
        current: undefined,
        min: 0,
        max: 1000,
        bin_edges: [],
      };

      renderWithProviders(<HistogramDiffResultView run={run} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByTestId("histogram-chart")).not.toBeInTheDocument();
    });

    it('shows "Loading..." when both base and current are null', () => {
      const run = createHistogramDiffRun();
      // Override result to have both null
      // biome-ignore lint/suspicious/noExplicitAny: testing loading state with partial data
      (run as any).result = {
        base: undefined,
        current: undefined,
        min: 0,
        max: 1000,
        bin_edges: [],
      };

      renderWithProviders(<HistogramDiffResultView run={run} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
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
        renderWithProviders(<HistogramDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be histogram_diff");

      consoleSpy.mockRestore();
    });

    it("throws error with correct message format for type guard failure", () => {
      // Use the utility function for consistency
      expectThrowsForWrongType(
        HistogramDiffResultView as React.ComponentType<{ run: unknown }>,
        createRowCountDiffRun(),
        "histogram_diff",
      );
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotBox (HTMLDivElement)", () => {
      const run = createHistogramDiffRun();
      const ref = createBoxRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <HistogramDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected to ScreenshotBox mock
      expect(ref.current).not.toBeNull();
      // ScreenshotBox mock renders with data-testid="screenshot-box-mock"
      expect(ref.current).toHaveAttribute("data-testid", "screenshot-box-mock");
    });

    it("ref is HTMLDivElement (not DataGridHandle)", () => {
      const run = createHistogramDiffRun();
      const ref = createBoxRef();

      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <HistogramDiffResultView run={run} ref={ref as any} />,
      );

      // HTMLDivElement should have standard DOM properties
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  // ==========================================================================
  // Chart Data Tests
  // ==========================================================================

  describe("chart data", () => {
    it("passes correct dataType to HistogramChart", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The fixture has params.column_type = "number" which maps to "numeric"
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: "numeric",
        }),
      );
    });

    it("passes baseData and currentData to HistogramChart", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // Should pass separate baseData and currentData props with counts arrays
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          baseData: expect.objectContaining({
            counts: expect.any(Array),
          }),
          currentData: expect.objectContaining({
            counts: expect.any(Array),
          }),
        }),
      );
    });

    it("passes min and max from result to HistogramChart", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The fixture has result.min = 0, result.max = 1000
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          min: 0,
          max: 1000,
        }),
      );
    });

    it("passes binEdges from result to HistogramChart", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The fixture has bin_edges = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          binEdges: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
        }),
      );
    });

    it("passes samples count from base.total to HistogramChart", () => {
      const run = createHistogramDiffRun();

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // The fixture has base.total = 500
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          samples: 500,
        }),
      );
    });

    it("uses empty array for binEdges when not provided in result", () => {
      const run = createHistogramDiffRun();
      // Override result to not have bin_edges
      if (run.result) {
        const { bin_edges: _removed, ...restResult } = run.result;
        run.result = restResult as typeof run.result;
      }

      renderWithProviders(<HistogramDiffResultView run={run} />);

      // Should use empty array as default
      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          binEdges: [],
        }),
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles custom model and column names in title", () => {
      const run = createHistogramDiffRun();
      // Override params with different model/column
      run.params = {
        ...run.params,
        model: "customers",
        column_name: "age",
        column_type: "integer",
      };

      renderWithProviders(<HistogramDiffResultView run={run} />);

      const chartTitle = screen.getByTestId("chart-title");
      expect(chartTitle).toHaveTextContent("Model customers.age");
    });

    it("uses numeric for dataType when column_type is not provided", () => {
      const run = createHistogramDiffRun();
      // Remove column_type from params
      // biome-ignore lint/suspicious/noExplicitAny: testing edge case
      delete (run.params as any).column_type;

      renderWithProviders(<HistogramDiffResultView run={run} />);

      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: "numeric",
        }),
      );
    });

    it("maps datetime column_type to datetime dataType", () => {
      const run = createHistogramDiffRun();
      // Preserve required params and override column_type
      // biome-ignore lint/suspicious/noExplicitAny: testing edge case
      (run.params as any).column_type = "datetime";

      renderWithProviders(<HistogramDiffResultView run={run} />);

      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: "datetime",
        }),
      );
    });

    it("maps string column_type to string dataType", () => {
      const run = createHistogramDiffRun();
      // Preserve required params and override column_type
      // biome-ignore lint/suspicious/noExplicitAny: testing edge case
      (run.params as any).column_type = "string";

      renderWithProviders(<HistogramDiffResultView run={run} />);

      expect(mockHistogramChart).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: "string",
        }),
      );
    });
  });
});
