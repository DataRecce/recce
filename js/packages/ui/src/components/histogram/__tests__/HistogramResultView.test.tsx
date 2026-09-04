import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { theme } from "../../../theme";
import type { HistogramDiffRun } from "../HistogramResultView";
import { HistogramDiffResultView } from "../HistogramResultView";

interface MockChartProps {
  data: { labels?: unknown[]; datasets: { data: unknown[] }[] };
  options?: {
    scales?: {
      x?: {
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
    };
  };
}

const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));

vi.mock("react-chartjs-2", () => ({
  Chart: (props: MockChartProps) => {
    chartSpy(props);
    return <div data-testid="histogram-chart" />;
  },
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  BarElement: {},
  CategoryScale: {},
  Legend: {},
  LinearScale: {},
  TimeSeriesScale: {},
  Title: {},
  Tooltip: {},
}));

vi.mock("chartjs-adapter-date-fns", () => ({}));

vi.mock("../../../hooks", () => ({
  useIsDark: () => false,
}));

vi.mock("../../data/ScreenshotDataGrid", () => ({
  EmptyRowsRenderer: () => null,
  ScreenshotDataGrid: () => null,
}));

vi.mock("../../ui/ScreenshotBox", () => ({
  ScreenshotBox: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

function getLastChartProps(): MockChartProps {
  const props = chartSpy.mock.lastCall?.[0] as MockChartProps | undefined;
  if (!props) throw new Error("HistogramChart was not rendered");
  return props;
}

describe("HistogramDiffResultView", () => {
  it("passes numeric edges through to terminal-aware chart ticks", () => {
    const run: HistogramDiffRun = {
      type: "histogram_diff",
      run_id: "histogram-run",
      run_at: "2026-08-25T00:00:00Z",
      status: "Finished",
      params: {
        model: "orders",
        column_name: "amount",
        column_type: "numeric",
      },
      result: {
        base: { counts: [4, 3, 2, 1, 0], total: 10 },
        current: { counts: [0, 1, 2, 3, 4], total: 10 },
        min: 0,
        max: 100,
        bin_edges: [0, 20, 40, 60, 80, 100],
      },
    };

    render(
      <ThemeProvider theme={theme}>
        <HistogramDiffResultView run={run} />
      </ThemeProvider>,
    );

    const { data, options } = getLastChartProps();
    const tickCallback = options?.scales?.x?.ticks?.callback;
    expect(data.labels).toEqual([]);
    expect(data.datasets[0].data).toHaveLength(5);
    expect(data.datasets[1].data).toHaveLength(5);
    expect(options?.scales?.x).toMatchObject({
      max: 100,
      min: 0,
      type: "linear",
    });
    expect(tickCallback?.(100, 5, [])).toBe("100");
  });

  it.each([
    "DATE",
    "date",
    "DATETIME",
    "DATETIME(6)",
    "TIMESTAMP",
    "TIMESTAMP(6)",
    "YEAR",
    "DATETIME2",
    "SMALLDATETIME",
    "DATETIMEOFFSET",
    "INTERVAL",
    "TIMESTAMPTZ",
    "TIMESTAMPTZ(6)",
    "TIMESTAMP WITH TIME ZONE",
    "timestamp without time zone",
    " timestamp ( 6 ) with time zone ",
    "TIMESTAMP WITH LOCAL TIME ZONE",
    "TIMESTAMP_LTZ",
    "TIMESTAMP_NTZ",
    "TIMESTAMP_TZ",
  ])("normalizes %s ISO wire values at the chart boundary", (columnType) => {
    const run: HistogramDiffRun = {
      type: "histogram_diff",
      run_id: "temporal-histogram-run",
      run_at: "2026-08-25T00:00:00Z",
      status: "Finished",
      params: {
        model: "orders",
        column_name: "created_at",
        column_type: columnType,
      },
      result: {
        base: { counts: [2, 3], total: 5 },
        current: { counts: [5, 7], total: 12 },
        min: "2026-01-01T00:00:00.000Z",
        max: "2026-01-03T00:00:00.000Z",
        bin_edges: ["2026-01-01", "2026-01-02", "2026-01-03"],
      },
    };

    render(
      <ThemeProvider theme={theme}>
        <HistogramDiffResultView run={run} />
      </ThemeProvider>,
    );

    const { data, options } = getLastChartProps();
    expect(options?.scales?.x).toMatchObject({
      min: Date.UTC(2026, 0, 1),
      max: Date.UTC(2026, 0, 3),
      type: "timeseries",
    });
    expect(data.datasets[0].data).toEqual([
      { x: Date.UTC(2026, 0, 1), y: 5 },
      { x: Date.UTC(2026, 0, 2), y: 7 },
    ]);
  });
});
