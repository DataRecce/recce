/**
 * @file TopKDiffResultView.test.tsx
 * @description Baseline tests for TopKDiffResultView component
 *
 * These tests capture current component behavior before refactoring to factory pattern.
 * Tests verify:
 * - Correct rendering with valid run data
 * - Title format (Model {params.model}.{params.column_name})
 * - View toggle visibility based on item count (>10 items)
 * - Toggle state changes via click interaction
 * - Toggle text changes between "View More Items" and "View Only Top-10"
 * - Ref forwarding to ScreenshotBox (HTMLDivElement ref)
 * - NO type guard (does not throw for wrong run types)
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

// Mock ScreenshotBox with our test utility mock
jest.mock("@datarecce/ui/primitives", () => ({
  ScreenshotBox: jest.requireActual("@/testing-utils/resultViewTestUtils")
    .screenshotBoxMock,
}));

// Mock useIsDark hook
const mockUseIsDark = jest.fn(() => false);
jest.mock("@/lib/hooks/useIsDark", () => ({
  useIsDark: () => mockUseIsDark(),
}));

// ============================================================================
// Imports
// ============================================================================

import { fireEvent, screen } from "@testing-library/react";
import React from "react";
import type { TopKDiffResult } from "@/lib/api/profile";
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

    it("applies light mode background styling when useIsDark returns false", () => {
      mockUseIsDark.mockReturnValue(false);
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // The ScreenshotBox should receive white background
      const screenshotBox = screen.getByTestId("screenshot-box-mock");
      expect(screenshotBox).toHaveAttribute("data-background-color", "white");
    });

    it("applies dark mode background styling when useIsDark returns true", () => {
      mockUseIsDark.mockReturnValue(true);
      const run = createTopKDiffRun();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // The ScreenshotBox should receive dark background
      const screenshotBox = screen.getByTestId("screenshot-box-mock");
      expect(screenshotBox).toHaveAttribute("data-background-color", "#1f2937");
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
  // Toggle State Change Tests
  // ==========================================================================

  describe("toggle state change", () => {
    it("starts with isDisplayTopTen=true", () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Verify initial state via mock prop
      expect(mockTopKSummaryBarChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDisplayTopTen: true,
        }),
      );
    });

    it("toggles isDisplayTopTen to false when clicking View More Items", () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Click the toggle
      fireEvent.click(screen.getByText("View More Items"));

      // Verify state changed via mock prop
      expect(mockTopKSummaryBarChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDisplayTopTen: false,
        }),
      );
    });

    it("toggles isDisplayTopTen back to true when clicking View Only Top-10", () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // Click to show all
      fireEvent.click(screen.getByText("View More Items"));

      // Click to show top-10 again
      fireEvent.click(screen.getByText("View Only Top-10"));

      // Verify state toggled back
      expect(mockTopKSummaryBarChart).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDisplayTopTen: true,
        }),
      );
    });
  });

  // ==========================================================================
  // Toggle Text Change Tests
  // ==========================================================================

  describe("toggle text changes", () => {
    it('initially shows "View More Items" text', () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      expect(screen.getByText("View More Items")).toBeInTheDocument();
      expect(screen.queryByText("View Only Top-10")).not.toBeInTheDocument();
    });

    it('changes to "View Only Top-10" after clicking', () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      fireEvent.click(screen.getByText("View More Items"));

      expect(screen.getByText("View Only Top-10")).toBeInTheDocument();
      expect(screen.queryByText("View More Items")).not.toBeInTheDocument();
    });

    it('changes back to "View More Items" after clicking twice', () => {
      const run = createRunWith15Items();

      renderWithProviders(<TopKDiffResultView run={run} />);

      // First click
      fireEvent.click(screen.getByText("View More Items"));
      // Second click
      fireEvent.click(screen.getByText("View Only Top-10"));

      expect(screen.getByText("View More Items")).toBeInTheDocument();
      expect(screen.queryByText("View Only Top-10")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Type Safety Tests
  // ==========================================================================

  describe("type safety", () => {
    it("does NOT have explicit type guard (no throw with specific error message)", () => {
      const wrongRun = createRowCountDiffRun();

      // Suppress console.error for expected errors
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // Unlike other ResultView components with explicit type guards that throw
      // "Run type must be X", TopKDiffResultView does NOT have a type guard.
      // It will crash due to undefined property access, not a validation error.
      expect(() => {
        renderWithProviders(<TopKDiffResultView run={wrongRun} />);
      }).toThrow(TypeError); // Crashes on undefined property access, not validation

      consoleSpy.mockRestore();
    });

    it("crashes with TypeError when given wrong run type (no validation)", () => {
      const wrongRun = createRowCountDiffRun();

      // Suppress console.error for expected errors
      const consoleSpy = jest
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentionally suppress console output
        .mockImplementation(() => {});

      // The component casts run.result as TopKDiffResult without validation,
      // so it crashes trying to access result.current.valids when result has wrong shape
      expect(() => {
        renderWithProviders(<TopKDiffResultView run={wrongRun} />);
      }).toThrow("Cannot read properties of undefined");

      consoleSpy.mockRestore();
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

    it("ref is HTMLDivElement (not DataGridHandle)", () => {
      const run = createTopKDiffRun();
      const ref = createBoxRef();

      renderWithProviders(
        // biome-ignore lint/suspicious/noExplicitAny: test mock needs flexible typing
        <TopKDiffResultView run={run} ref={ref as any} />,
      );

      // HTMLDivElement should have standard DOM properties
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
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
});
