/**
 * @file HistogramChart.test.tsx
 * @description Tests for @datarecce/ui HistogramChart component and utility functions
 *
 * Tests verify:
 * - getChartThemeColors returns correct theme colors
 * - getChartBarColors returns correct bar colors for light/dark modes
 * - Component renders without crashing
 * - Props are correctly passed to Chart.js
 * - Light/dark theme support
 */

import { render } from "@testing-library/react";
import {
  getChartBarColors,
  getChartThemeColors,
  HistogramChart,
} from "../HistogramChart";

// Mock Chart.js to avoid canvas rendering issues in tests
jest.mock("react-chartjs-2", () => ({
  Chart: ({ data }: { data: unknown }) => (
    <div data-testid="mock-chart" data-data={JSON.stringify(data)} />
  ),
}));

// Mock Chart.js register
jest.mock("chart.js", () => ({
  Chart: {
    register: jest.fn(),
  },
  BarElement: {},
  TimeSeriesScale: {},
  LinearScale: {},
  CategoryScale: {},
  Title: {},
  Legend: {},
  Tooltip: {},
}));

describe("HistogramChart", () => {
  // Test fixtures
  const mockBaseData = {
    counts: [10, 20, 30, 40, 50],
  };

  const mockCurrentData = {
    counts: [15, 25, 35, 45, 55],
  };

  const mockBinEdges = [0, 20, 40, 60, 80, 100];

  const defaultProps = {
    title: "Test Histogram",
    binEdges: mockBinEdges,
    baseData: mockBaseData,
    currentData: mockCurrentData,
  };

  describe("getChartThemeColors", () => {
    it("returns light theme colors when isDark is false", () => {
      const colors = getChartThemeColors(false);

      expect(colors.gridColor).toBe("#d1d5db");
      expect(colors.textColor).toBe("#374151");
      expect(colors.borderColor).toBe("#9ca3af");
      expect(colors.tooltipBackgroundColor).toBe("#ffffff");
      expect(colors.tooltipTextColor).toBe("#111827");
    });

    it("returns dark theme colors when isDark is true", () => {
      const colors = getChartThemeColors(true);

      expect(colors.gridColor).toBe("#4b5563");
      expect(colors.textColor).toBe("#e5e7eb");
      expect(colors.borderColor).toBe("#6b7280");
      expect(colors.tooltipBackgroundColor).toBe("#1f2937");
      expect(colors.tooltipTextColor).toBe("#e5e7eb");
    });

    it("returns all required color properties", () => {
      const colors = getChartThemeColors(false);

      expect(colors).toHaveProperty("gridColor");
      expect(colors).toHaveProperty("textColor");
      expect(colors).toHaveProperty("borderColor");
      expect(colors).toHaveProperty("tooltipBackgroundColor");
      expect(colors).toHaveProperty("tooltipTextColor");
    });
  });

  describe("getChartBarColors", () => {
    it("returns light mode bar colors when isDark is false", () => {
      const colors = getChartBarColors(false);

      expect(colors.current).toBe("#63B3ED");
      expect(colors.base).toBe("#F6AD55");
      expect(colors.currentWithAlpha).toBe("#63B3EDA5");
      expect(colors.baseWithAlpha).toBe("#F6AD55A5");
    });

    it("returns dark mode bar colors when isDark is true", () => {
      const colors = getChartBarColors(true);

      expect(colors.current).toBe("#90CDF4");
      expect(colors.base).toBe("#FBD38D");
      expect(colors.currentWithAlpha).toBe("#90CDF4A5");
      expect(colors.baseWithAlpha).toBe("#FBD38DA5");
    });

    it("returns all required bar color properties", () => {
      const colors = getChartBarColors(false);

      expect(colors).toHaveProperty("current");
      expect(colors).toHaveProperty("base");
      expect(colors).toHaveProperty("currentWithAlpha");
      expect(colors).toHaveProperty("baseWithAlpha");
    });
  });

  describe("HistogramChart component", () => {
    it("renders without crashing", () => {
      const { getByTestId } = render(<HistogramChart {...defaultProps} />);

      expect(getByTestId("mock-chart")).toBeInTheDocument();
    });

    it("passes data to Chart component with correct structure", () => {
      const { getByTestId } = render(<HistogramChart {...defaultProps} />);

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      expect(data.labels).toBeDefined();
      expect(data.datasets).toBeDefined();
      expect(data.datasets).toHaveLength(2);
    });

    it("generates correct bin labels", () => {
      const { getByTestId } = render(<HistogramChart {...defaultProps} />);

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // Should have binEdges.length - 1 labels
      expect(data.labels).toHaveLength(5);
    });

    it("creates datasets with correct labels", () => {
      const { getByTestId } = render(<HistogramChart {...defaultProps} />);

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // First dataset should be "Current"
      expect(data.datasets[0].label).toBe("Current");
      // Second dataset should be "Base"
      expect(data.datasets[1].label).toBe("Base");
    });

    it("uses custom labels when provided", () => {
      const { getByTestId } = render(
        <HistogramChart
          {...defaultProps}
          baseData={{ ...mockBaseData, label: "Production" }}
          currentData={{ ...mockCurrentData, label: "Staging" }}
        />,
      );

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      expect(data.datasets[0].label).toBe("Staging");
      expect(data.datasets[1].label).toBe("Production");
    });

    it("applies light theme colors by default", () => {
      const { getByTestId } = render(<HistogramChart {...defaultProps} />);

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // Light mode colors
      expect(data.datasets[0].backgroundColor).toBe("#63B3EDA5");
      expect(data.datasets[1].backgroundColor).toBe("#F6AD55A5");
    });

    it("applies dark theme colors when theme is dark", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} theme="dark" />,
      );

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // Dark mode colors
      expect(data.datasets[0].backgroundColor).toBe("#90CDF4A5");
      expect(data.datasets[1].backgroundColor).toBe("#FBD38DA5");
    });

    it("accepts dataType prop", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} dataType="datetime" />,
      );

      expect(getByTestId("mock-chart")).toBeInTheDocument();
    });

    it("accepts samples prop", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} samples={1000} />,
      );

      expect(getByTestId("mock-chart")).toBeInTheDocument();
    });

    it("accepts hideAxis prop", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} hideAxis={true} />,
      );

      expect(getByTestId("mock-chart")).toBeInTheDocument();
    });

    it("accepts animate prop", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} animate={true} />,
      );

      expect(getByTestId("mock-chart")).toBeInTheDocument();
    });

    it("accepts height prop", () => {
      const { container } = render(
        <HistogramChart {...defaultProps} height={500} />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("500px");
    });

    it("accepts className prop", () => {
      const { container } = render(
        <HistogramChart {...defaultProps} className="custom-class" />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("custom-class");
    });

    it("accepts min and max props for datetime scale", () => {
      const { getByTestId } = render(
        <HistogramChart
          {...defaultProps}
          dataType="datetime"
          min={1704067200000}
          max={1706745600000}
        />,
      );

      expect(getByTestId("mock-chart")).toBeInTheDocument();
    });
  });

  describe("data transformation", () => {
    it("creates [timestamp, count] tuples for datetime type", () => {
      const datetimeBinEdges = [
        1704067200000, 1704672000000, 1705276800000, 1705881600000,
        1706486400000, 1706745600000,
      ];

      const { getByTestId } = render(
        <HistogramChart
          title="Date Histogram"
          dataType="datetime"
          binEdges={datetimeBinEdges}
          baseData={mockBaseData}
          currentData={mockCurrentData}
        />,
      );

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // For datetime, data should be arrays of [x, y] tuples
      const currentData = data.datasets[0].data;
      expect(Array.isArray(currentData[0])).toBe(true);
      expect(currentData[0]).toHaveLength(2);
    });

    it("uses plain count values for numeric type", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} dataType="numeric" />,
      );

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // For numeric, data should be plain numbers
      const currentData = data.datasets[0].data;
      expect(typeof currentData[0]).toBe("number");
    });
  });

  describe("memoization", () => {
    it("has displayName set", () => {
      expect(HistogramChart.displayName).toBe("HistogramChart");
    });
  });
});
