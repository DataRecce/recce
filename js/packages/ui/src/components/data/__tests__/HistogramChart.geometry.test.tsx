import { render } from "@testing-library/react";
import {
  BarController,
  BasicPlatform,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
} from "chart.js";
import { vi } from "vitest";
import { HistogramChart } from "../HistogramChart";

interface CapturedChartProps {
  data: ChartData<"bar">;
  options: ChartOptions<"bar">;
}

interface RenderedBar {
  width: number;
  x: number;
  y: number;
}

const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));

vi.mock("react-chartjs-2", () => ({
  Chart: (props: CapturedChartProps) => {
    chartSpy(props);
    return <div data-testid="captured-chart" />;
  },
}));

ChartJS.register(BarController);

function getLastChartProps(): CapturedChartProps {
  const props = chartSpy.mock.lastCall?.[0] as CapturedChartProps | undefined;
  if (!props) throw new Error("HistogramChart was not rendered");
  return props;
}

function createCanvas() {
  const canvas = { height: 300, width: 600 };
  const context = new Proxy(
    {
      canvas,
      measureText: () => ({ width: 0 }),
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return () => undefined;
      },
      set(target, property, value) {
        Object.assign(target, { [property]: value });
        return true;
      },
    },
  );

  return {
    ...canvas,
    getContext: () => context,
  };
}

describe("HistogramChart numeric geometry", () => {
  it.each([
    { binEdges: [0, 20], counts: [5] },
    { binEdges: [0, 20, 40, 60, 80, 100], counts: [1, 2, 3, 4, 5] },
  ])(
    "spans each $binEdges.length-edge numeric bin without a trailing category",
    ({ binEdges, counts }) => {
      render(
        <HistogramChart
          title="Numeric histogram"
          binEdges={binEdges}
          baseData={{ counts }}
          currentData={{ counts }}
        />,
      );

      const { data, options } = getLastChartProps();
      const chart = new ChartJS(createCanvas() as never, {
        type: "bar",
        data,
        options: {
          ...options,
          animation: false,
          plugins: {
            ...options.plugins,
            legend: { display: false },
            title: { ...options.plugins?.title, display: false },
          },
          responsive: false,
        },
        platform: BasicPlatform,
      });

      try {
        const xScale = chart.scales.x;
        const bars = chart.getDatasetMeta(0).data as unknown as RenderedBar[];
        const lastIndex = counts.length - 1;
        const lastBar = bars[lastIndex];

        expect(xScale.type).toBe("linear");
        expect(xScale.ticks.map(({ value }) => value)).toEqual(binEdges);
        expect(bars).toHaveLength(counts.length);
        expect(chart.getDatasetMeta(1).data).toHaveLength(counts.length);

        for (const [index, bar] of bars.entries()) {
          expect(bar.x - bar.width / 2).toBeCloseTo(
            xScale.getPixelForValue(binEdges[index]),
            6,
          );
          expect(bar.x + bar.width / 2).toBeCloseTo(
            xScale.getPixelForValue(binEdges[index + 1]),
            6,
          );
        }

        chart.tooltip?.setActiveElements(
          [{ datasetIndex: 0, index: lastIndex }],
          { x: lastBar.x, y: lastBar.y },
        );
        expect(
          chart.tooltip?.dataPoints.map(({ dataIndex }) => dataIndex),
        ).toEqual([lastIndex]);
        expect(chart.tooltip?.title).toEqual([
          "Value Range",
          `${binEdges.at(-2)} - ${binEdges.at(-1)}`,
        ]);
      } finally {
        chart.destroy();
      }
    },
  );
});
