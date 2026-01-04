/**
 * @file TopKDiffResultView.test.tsx
 * @description Tests for TopKDiffResultView component using createResultView factory.
 *
 * Tests verify:
 * - Correct rendering with valid run data
 * - Title format (Model {params.model}.{params.column_name})
 * - View toggle visibility based on item count (>10 items)
 * - Toggle state changes via viewOptions/onViewOptionsChanged
 * - Toggle text changes between "View More Items" and "View Only Top-10"
 * - Type guard throws for wrong run types
 * - Ref forwarding to ScreenshotBox (HTMLDivElement ref)
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

// Mock ag-grid-react to avoid the extends value error
jest.mock("ag-grid-react", () => ({
  AgGridReact: jest.fn(() => null),
}));

// Mock packages/ui ScreenshotDataGrid (used by createResultView factory)
jest.mock("@datarecce/ui/components/data/ScreenshotDataGrid", () => ({
  ScreenshotDataGrid: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotDataGridMock,
  EmptyRowsRenderer: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div data-testid="empty-rows-renderer">{emptyMessage ?? "No rows"}</div>
  ),
}));

// Mock TopKSummaryBarChart component to avoid chart.js complexity
const mockTopKSummaryBarChart = jest.fn(({ isDisplayTopTen }) => (
  <div data-testid="topk-chart">
    <span data-testid="display-mode">{isDisplayTopTen ? "top10" : "all"}</span>
  </div>
));

jest.mock("../charts/TopKSummaryList", () => ({
  TopKSummaryBarChart: (props: { isDisplayTopTen: boolean }) =>
    mockTopKSummaryBarChart(props),
}));

// Mock useIsDark hook - declare first since it's used by multiple mocks
const mockUseIsDark = jest.fn(() => false);

// Mock ScreenshotBox with our test utility mock
jest.mock("@datarecce/ui/primitives", () => ({
  ScreenshotBox: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotBoxMock,
}));

// Mock packages/ui ScreenshotBox (used by createResultView factory)
jest.mock("@datarecce/ui/components/ui/ScreenshotBox", () => ({
  ScreenshotBox: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotBoxMock,
}));

// Mock useIsDark hook from @datarecce/ui
jest.mock("@datarecce/ui/hooks", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import { fireEvent, screen } from "@testing-library/react";
import React from "react";
import type { TopKDiffResult, TopKViewOptions } from "@/lib/api/profile";
import {
  createRowCountDiffRun,
  createTopKDiffRun,
} from "@/testing-utils/fixtures/runFixtures";
import {
  createBoxRef,
  renderWithProviders,
} from "@/testing-utils/resultViewTestUtils";
import { TopKDiffResultView } from "./TopKDiffResultView";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a run with more than 10 items to trigger the view toggle
 */
function createRunWith15Items() {
  const baseRun = createTopKDiffRun();
  const result: TopKDiffResult = {
    base: {
      values: Array(15)
        .fill(null)
        .map((_, i) => `item_${i}`),
      counts: Array(15).fill(10),
      valids: 880,
    },
    current: {
      values: Array(15)
        .fill(null)
        .map((_, i) => `item_${i}`),
      counts: Array(15).fill(10),
      valids: 900,
    },
  };

  return {
    ...baseRun,
    result,
  };
}

/**
 * Create a run with exactly 10 items (no toggle should appear)
 */
function createRunWith10Items() {
  const baseRun = createTopKDiffRun();
  const result: TopKDiffResult = {
    base: {
      values: Array(10)
        .fill(null)
        .map((_, i) => `item_${i}`),
      counts: Array(10).fill(10),
      valids: 880,
    },
    current: {
      values: Array(10)
        .fill(null)
        .map((_, i) => `item_${i}`),
      counts: Array(10).fill(10),
      valids: 900,
    },
  };

  return {
    ...baseRun,
    result,
  };
}

// ============================================================================
// Test Setup
// ============================================================================

describe("TopKDiffResultView", () => {
  beforeEach(() => {
    mockUseIsDark.mockReturnValue(false);
    mockTopKSummaryBarChart.mockClear();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Rendering Tests
  // ==========================================================================

  describe("rendering", () => {
    it("renders chart with data when valid top_k_diff run provided", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Should render the mock chart component
      const chart = screen.getByTestId("topk-chart");
      expect(chart).toBeInTheDocument();
    });

    it("renders ScreenshotBox container", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Should render the screenshot box mock
      const screenshotBox = screen.getByTestId("screenshot-box-mock");
      expect(screenshotBox).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Title Format Tests
  // ==========================================================================

  describe("title format", () => {
    it("displays title with correct format: Model {model}.{column_name}", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // The fixture has params.model = "orders" and params.column_name = "status"
      expect(screen.getByText("Model orders.status")).toBeInTheDocument();
    });

    it("handles custom model and column names in title", () => {
      const run = createTopKDiffRun();
      // Override params with different model/column (preserve k from original)
      const originalK = run.params?.k ?? 10;
      run.params = {
        model: "customers",
        column_name: "region",
        k: originalK,
      };

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.getByText("Model customers.region")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // View Toggle Visibility Tests
  // ==========================================================================

  describe("view toggle visibility", () => {
    it('shows "View More Items" link when base has more than 10 items', () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.getByText("View More Items")).toBeInTheDocument();
    });

    it('shows "View More Items" link when current has more than 10 items', () => {
      const baseRun = createTopKDiffRun();
      const result: TopKDiffResult = {
        base: {
          values: Array(5)
            .fill(null)
            .map((_, i) => `item_${i}`),
          counts: Array(5).fill(10),
          valids: 880,
        },
        current: {
          values: Array(15)
            .fill(null)
            .map((_, i) => `item_${i}`),
          counts: Array(15).fill(10),
          valids: 900,
        },
      };
      const run = { ...baseRun, result };

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.getByText("View More Items")).toBeInTheDocument();
    });

    it("does not show toggle link when both base and current have 10 or fewer items", () => {
      const run = createRunWith10Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.queryByText("View More Items")).not.toBeInTheDocument();
      expect(screen.queryByText("View Only Top-10")).not.toBeInTheDocument();
    });

    it("does not show toggle link when using default fixture (5 items)", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Default fixture has 5 items in both base and current
      expect(screen.queryByText("View More Items")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Toggle State via ViewOptions Tests
  // ==========================================================================

  describe("toggle state via viewOptions", () => {
    it("starts with isDisplayTopTen=true when show_all is undefined", () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Verify initial state via mock prop
      expect(mockTopKSummaryBarChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDisplayTopTen: true,
        }),
      );
    });

    it("starts with isDisplayTopTen=true when show_all=false", () => {
      const run = createRunWith15Items();
      const viewOptions: TopKViewOptions = { show_all: false };

      renderWithProviders(
        <TopKDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockTopKSummaryBarChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDisplayTopTen: true,
        }),
      );
    });

    it("starts with isDisplayTopTen=false when show_all=true", () => {
      const run = createRunWith15Items();
      const viewOptions: TopKViewOptions = { show_all: true };

      renderWithProviders(
        <TopKDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(mockTopKSummaryBarChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDisplayTopTen: false,
        }),
      );
    });

    it("calls onViewOptionsChanged with show_all=true when clicking View More Items", () => {
      const run = createRunWith15Items();
      const onViewOptionsChanged = jest.fn();

      renderWithProviders(
        <TopKDiffResultView
          run={run}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Click the toggle
      fireEvent.click(screen.getByText("View More Items"));

      // Verify onViewOptionsChanged was called with show_all=true
      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          show_all: true,
        }),
      );
    });

    it("calls onViewOptionsChanged with show_all=false when clicking View Only Top-10", () => {
      const run = createRunWith15Items();
      const viewOptions: TopKViewOptions = { show_all: true };
      const onViewOptionsChanged = jest.fn();

      renderWithProviders(
        <TopKDiffResultView
          run={run}
          viewOptions={viewOptions}
          onViewOptionsChanged={onViewOptionsChanged}
        />,
      );

      // Click to show top-10 again
      fireEvent.click(screen.getByText("View Only Top-10"));

      // Verify onViewOptionsChanged was called with show_all=false
      expect(onViewOptionsChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          show_all: false,
        }),
      );
    });
  });

  // ==========================================================================
  // Toggle Text Change Tests
  // ==========================================================================

  describe("toggle text changes", () => {
    it('initially shows "View More Items" text when show_all is undefined', () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.getByText("View More Items")).toBeInTheDocument();
      expect(screen.queryByText("View Only Top-10")).not.toBeInTheDocument();
    });

    it('shows "View Only Top-10" text when show_all=true', () => {
      const run = createRunWith15Items();
      const viewOptions: TopKViewOptions = { show_all: true };

      renderWithProviders(
        <TopKDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(screen.getByText("View Only Top-10")).toBeInTheDocument();
      expect(screen.queryByText("View More Items")).not.toBeInTheDocument();
    });

    it('shows "View More Items" text when show_all=false', () => {
      const run = createRunWith15Items();
      const viewOptions: TopKViewOptions = { show_all: false };

      renderWithProviders(
        <TopKDiffResultView run={run} viewOptions={viewOptions} />,
      );

      expect(screen.getByText("View More Items")).toBeInTheDocument();
      expect(screen.queryByText("View Only Top-10")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("throws error when wrong run type provided", () => {
      const wrongRun = createRowCountDiffRun();

      // Suppress console.error for expected errors
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // Factory pattern includes type guard that throws
      expect(() => {
        renderWithProviders(<TopKDiffResultView run={wrongRun} />);
      }).toThrow("Run type must be top_k_diff");

      consoleSpy.mockRestore();
    });

    it("accepts top_k_diff type run", () => {
      const run = createTopKDiffRun();

      // Should not throw
      expect(() => {
        renderWithProviders(<TopKDiffResultView run={run} />);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // Ref Forwarding Tests
  // ==========================================================================

  describe("ref forwarding", () => {
    it("forwards ref to ScreenshotBox (HTMLDivElement)", () => {
      const run = createTopKDiffRun();
      const ref = createBoxRef();

      // Cast ref to any for test flexibility - mock matches expected shape
      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <TopKDiffResultView run={run} ref={ref as any} />,
      );

      // The ref should be connected to ScreenshotBox mock
      expect(ref.current).not.toBeNull();
      // ScreenshotBox mock renders with data-testid="screenshot-box-mock"
      expect(ref.current).toHaveAttribute("data-testid", "screenshot-box-mock");
    });
  });

  // ==========================================================================
  // Chart Data Tests
  // ==========================================================================

  describe("chart data", () => {
    it("passes topKDiff result to TopKSummaryBarChart", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(mockTopKSummaryBarChart).toHaveBeenCalledWith(
        expect.objectContaining({
          topKDiff: run.result,
        }),
      );
    });

    it("passes valids from current to TopKSummaryBarChart", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // The fixture has result.current.valids = 900
      expect(mockTopKSummaryBarChart).toHaveBeenCalledWith(
        expect.objectContaining({
          valids: 900,
        }),
      );
    });

    it("passes isDisplayTopTen prop to TopKSummaryBarChart", () => {
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(mockTopKSummaryBarChart).toHaveBeenCalledWith(
        expect.objectContaining({
          isDisplayTopTen: true,
        }),
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles exactly 11 items (shows toggle)", () => {
      const baseRun = createTopKDiffRun();
      const result: TopKDiffResult = {
        base: {
          values: Array(11)
            .fill(null)
            .map((_, i) => `item_${i}`),
          counts: Array(11).fill(10),
          valids: 880,
        },
        current: {
          values: Array(11)
            .fill(null)
            .map((_, i) => `item_${i}`),
          counts: Array(11).fill(10),
          valids: 900,
        },
      };
      const run = { ...baseRun, result };

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.getByText("View More Items")).toBeInTheDocument();
    });

    it("uses 0 for valids when current.valids is undefined", () => {
      const baseRun = createTopKDiffRun();
      const result: TopKDiffResult = {
        base: {
          values: ["a", "b"],
          counts: [10, 20],
          valids: 880,
        },
        current: {
          values: ["a", "b"],
          counts: [15, 25],
          valids: undefined as unknown as number,
        },
      };
      const run = { ...baseRun, result };

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Should use 0 as fallback for valids
      expect(mockTopKSummaryBarChart).toHaveBeenCalledWith(
        expect.objectContaining({
          valids: 0,
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
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Verify useIsDark is called (title uses it for color)
      expect(mockUseIsDark).toHaveBeenCalled();
    });

    it("applies dark mode styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Verify useIsDark is called
      expect(mockUseIsDark).toHaveBeenCalled();
    });
  });
});
