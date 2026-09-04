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

import { render, screen } from "@testing-library/react";
import type { Chart, LegendItem, Plugin } from "chart.js";
import { vi } from "vitest";
import {
  getChartBarColors,
  getChartThemeColors,
  getSemanticColorTheme,
} from "../../../theme";
import { HistogramChart } from "../HistogramChart";
import type { HistogramOverlapPalette } from "../histogramOverlap";

interface MockChartProps {
  data: {
    labels?: number[];
    datasets: Record<string, unknown>[];
  };
  fallbackContent?: React.ReactNode;
  options?: {
    plugins?: {
      histogramOverlap?: { palette: HistogramOverlapPalette };
      legend?: {
        labels?: {
          generateLabels?: (chart: Chart<"bar">) => LegendItem[];
        };
      };
      tooltip?: {
        callbacks?: {
          title?: (items: { dataIndex: number }[]) => string;
          label?: (item: {
            dataIndex: number;
            datasetIndex: number;
            dataset: { label?: string };
          }) => string;
        };
      };
    };
    scales?: {
      x?: {
        display?: boolean;
        max?: number;
        min?: number;
        type?: string;
        ticks?: {
          callback?: (
            value: number | string,
            index: number,
            ticks: unknown[],
          ) => string | undefined;
        };
      };
      y?: { max?: number };
    };
  };
  plugins?: Plugin<"bar">[];
  role?: string;
  "aria-label"?: string;
}

const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));

// Mock Chart.js to avoid canvas rendering issues in tests
vi.mock("react-chartjs-2", () => ({
  Chart: (props: MockChartProps) => {
    chartSpy(props);
    const { data, fallbackContent, role, "aria-label": ariaLabel } = props;
    return (
      <div
        data-testid="mock-chart"
        data-data={JSON.stringify(data)}
        role={role}
        aria-label={ariaLabel}
      >
        {fallbackContent}
      </div>
    );
  },
}));

// Mock Chart.js register
vi.mock("chart.js", () => ({
  Chart: {
    register: vi.fn(),
  },
  BarElement: {},
  TimeSeriesScale: {},
  LinearScale: {},
  CategoryScale: {},
  Title: {},
  Legend: {},
  Tooltip: {},
}));

vi.mock("chartjs-adapter-date-fns", () => ({}));

function getLastChartProps(): MockChartProps {
  const props = chartSpy.mock.lastCall?.[0] as MockChartProps | undefined;
  if (!props) throw new Error("Chart was not rendered");
  return props;
}

function createLegendChart() {
  const pattern = {} as CanvasPattern;
  const tileContext = {
    beginPath: vi.fn(),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    stroke: vi.fn(),
  };
  const context = {
    canvas: {
      ownerDocument: {
        createElement: vi.fn(() => ({
          getContext: vi.fn(() => tileContext),
          height: 0,
          width: 0,
        })),
      },
    },
    createPattern: vi.fn(() => pattern),
  } as unknown as CanvasRenderingContext2D;
  const chart = {
    ctx: context,
    isDatasetVisible: vi.fn(() => true),
  } as unknown as Chart<"bar">;
  return { chart, pattern };
}

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
      expect(colors.barLabelColor).toBe("#1f2937");
      expect(colors.secondaryTextColor).toBe("#6b7280");
    });

    it("returns dark theme colors when isDark is true", () => {
      const colors = getChartThemeColors(true);

      expect(colors.gridColor).toBe("#4b5563");
      expect(colors.textColor).toBe("#e5e7eb");
      expect(colors.borderColor).toBe("#6b7280");
      expect(colors.tooltipBackgroundColor).toBe("#1f2937");
      expect(colors.tooltipTextColor).toBe("#e5e7eb");
      expect(colors.barLabelColor).toBe("#ffffff");
      expect(colors.secondaryTextColor).toBe("#e5e7eb");
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
      const semantic = getSemanticColorTheme(true);
      expect(colors.currentWithAlpha).toBe(
        semantic.comparison.current.chartFill,
      );
      expect(colors.baseWithAlpha).toBe(semantic.comparison.base.chartFill);
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

    it("positions numeric bars at bin midpoints while keeping full tooltip ranges", () => {
      render(<HistogramChart {...defaultProps} />);

      const { data, options } = getLastChartProps();
      const tickCallback = options?.scales?.x?.ticks?.callback;
      const tooltipCallbacks = options?.plugins?.tooltip?.callbacks;

      expect(data.labels).toEqual([]);
      expect(options?.scales?.x).toMatchObject({
        max: 100,
        min: 0,
        type: "linear",
      });
      expect(data.datasets[0].data).toHaveLength(mockCurrentData.counts.length);
      expect(data.datasets[1].data).toHaveLength(mockBaseData.counts.length);
      expect(data.datasets[0].data).toEqual([
        { x: 10, y: 15 },
        { x: 30, y: 25 },
        { x: 50, y: 35 },
        { x: 70, y: 45 },
        { x: 90, y: 55 },
      ]);
      expect(tickCallback?.(0, 0, [])).toBe("0");
      expect(tickCallback?.(100, 5, [])).toBe("100");
      expect(tooltipCallbacks?.title?.([{ dataIndex: 4 }])).toBe(
        "Value Range\n80 - 100",
      );
      expect(
        tooltipCallbacks?.label?.({
          dataIndex: 4,
          datasetIndex: 0,
          dataset: { label: "Current" },
        }),
      ).toBe("Current: 55");
    });

    it("thins numeric edge ticks while retaining the first and terminal edges", () => {
      const binEdges = Array.from({ length: 13 }, (_, index) => index * 10);
      const counts = Array.from({ length: 12 }, () => 1);
      render(
        <HistogramChart
          title="Many bins"
          binEdges={binEdges}
          baseData={{ counts }}
          currentData={{ counts }}
        />,
      );

      const tickCallback =
        getLastChartProps().options?.scales?.x?.ticks?.callback;
      const labels = binEdges
        .map((edge, index) => tickCallback?.(edge, index, []))
        .filter((label): label is string => label !== undefined);

      expect(labels).toEqual(["0", "20", "40", "60", "80", "100", "120"]);
    });

    it.each([
      {
        name: "positive",
        binEdges: Array.from(
          { length: 51 },
          (_, index) => 1_000_000 + index * 0.01,
        ),
      },
      {
        name: "negative",
        binEdges: Array.from(
          { length: 51 },
          (_, index) => -1_000_000.5 + index * 0.01,
        ),
      },
    ])(
      "keeps selected ticks and tooltip endpoints distinct in a narrow $name high-offset domain",
      ({ binEdges }) => {
        const counts = Array.from({ length: binEdges.length - 1 }, () => 1);
        render(
          <HistogramChart
            title="High-offset bins"
            binEdges={binEdges}
            baseData={{ counts }}
            currentData={{ counts }}
          />,
        );

        const { options } = getLastChartProps();
        const tickCallback = options?.scales?.x?.ticks?.callback;
        const selectedLabels = binEdges
          .map((edge, index) => tickCallback?.(edge, index, []))
          .filter((label): label is string => label !== undefined);
        expect(new Set(selectedLabels).size).toBe(selectedLabels.length);

        const title = options?.plugins?.tooltip?.callbacks?.title?.([
          { dataIndex: 0 },
        ]);
        const [start, end] = title?.split("\n")[1]?.split(" - ") ?? [];
        expect(start).toBeTruthy();
        expect(end).toBeTruthy();
        expect(start).not.toBe(end);
      },
    );

    it("retains compact abbreviated labels when they are already distinct", () => {
      const binEdges = [1_000_000, 1_200_000, 1_400_000];
      const counts = [1, 1];
      render(
        <HistogramChart
          title="Readable million bins"
          binEdges={binEdges}
          baseData={{ counts }}
          currentData={{ counts }}
        />,
      );

      const tickCallback =
        getLastChartProps().options?.scales?.x?.ticks?.callback;
      expect(
        binEdges.map((edge, index) => tickCallback?.(edge, index, [])),
      ).toEqual(["1M", "1.2M", "1.4M"]);
    });

    it("keeps string labels and values on the pre-existing category path", () => {
      render(<HistogramChart {...defaultProps} dataType="string" />);

      const { data, options } = getLastChartProps();
      expect(data.labels).toEqual([
        "0 - 20",
        "20 - 40",
        "40 - 60",
        "60 - 80",
        "80 - 100",
      ]);
      expect(data.datasets[0].data).toEqual(mockCurrentData.counts);
      expect(data.datasets[1].data).toEqual(mockBaseData.counts);
      expect(options?.scales?.x?.type).toBe("category");
    });

    it("centers datetime points within edge-derived timeseries bounds", () => {
      render(
        <HistogramChart
          {...defaultProps}
          dataType="datetime"
          hideAxis={true}
        />,
      );

      const { data, options } = getLastChartProps();
      expect(data.labels).toEqual([
        "1970-01-01 - 1970-01-01T00:00:00.020Z",
        "1970-01-01T00:00:00.020Z - 1970-01-01T00:00:00.040Z",
        "1970-01-01T00:00:00.040Z - 1970-01-01T00:00:00.060Z",
        "1970-01-01T00:00:00.060Z - 1970-01-01T00:00:00.080Z",
        "1970-01-01T00:00:00.080Z - 1970-01-01T00:00:00.100Z",
      ]);
      expect(data.datasets[0].data).toEqual([
        { x: 10, y: 15 },
        { x: 30, y: 25 },
        { x: 50, y: 35 },
        { x: 70, y: 45 },
        { x: 90, y: 55 },
      ]);
      expect(data.datasets[1].data).toEqual([
        { x: 10, y: 10 },
        { x: 30, y: 20 },
        { x: 50, y: 30 },
        { x: 70, y: 40 },
        { x: 90, y: 50 },
      ]);
      expect(options?.scales?.x).toMatchObject({
        display: false,
        max: 100,
        min: 0,
        type: "timeseries",
      });
    });

    it("formats datetime axis and tooltip ranges as UTC", () => {
      const binEdges = [
        Date.UTC(2026, 0, 1),
        Date.UTC(2026, 0, 2),
        Date.UTC(2026, 0, 3, 12, 30),
      ];
      render(
        <HistogramChart
          {...defaultProps}
          dataType="datetime"
          binEdges={binEdges}
          baseData={{ counts: [2, 3] }}
          currentData={{ counts: [5, 7] }}
        />,
      );

      const { options } = getLastChartProps();
      const tickCallback = options?.scales?.x?.ticks?.callback;
      const titleCallback = options?.plugins?.tooltip?.callbacks?.title;
      expect(tickCallback?.(binEdges[0], 0, [])).toBe("2026-01-01");
      expect(tickCallback?.(binEdges[2], 2, [])).toBe("2026-01-03T12:30:00Z");
      expect(titleCallback?.([{ dataIndex: 1 }])).toBe(
        "Date Range\n2026-01-02 - 2026-01-03T12:30:00Z",
      );
    });

    it("keeps the y-axis maximum finite for empty datasets", () => {
      render(
        <HistogramChart
          {...defaultProps}
          binEdges={[]}
          baseData={{ counts: [] }}
          currentData={{ counts: [] }}
        />,
      );

      expect(getLastChartProps().options?.scales?.y?.max).toBe(0);
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

    it("owns accessible Base and Current semantics on the production chart", () => {
      render(<HistogramChart {...defaultProps} />);

      const chart = screen.getByRole("img", {
        name: "Test Histogram. Histogram comparing Base and Current series. Overlap marks their shared distribution.",
      });
      expect(chart).toHaveTextContent(
        "Test Histogram. Histogram comparing Base and Current series. Overlap marks their shared distribution.",
      );
    });

    it.each(["numeric", "string", "datetime"] as const)(
      "co-locates source datasets for %s histograms",
      (dataType) => {
        render(<HistogramChart {...defaultProps} dataType={dataType} />);

        const { data, options } = getLastChartProps();
        expect(data.datasets).toHaveLength(2);
        expect(
          data.datasets.every((dataset) => dataset.grouped === false),
        ).toBe(true);
        expect(options?.scales?.x?.type).toBe(
          dataType === "datetime"
            ? "timeseries"
            : dataType === "numeric"
              ? "linear"
              : "category",
        );
      },
    );

    it.each(["light", "dark"] as const)(
      "generates the three semantic legend entries in %s mode",
      (theme) => {
        render(<HistogramChart {...defaultProps} theme={theme} />);
        const { chart, pattern } = createLegendChart();
        const { options } = getLastChartProps();
        const generateLabels = options?.plugins?.legend?.labels?.generateLabels;
        expect(typeof generateLabels).toBe("function");

        const labels = generateLabels?.(chart) ?? [];
        const semantic = getSemanticColorTheme(theme === "dark");
        const chartTheme = getChartThemeColors(theme === "dark");
        expect(labels.map(({ text }) => text)).toEqual([
          "Base",
          "Current",
          "Overlap",
        ]);
        expect(labels).toHaveLength(3);
        expect(
          labels.every(({ fontColor }) => fontColor === chartTheme.textColor),
        ).toBe(true);
        expect(labels[0]).toMatchObject({
          fillStyle: semantic.comparison.base.chartFill,
          strokeStyle: semantic.comparison.base.border,
        });
        expect(labels[1]).toMatchObject({
          fillStyle: semantic.comparison.current.chartFill,
          strokeStyle: semantic.comparison.current.border,
        });
        expect(labels[2]).toMatchObject({
          fillStyle: pattern,
          strokeStyle: semantic.categorical.overlap.border,
        });
      },
    );

    it("registers overlap and bin-geometry painters", () => {
      render(<HistogramChart {...defaultProps} />);

      expect(getLastChartProps().plugins?.map(({ id }) => id)).toEqual([
        "histogramOverlap",
        "histogramBinGeometry",
      ]);
    });

    it("reuses one painter instance across theme switches", () => {
      // react-chartjs-2 reads its `plugins` prop only when it builds the chart,
      // so the painter has to be a stable, stateless instance. Anything the
      // theme changes travels in `options`, which does get re-applied.
      const { rerender } = render(
        <HistogramChart {...defaultProps} theme="light" />,
      );
      const light = getLastChartProps().plugins?.[0];
      rerender(<HistogramChart {...defaultProps} theme="dark" />);
      const dark = getLastChartProps().plugins?.[0];

      expect(light?.id).toBe("histogramOverlap");
      expect(light).toBe(dark);
    });

    it.each(["light", "dark"] as const)(
      "hands the %s palette to the painter through chart options",
      (theme) => {
        render(<HistogramChart {...defaultProps} theme={theme} />);
        const semantic = getSemanticColorTheme(theme === "dark");

        expect(
          getLastChartProps().options?.plugins?.histogramOverlap?.palette,
        ).toMatchObject({
          base: semantic.comparison.base,
          canvasBackground: semantic.structural.neutral.background,
          current: semantic.comparison.current,
          overlap: semantic.categorical.overlap,
        });
      },
    );

    it("pins the dataset order the painter and legend index into", () => {
      render(<HistogramChart {...defaultProps} />);
      const { chart } = createLegendChart();
      const { data, options } = getLastChartProps();

      expect(data.datasets.map((dataset) => dataset.label)).toEqual([
        "Current",
        "Base",
      ]);

      const labels =
        options?.plugins?.legend?.labels?.generateLabels?.(chart) ?? [];
      const indexed = labels.filter(
        (label): label is typeof label & { datasetIndex: number } =>
          label.datasetIndex !== undefined,
      );
      expect(indexed).toHaveLength(2);
      for (const { text, datasetIndex } of indexed) {
        expect(data.datasets[datasetIndex]?.label).toBe(text);
      }
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
      const semantic = getSemanticColorTheme(true);
      expect(data.datasets[0].backgroundColor).toBe(
        semantic.comparison.current.chartFill,
      );
      expect(data.datasets[1].backgroundColor).toBe(
        semantic.comparison.base.chartFill,
      );
    });

    it("uses semantic comparison fills with contrast-safe outlines", () => {
      const { getByTestId } = render(<HistogramChart {...defaultProps} />);
      const data = JSON.parse(
        getByTestId("mock-chart").getAttribute("data-data") || "{}",
      );
      const semantic = getSemanticColorTheme(false);

      expect(data.datasets[0]).toMatchObject({
        backgroundColor: semantic.comparison.current.chartFill,
        borderColor: semantic.comparison.current.border,
        borderWidth: 2,
      });
      expect(data.datasets[1]).toMatchObject({
        backgroundColor: semantic.comparison.base.chartFill,
        borderColor: semantic.comparison.base.border,
        borderWidth: 2,
      });
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
    it("creates timestamp/count objects for datetime type", () => {
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

      const currentData = data.datasets[0].data;
      expect(currentData[0]).toEqual({ x: 1704369600000, y: 15 });
    });

    it("uses midpoint coordinate objects for numeric type", () => {
      const { getByTestId } = render(
        <HistogramChart {...defaultProps} dataType="numeric" />,
      );

      const chart = getByTestId("mock-chart");
      const data = JSON.parse(chart.getAttribute("data-data") || "{}");

      // Numeric bars use explicit x coordinates on the linear edge scale.
      const currentData = data.datasets[0].data;
      expect(currentData[0]).toEqual({ x: 10, y: 15 });
    });
  });

  describe("memoization", () => {
    it("has displayName set", () => {
      expect(HistogramChart.displayName).toBe("HistogramChart");
    });
  });
});
