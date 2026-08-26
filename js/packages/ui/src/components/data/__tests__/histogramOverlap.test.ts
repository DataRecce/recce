import type {
  Chart,
  ChartEvent,
  LegendElement,
  LegendItem,
  Plugin,
} from "chart.js";
import { describe, expect, it, vi } from "vitest";
import { getSemanticColorTheme } from "../../../theme";
import {
  createHistogramLegendLabels,
  type HistogramOverlapPalette,
  handleHistogramLegendClick,
  histogramOverlapPlugin,
} from "../histogramOverlap";

interface BarGeometry {
  x: number;
  y: number;
  width: number;
  base: number;
}

interface FakeContext {
  context: CanvasRenderingContext2D;
  createPattern: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  pattern: CanvasPattern;
  tileContext: {
    fillRect: ReturnType<typeof vi.fn>;
    stroke: ReturnType<typeof vi.fn>;
    fillStyle: string;
  };
  compositeOperations: string[];
}

const semantic = getSemanticColorTheme(false);
const palette: HistogramOverlapPalette = {
  base: semantic.comparison.base,
  canvasBackground: semantic.structural.neutral.background,
  current: semantic.comparison.current,
  legendText: "#123456",
  overlap: semantic.categorical.overlap,
};

function createFakeContext(): FakeContext {
  const pattern = {} as CanvasPattern;
  const tileContext = {
    beginPath: vi.fn(),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    stroke: vi.fn(),
    fillStyle: "",
    lineWidth: 0,
    strokeStyle: "",
  };
  const tile = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => tileContext),
  };
  const createPattern = vi.fn(() => pattern);
  const compositeOperations: string[] = [];
  let compositeOperation = "source-over";
  const rawContext = {
    canvas: {
      ownerDocument: {
        createElement: vi.fn(() => tile),
      },
    },
    createPattern,
    fillRect: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    fillStyle: "",
  };
  Object.defineProperty(rawContext, "globalCompositeOperation", {
    configurable: true,
    get: () => compositeOperation,
    set: (value: string) => {
      compositeOperation = value;
      compositeOperations.push(value);
    },
  });

  return {
    context: rawContext as unknown as CanvasRenderingContext2D,
    createPattern,
    fillRect: rawContext.fillRect,
    pattern,
    tileContext,
    compositeOperations,
  };
}

function createBar(geometry: BarGeometry) {
  return {
    getProps: vi.fn(() => geometry),
  };
}

const PLOT_AREA = { left: 0, top: 0, right: 400, bottom: 200 };

function createChart({
  baseBars = [createBar({ x: 20, y: 25, width: 14, base: 100 })],
  currentBars = [createBar({ x: 20, y: 40, width: 10, base: 100 })],
  visible = [true, true],
  chartArea = PLOT_AREA,
}: {
  baseBars?: ReturnType<typeof createBar>[];
  currentBars?: ReturnType<typeof createBar>[];
  visible?: [boolean, boolean];
  chartArea?: typeof PLOT_AREA;
} = {}) {
  const fakeContext = createFakeContext();
  const hide = vi.fn();
  const show = vi.fn();
  const chart = {
    chartArea,
    ctx: fakeContext.context,
    getDatasetMeta: vi.fn((index: number) => ({
      data: index === 0 ? currentBars : baseBars,
    })),
    hide,
    isDatasetVisible: vi.fn((index: number) => visible[index] ?? false),
    show,
  } as unknown as Chart<"bar">;

  return { chart, fakeContext, hide, show };
}

type OverlapPluginOptions = { palette: HistogramOverlapPalette } | undefined;

function drawWithOptions(chart: Chart<"bar">, options: OverlapPluginOptions) {
  const plugin: Plugin<"bar", { palette: HistogramOverlapPalette }> =
    histogramOverlapPlugin;
  const afterDatasetsDraw = plugin.afterDatasetsDraw;
  expect(typeof afterDatasetsDraw).toBe("function");
  (
    afterDatasetsDraw as (
      target: Chart<"bar">,
      args: unknown,
      pluginOptions: OverlapPluginOptions,
    ) => void
  )(chart, {}, options);
}

function draw(chart: Chart<"bar">) {
  drawWithOptions(chart, { palette });
}

describe("histogram overlap legend", () => {
  it("generates exactly Base, Current, and Overlap with matching encodings", () => {
    const { chart, fakeContext } = createChart();

    const labels = createHistogramLegendLabels(
      chart,
      { base: "Base", current: "Current" },
      palette,
    );

    expect(labels.map(({ text }) => text)).toEqual([
      "Base",
      "Current",
      "Overlap",
    ]);
    expect(labels).toHaveLength(3);
    expect(
      labels.every(({ fontColor }) => fontColor === palette.legendText),
    ).toBe(true);
    expect(labels[0]).toMatchObject({
      datasetIndex: 1,
      fillStyle: palette.base.chartFill,
      strokeStyle: palette.base.border,
    });
    expect(labels[1]).toMatchObject({
      datasetIndex: 0,
      fillStyle: palette.current.chartFill,
      strokeStyle: palette.current.border,
    });
    expect(labels[2]).toMatchObject({
      fillStyle: fakeContext.pattern,
      hidden: false,
      lineWidth: 2,
      strokeStyle: palette.overlap.border,
    });
    expect(labels[2]).not.toHaveProperty("datasetIndex");
    expect(fakeContext.createPattern).toHaveBeenCalledTimes(1);
    expect(fakeContext.tileContext.fillRect).toHaveBeenCalled();
    expect(fakeContext.tileContext.stroke).toHaveBeenCalled();
  });

  it("marks Overlap hidden when either source dataset is hidden", () => {
    const { chart } = createChart({ visible: [true, false] });

    const labels = createHistogramLegendLabels(
      chart,
      { base: "Base", current: "Current" },
      palette,
    );

    expect(labels[2]?.hidden).toBe(true);
  });

  it("ignores Overlap clicks and preserves Base/Current visibility toggles", () => {
    const { chart, hide, show } = createChart({ visible: [false, true] });
    const legend = { chart } as LegendElement<"bar">;
    const event = {} as ChartEvent;
    const overlap: LegendItem = { text: "Overlap" };
    const base: LegendItem = { text: "Base", datasetIndex: 1 };
    const current: LegendItem = { text: "Current", datasetIndex: 0 };

    handleHistogramLegendClick(event, overlap, legend);
    expect(hide).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();

    handleHistogramLegendClick(event, base, legend);
    expect(hide).toHaveBeenCalledWith(1);
    expect(base.hidden).toBe(true);

    handleHistogramLegendClick(event, current, legend);
    expect(show).toHaveBeenCalledWith(0);
    expect(current.hidden).toBe(false);
  });
});

describe("histogram overlap painter", () => {
  it("replaces the true current-geometry intersection with the crosshatch", () => {
    const currentBar = createBar({ x: 20, y: 40, width: 10, base: 100 });
    const baseBar = createBar({ x: 20, y: 25, width: 14, base: 100 });
    const { chart, fakeContext } = createChart({
      baseBars: [baseBar],
      currentBars: [currentBar],
    });

    draw(chart);

    expect(fakeContext.fillRect).toHaveBeenCalledWith(15, 40, 10, 60);
    expect(fakeContext.compositeOperations).not.toContain("copy");
    expect(fakeContext.tileContext.fillStyle).toBe("rgb(171 146 226)");
    expect(currentBar.getProps).toHaveBeenCalledWith(
      ["x", "y", "width", "base"],
      false,
    );
    expect(baseBar.getProps).toHaveBeenCalledWith(
      ["x", "y", "width", "base"],
      false,
    );
  });

  it.each([
    {
      name: "Current is hidden",
      visible: [false, true] as [boolean, boolean],
      current: { x: 20, y: 40, width: 10, base: 100 },
      base: { x: 20, y: 25, width: 14, base: 100 },
    },
    {
      name: "Base is hidden",
      visible: [true, false] as [boolean, boolean],
      current: { x: 20, y: 40, width: 10, base: 100 },
      base: { x: 20, y: 25, width: 14, base: 100 },
    },
    {
      name: "horizontal ranges do not intersect",
      visible: [true, true] as [boolean, boolean],
      current: { x: 10, y: 40, width: 4, base: 100 },
      base: { x: 30, y: 25, width: 4, base: 100 },
    },
    {
      name: "one bar has zero height",
      visible: [true, true] as [boolean, boolean],
      current: { x: 20, y: 100, width: 10, base: 100 },
      base: { x: 20, y: 25, width: 14, base: 100 },
    },
    {
      name: "geometry is non-finite",
      visible: [true, true] as [boolean, boolean],
      current: { x: Number.NaN, y: 40, width: 10, base: 100 },
      base: { x: 20, y: 25, width: 14, base: 100 },
    },
  ])("does not paint when $name", ({ visible, current, base }) => {
    const { chart, fakeContext } = createChart({
      baseBars: [createBar(base)],
      currentBars: [createBar(current)],
      visible,
    });

    draw(chart);

    expect(fakeContext.fillRect).not.toHaveBeenCalled();
  });

  it("clamps the overlap rect to the plot area", () => {
    // A bar taller and wider than the plot area must not bleed over the axes,
    // title or legend: afterDatasetsDraw runs outside chart.js's dataset clip.
    const { chart, fakeContext } = createChart({
      baseBars: [createBar({ x: 200, y: -500, width: 1000, base: 900 })],
      currentBars: [createBar({ x: 200, y: -400, width: 800, base: 800 })],
    });

    draw(chart);

    expect(fakeContext.fillRect).toHaveBeenCalledWith(0, 0, 400, 200);
  });

  it("does not paint chart.js off-scale bar geometry over the plot area", () => {
    // Floating-bar datasets (the dataType="datetime" path) report -32768 for
    // values chart.js cannot place, which intersects to a ~33,000px rect.
    const offScale = { x: -32768, y: -32768, width: 517.3, base: 170.8 };
    const { chart, fakeContext } = createChart({
      baseBars: [createBar(offScale)],
      currentBars: [createBar(offScale)],
    });

    draw(chart);

    expect(fakeContext.fillRect).not.toHaveBeenCalled();
  });

  it("does not paint when no palette is supplied", () => {
    const { chart, fakeContext } = createChart();

    drawWithOptions(chart, undefined);

    expect(fakeContext.fillRect).not.toHaveBeenCalled();
    expect(fakeContext.createPattern).not.toHaveBeenCalled();
  });

  it("bounds painting to the shorter metadata array", () => {
    const currentBars = [
      createBar({ x: 20, y: 40, width: 10, base: 100 }),
      createBar({ x: 40, y: 30, width: 10, base: 100 }),
    ];
    const baseBars = [createBar({ x: 20, y: 25, width: 14, base: 100 })];
    const { chart, fakeContext } = createChart({ baseBars, currentBars });

    draw(chart);

    expect(fakeContext.fillRect).toHaveBeenCalledTimes(1);
    expect(currentBars[1]?.getProps).not.toHaveBeenCalled();
  });
});
