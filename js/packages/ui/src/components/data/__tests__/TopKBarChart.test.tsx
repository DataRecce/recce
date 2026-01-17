/**
 * @file TopKBarChart.test.tsx
 * @description Tests for @datarecce/ui TopKBarChart, TopKSummaryList, and SingleBarChart components
 *
 * Tests verify:
 * - SingleBarChart renders with correct data
 * - TopKSummaryList displays items correctly
 * - TopKBarChart handles comparison mode
 * - Special labels (null, empty, others) are handled
 * - Theme support (light/dark)
 * - memoization and displayName
 */

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import {
  SingleBarChart,
  TopKBarChart,
  type TopKDataset,
  TopKSummaryList,
} from "../TopKBarChart";

// Mock Chart.js to avoid canvas rendering issues in tests
vi.mock("react-chartjs-2", () => ({
  Bar: ({ data }: { data: unknown }) => (
    <div data-testid="mock-bar-chart" data-data={JSON.stringify(data)} />
  ),
}));

// Mock Chart.js register with all needed exports
vi.mock("chart.js", () => ({
  Chart: {
    register: vi.fn(),
  },
  BarElement: {},
  CategoryScale: {},
  LinearScale: {},
  TimeSeriesScale: {},
  Title: {},
  Legend: {},
  Tooltip: {},
}));

describe("TopKBarChart", () => {
  // Test fixtures
  const mockDataset: TopKDataset = {
    values: ["apple", "banana", "cherry", "date", "elderberry"],
    counts: [100, 80, 60, 40, 20],
    valids: 350,
  };

  const mockBaseDataset: TopKDataset = {
    values: ["apple", "banana", "cherry", "date", "elderberry"],
    counts: [90, 70, 50, 30, 10],
    valids: 300,
  };

  // ==========================================================================
  // SingleBarChart Tests
  // ==========================================================================

  describe("SingleBarChart", () => {
    it("renders without crashing", () => {
      render(<SingleBarChart count={50} total={100} />);

      expect(screen.getByTestId("mock-bar-chart")).toBeInTheDocument();
    });

    it("passes correct data structure to Chart", () => {
      render(<SingleBarChart count={50} total={100} />);

      const chart = screen.getByTestId("mock-bar-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      expect(data.datasets).toHaveLength(1);
      expect(data.datasets[0].data).toEqual([50]);
    });

    it("accepts custom color prop", () => {
      render(<SingleBarChart count={50} total={100} color="#ff0000" />);

      const chart = screen.getByTestId("mock-bar-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      expect(data.datasets[0].backgroundColor).toBe("#ff0000");
    });

    it("accepts theme prop", () => {
      render(<SingleBarChart count={50} total={100} theme="dark" />);

      expect(screen.getByTestId("mock-bar-chart")).toBeInTheDocument();
    });

    it("accepts height prop", () => {
      const { container } = render(
        <SingleBarChart count={50} total={100} height={24} />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.style.height).toBe("24px");
    });

    it("has displayName set", () => {
      expect(SingleBarChart.displayName).toBe("SingleBarChart");
    });
  });

  // ==========================================================================
  // TopKSummaryList Tests
  // ==========================================================================

  describe("TopKSummaryList", () => {
    it("renders without crashing", () => {
      render(<TopKSummaryList data={mockDataset} />);

      // Should render items
      expect(screen.getByText("apple")).toBeInTheDocument();
      expect(screen.getByText("banana")).toBeInTheDocument();
    });

    it("renders all items from dataset", () => {
      render(<TopKSummaryList data={mockDataset} />);

      expect(screen.getByText("apple")).toBeInTheDocument();
      expect(screen.getByText("banana")).toBeInTheDocument();
      expect(screen.getByText("cherry")).toBeInTheDocument();
      expect(screen.getByText("date")).toBeInTheDocument();
      expect(screen.getByText("elderberry")).toBeInTheDocument();
    });

    it("adds (others) when there is remaining count", () => {
      const dataWithOthers: TopKDataset = {
        values: ["a", "b"],
        counts: [50, 30],
        valids: 100, // 100 - 50 - 30 = 20 remaining
      };

      render(<TopKSummaryList data={dataWithOthers} />);

      expect(screen.getByText("(others)")).toBeInTheDocument();
    });

    it("does not add (others) when sum equals valids", () => {
      const dataNoOthers: TopKDataset = {
        values: ["a", "b"],
        counts: [50, 50],
        valids: 100, // 100 - 50 - 50 = 0 remaining
      };

      render(<TopKSummaryList data={dataNoOthers} />);

      expect(screen.queryByText("(others)")).not.toBeInTheDocument();
    });

    it("handles null values as (null)", () => {
      const dataWithNull: TopKDataset = {
        values: [null, "b"],
        counts: [50, 50],
        valids: 100,
      };

      render(<TopKSummaryList data={dataWithNull} />);

      expect(screen.getByText("(null)")).toBeInTheDocument();
    });

    it("handles empty string values as (empty)", () => {
      const dataWithEmpty: TopKDataset = {
        values: ["", "b"],
        counts: [50, 50],
        valids: 100,
      };

      render(<TopKSummaryList data={dataWithEmpty} />);

      expect(screen.getByText("(empty)")).toBeInTheDocument();
    });

    it("respects maxItems prop", () => {
      render(<TopKSummaryList data={mockDataset} maxItems={3} />);

      expect(screen.getByText("apple")).toBeInTheDocument();
      expect(screen.getByText("banana")).toBeInTheDocument();
      expect(screen.getByText("cherry")).toBeInTheDocument();
      expect(screen.queryByText("date")).not.toBeInTheDocument();
      expect(screen.queryByText("elderberry")).not.toBeInTheDocument();
    });

    it("shows (others) when maxItems limits display", () => {
      render(<TopKSummaryList data={mockDataset} maxItems={3} />);

      // 100+80+60=240 displayed, 350-240=110 remaining
      expect(screen.getByText("(others)")).toBeInTheDocument();
    });

    it("accepts theme prop", () => {
      render(<TopKSummaryList data={mockDataset} theme="dark" />);

      expect(screen.getByText("apple")).toBeInTheDocument();
    });

    it("accepts className prop", () => {
      const { container } = render(
        <TopKSummaryList data={mockDataset} className="custom-class" />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("custom-class");
    });

    it("has displayName set", () => {
      expect(TopKSummaryList.displayName).toBe("TopKSummaryList");
    });
  });

  // ==========================================================================
  // TopKBarChart Tests
  // ==========================================================================

  describe("TopKBarChart", () => {
    it("renders without crashing", () => {
      render(<TopKBarChart currentData={mockDataset} />);

      expect(screen.getByText("apple")).toBeInTheDocument();
    });

    it("renders all current items", () => {
      render(<TopKBarChart currentData={mockDataset} />);

      expect(screen.getByText("apple")).toBeInTheDocument();
      expect(screen.getByText("banana")).toBeInTheDocument();
      expect(screen.getByText("cherry")).toBeInTheDocument();
    });

    it("shows title when provided", () => {
      render(<TopKBarChart currentData={mockDataset} title="Test Title" />);

      expect(screen.getByText("Test Title")).toBeInTheDocument();
    });

    it("shows legend when showComparison=true and baseData provided", () => {
      render(
        <TopKBarChart
          currentData={mockDataset}
          baseData={mockBaseDataset}
          showComparison={true}
        />,
      );

      expect(screen.getByText("Base")).toBeInTheDocument();
      expect(screen.getByText("Current")).toBeInTheDocument();
    });

    it("does not show legend when showComparison=false", () => {
      render(
        <TopKBarChart
          currentData={mockDataset}
          baseData={mockBaseDataset}
          showComparison={false}
        />,
      );

      expect(screen.queryByText("Base")).not.toBeInTheDocument();
      expect(screen.queryByText("Current")).not.toBeInTheDocument();
    });

    it("respects maxItems prop", () => {
      render(<TopKBarChart currentData={mockDataset} maxItems={3} />);

      expect(screen.getByText("apple")).toBeInTheDocument();
      expect(screen.getByText("banana")).toBeInTheDocument();
      expect(screen.getByText("cherry")).toBeInTheDocument();
      expect(screen.queryByText("date")).not.toBeInTheDocument();
    });

    it("handles null values as (null)", () => {
      const dataWithNull: TopKDataset = {
        values: [null, "b"],
        counts: [50, 50],
        valids: 100,
      };

      render(<TopKBarChart currentData={dataWithNull} />);

      expect(screen.getByText("(null)")).toBeInTheDocument();
    });

    it("handles empty string values as (empty)", () => {
      const dataWithEmpty: TopKDataset = {
        values: ["", "b"],
        counts: [50, 50],
        valids: 100,
      };

      render(<TopKBarChart currentData={dataWithEmpty} />);

      expect(screen.getByText("(empty)")).toBeInTheDocument();
    });

    it("skips empty (others) row when both base and current have 0 count", () => {
      const dataNoRemaining: TopKDataset = {
        values: ["a", "b"],
        counts: [50, 50],
        valids: 100,
      };

      render(
        <TopKBarChart
          currentData={dataNoRemaining}
          baseData={dataNoRemaining}
          showComparison={true}
        />,
      );

      // No (others) should appear when remaining is 0
      expect(screen.queryByText("(others)")).not.toBeInTheDocument();
    });

    it("shows (others) when there is remaining count in current", () => {
      const dataWithRemaining: TopKDataset = {
        values: ["a", "b"],
        counts: [50, 30],
        valids: 100, // 20 remaining
      };

      render(<TopKBarChart currentData={dataWithRemaining} />);

      expect(screen.getByText("(others)")).toBeInTheDocument();
    });

    it("accepts theme prop", () => {
      render(<TopKBarChart currentData={mockDataset} theme="dark" />);

      expect(screen.getByText("apple")).toBeInTheDocument();
    });

    it("accepts className prop", () => {
      const { container } = render(
        <TopKBarChart currentData={mockDataset} className="custom-class" />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain("custom-class");
    });

    it("has displayName set", () => {
      expect(TopKBarChart.displayName).toBe("TopKBarChart");
    });
  });

  // ==========================================================================
  // Comparison Mode Tests
  // ==========================================================================

  describe("comparison mode", () => {
    it("renders both base and current bars when comparison enabled", () => {
      render(
        <TopKBarChart
          currentData={mockDataset}
          baseData={mockBaseDataset}
          showComparison={true}
        />,
      );

      // Should have multiple bar charts (one for each item, doubled for comparison)
      const charts = screen.getAllByTestId("mock-bar-chart");
      // At least 2 charts per item (current + base)
      expect(charts.length).toBeGreaterThanOrEqual(2);
    });

    it("only renders current bars when comparison disabled", () => {
      // Use dataset where counts sum to valids (no "others" row)
      const exactData: TopKDataset = {
        values: ["a", "b", "c"],
        counts: [40, 35, 25],
        valids: 100,
      };

      render(
        <TopKBarChart
          currentData={exactData}
          baseData={mockBaseDataset}
          showComparison={false}
        />,
      );

      // Should only have charts for current data (3 items)
      const charts = screen.getAllByTestId("mock-bar-chart");
      expect(charts.length).toBe(3);
    });

    it("handles different lengths of base and current datasets", () => {
      const shorterBase: TopKDataset = {
        values: ["a", "b"],
        counts: [50, 50],
        valids: 100,
      };

      const longerCurrent: TopKDataset = {
        values: ["a", "b", "c", "d"],
        counts: [40, 30, 20, 10],
        valids: 100,
      };

      render(
        <TopKBarChart
          currentData={longerCurrent}
          baseData={shorterBase}
          showComparison={true}
        />,
      );

      // Should render all current items
      expect(screen.getByText("a")).toBeInTheDocument();
      expect(screen.getByText("b")).toBeInTheDocument();
      expect(screen.getByText("c")).toBeInTheDocument();
      expect(screen.getByText("d")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles empty dataset", () => {
      const emptyData: TopKDataset = {
        values: [],
        counts: [],
        valids: 0,
      };

      const { container } = render(<TopKSummaryList data={emptyData} />);

      // Should render without error
      expect(container).toBeInTheDocument();
    });

    it("handles single item dataset", () => {
      const singleItem: TopKDataset = {
        values: ["only"],
        counts: [100],
        valids: 100,
      };

      render(<TopKSummaryList data={singleItem} />);

      expect(screen.getByText("only")).toBeInTheDocument();
    });

    it("handles numeric values", () => {
      const numericData: TopKDataset = {
        values: [1, 2, 3],
        counts: [50, 30, 20],
        valids: 100,
      };

      render(<TopKSummaryList data={numericData} />);

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("handles zero count items", () => {
      const zeroCountData: TopKDataset = {
        values: ["a", "b"],
        counts: [100, 0],
        valids: 100,
      };

      render(<TopKSummaryList data={zeroCountData} />);

      // Both should be rendered
      expect(screen.getByText("a")).toBeInTheDocument();
      expect(screen.getByText("b")).toBeInTheDocument();
    });

    it("handles maxItems greater than dataset length", () => {
      const smallData: TopKDataset = {
        values: ["a", "b"],
        counts: [50, 50],
        valids: 100,
      };

      render(<TopKSummaryList data={smallData} maxItems={10} />);

      // Should render all items without error
      expect(screen.getByText("a")).toBeInTheDocument();
      expect(screen.getByText("b")).toBeInTheDocument();
    });

    it("handles undefined baseData in comparison mode", () => {
      render(
        <TopKBarChart
          currentData={mockDataset}
          baseData={undefined}
          showComparison={true}
        />,
      );

      // Should render current data without error
      expect(screen.getByText("apple")).toBeInTheDocument();
      // Should not show base legend without baseData
      expect(screen.queryByText("Base")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Formatting Tests
  // ==========================================================================

  describe("formatting", () => {
    it("displays abbreviated counts for large numbers", () => {
      const largeData: TopKDataset = {
        values: ["big"],
        counts: [1500000],
        valids: 2000000,
      };

      render(<TopKSummaryList data={largeData} />);

      // Should show abbreviated format (1.5M)
      expect(screen.getByText("1.5M")).toBeInTheDocument();
    });

    it("displays percentages", () => {
      const simpleData: TopKDataset = {
        values: ["half"],
        counts: [100],
        valids: 100,
      };

      render(<TopKSummaryList data={simpleData} />);

      // Should show 100.0%
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });

    it("displays <0.1% for very small percentages", () => {
      const smallPercentData: TopKDataset = {
        values: ["tiny"],
        counts: [1],
        valids: 10000,
      };

      render(<TopKSummaryList data={smallPercentData} />);

      // Should show <0.1%
      expect(screen.getByText("<0.1%")).toBeInTheDocument();
    });

    it("displays >99.9% for very large percentages", () => {
      const largePercentData: TopKDataset = {
        values: ["huge"],
        counts: [9999],
        valids: 10000,
      };

      render(<TopKSummaryList data={largePercentData} />);

      // Should show >99.9%
      expect(screen.getByText(">99.9%")).toBeInTheDocument();
    });
  });
});
