import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { theme } from "../../../theme";
import type { HistogramDiffRun } from "../HistogramResultView";
import { HistogramDiffResultView } from "../HistogramResultView";

interface MockChartProps {
  data: { labels?: number[]; datasets: { data: number[] }[] };
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
});
