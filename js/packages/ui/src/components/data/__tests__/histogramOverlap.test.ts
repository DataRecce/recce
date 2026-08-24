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
  createHistogramOverlapPlugin,
  type HistogramOverlapPalette,
  handleHistogramLegendClick,
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
  };
  compositeOperations: string[];
}

const semantic = getSemanticColorTheme(false);
const palette: HistogramOverlapPalette = {
  base: semantic.comparison.base,
  current: semantic.comparison.current,
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

function createChart({
  baseBars = [createBar({ x: 20, y: 25, width: 14, base: 100 })],
  currentBars = [createBar({ x: 20, y: 40, width: 10, base: 100 })],
  visible = [true, true],
}: {
  baseBars?: ReturnType<typeof createBar>[];
  currentBars?: ReturnType<typeof createBar>[];
  visible?: [boolean, boolean];
} = {}) {
  const fakeContext = createFakeContext();
  const hide = vi.fn();
  const show = vi.fn();
  const chart = {
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

function draw(plugin: Plugin<"bar">, chart: Chart<"bar">) {
  const afterDatasetsDraw = plugin.afterDatasetsDraw;
  expect(typeof afterDatasetsDraw).toBe("function");
  (afterDatasetsDraw as (target: Chart<"bar">) => void)(chart);
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

    draw(createHistogramOverlapPlugin(palette), chart);

    expect(fakeContext.fillRect).toHaveBeenCalledWith(15, 40, 10, 60);
    expect(fakeContext.compositeOperations).toContain("copy");
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

    draw(createHistogramOverlapPlugin(palette), chart);

    expect(fakeContext.fillRect).not.toHaveBeenCalled();
  });

  it("bounds painting to the shorter metadata array", () => {
    const currentBars = [
      createBar({ x: 20, y: 40, width: 10, base: 100 }),
      createBar({ x: 40, y: 30, width: 10, base: 100 }),
    ];
    const baseBars = [createBar({ x: 20, y: 25, width: 14, base: 100 })];
    const { chart, fakeContext } = createChart({ baseBars, currentBars });

    draw(createHistogramOverlapPlugin(palette), chart);

    expect(fakeContext.fillRect).toHaveBeenCalledTimes(1);
    expect(currentBars[1]?.getProps).not.toHaveBeenCalled();
  });
});
