import { render } from "@testing-library/react";
import {
  BarController,
  BasePlatform,
  BasicPlatform,
  type ChartData,
  Chart as ChartJS,
  type ChartOptions,
  type Plugin,
} from "chart.js";
import { vi } from "vitest";
import { HistogramChart } from "../HistogramChart";

interface CapturedChartProps {
  data: ChartData<"bar">;
  options: ChartOptions<"bar">;
  plugins?: Plugin<"bar">[];
}

interface RenderedBar {
  $animations?: {
    base?: { active(): boolean };
    height?: { active(): boolean };
    width?: { active(): boolean };
    x?: { active(): boolean };
    y?: { active(): boolean };
  };
  hidden: boolean;
  width: number;
  x: number;
  y: number;
}

const { chartSpy } = vi.hoisted(() => ({ chartSpy: vi.fn() }));

class AnimationPlatform extends BasePlatform {
  acquireContext(
    canvas: HTMLCanvasElement,
    _options?: CanvasRenderingContext2DSettings,
  ): CanvasRenderingContext2D | null {
    return canvas.getContext("2d");
  }
}

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
    { binEdges: [0, 1, 10], counts: [3, 7] },
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

      const { data, options, plugins } = getLastChartProps();
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
        plugins: plugins?.filter(({ id }) => id === "histogramBinGeometry"),
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

  it("hides a degenerate interval instead of drawing a positive-width bar", () => {
    const binEdges = [0, 0, 10];
    const counts = [3, 7];
    render(
      <HistogramChart
        title="Degenerate histogram"
        binEdges={binEdges}
        baseData={{ counts }}
        currentData={{ counts }}
      />,
    );

    const { data, options, plugins } = getLastChartProps();
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
      plugins: plugins?.filter(({ id }) => id === "histogramBinGeometry"),
      platform: BasicPlatform,
    });

    try {
      const currentBars = chart.getDatasetMeta(0)
        .data as unknown as RenderedBar[];
      const baseBars = chart.getDatasetMeta(1).data as unknown as RenderedBar[];

      expect(currentBars[0]).toMatchObject({ hidden: true, width: 0 });
      expect(baseBars[0]).toMatchObject({ hidden: true, width: 0 });
      expect(currentBars[1].hidden).toBe(false);
      expect(baseBars[1].hidden).toBe(false);
    } finally {
      chart.destroy();
    }
  });

  it("preserves non-uniform edges after the supported animation completes", async () => {
    const binEdges = [0, 1, 10];
    const counts = [3, 7];
    render(
      <HistogramChart
        title="Animated histogram"
        animate={true}
        binEdges={binEdges}
        baseData={{ counts }}
        currentData={{ counts }}
      />,
    );

    const { data, options, plugins } = getLastChartProps();
    expect(options.animation).toBeUndefined();
    expect(options.animations).toEqual({
      numbers: { properties: ["y", "base", "height"] },
    });

    let completeAnimation: () => void = () => undefined;
    const animationComplete = new Promise<void>((resolve) => {
      completeAnimation = resolve;
    });
    const chart = new ChartJS(createCanvas() as never, {
      type: "bar",
      data,
      options: {
        ...options,
        animation: { duration: 20, onComplete: completeAnimation },
        plugins: {
          ...options.plugins,
          legend: { display: false },
          title: { ...options.plugins?.title, display: false },
        },
        responsive: false,
      },
      plugins: plugins?.filter(({ id }) => id === "histogramBinGeometry"),
      platform: AnimationPlatform,
    });

    try {
      const initialBars = chart.getDatasetMeta(0)
        .data as unknown as RenderedBar[];
      expect(initialBars.some((bar) => bar.$animations?.y?.active())).toBe(
        true,
      );
      for (const bar of initialBars) {
        expect(bar.$animations?.x).toBeUndefined();
        expect(bar.$animations?.width).toBeUndefined();
      }

      await animationComplete;
      const xScale = chart.scales.x;

      for (const datasetIndex of [0, 1]) {
        const bars = chart.getDatasetMeta(datasetIndex)
          .data as unknown as RenderedBar[];
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
      }
    } finally {
      chart.destroy();
    }
  });

  it("keeps degenerate intervals hidden after animations complete", async () => {
    const binEdges = [0, 0, 10];
    const counts = [3, 7];
    render(
      <HistogramChart
        title="Animated degenerate histogram"
        animate={true}
        binEdges={binEdges}
        baseData={{ counts }}
        currentData={{ counts }}
      />,
    );

    const { data, options, plugins } = getLastChartProps();
    let completeAnimation: () => void = () => undefined;
    const animationComplete = new Promise<void>((resolve) => {
      completeAnimation = resolve;
    });
    const chart = new ChartJS(createCanvas() as never, {
      type: "bar",
      data,
      options: {
        ...options,
        animation: { duration: 20, onComplete: completeAnimation },
        plugins: {
          ...options.plugins,
          legend: { display: false },
          title: { ...options.plugins?.title, display: false },
        },
        responsive: false,
      },
      plugins: plugins?.filter(({ id }) => id === "histogramBinGeometry"),
      platform: AnimationPlatform,
    });

    try {
      await animationComplete;
      for (const datasetIndex of [0, 1]) {
        const bars = chart.getDatasetMeta(datasetIndex)
          .data as unknown as RenderedBar[];
        expect(bars[0]).toMatchObject({ hidden: true, width: 0 });
        expect(bars[1].hidden).toBe(false);
      }
    } finally {
      chart.destroy();
    }
  });
});
