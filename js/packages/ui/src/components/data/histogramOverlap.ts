import type {
  Chart,
  ChartEvent,
  ChartType,
  Color,
  Element,
  LegendElement,
  LegendItem,
  Plugin,
} from "chart.js";
// Imported from the leaf module rather than the theme barrel: the barrel
// re-exports from components/data, and this file is inside components/data.
import {
  compositeHex,
  type SemanticColorChannel,
} from "../../theme/semanticColors";

const CURRENT_DATASET_INDEX = 0;
const BASE_DATASET_INDEX = 1;
const BAR_GEOMETRY_KEYS = ["x", "y", "width", "base"] as const;
const PATTERN_SIZE = 8;

interface BarGeometry {
  x: number;
  y: number;
  width: number;
  base: number;
}

interface OverlapRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CachedPattern {
  key: string;
  pattern: CanvasPattern;
}

export interface HistogramOverlapPalette {
  base: Pick<SemanticColorChannel, "border" | "chartFill">;
  canvasBackground: string;
  current: Pick<SemanticColorChannel, "border" | "chartFill">;
  legendText: string;
  overlap: Pick<SemanticColorChannel, "border" | "chartFill" | "foreground">;
}

export interface HistogramOverlapPluginOptions {
  palette: HistogramOverlapPalette;
}

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    histogramOverlap?: HistogramOverlapPluginOptions;
  }
}

const patternCache = new WeakMap<CanvasRenderingContext2D, CachedPattern>();

function createOverlapPattern(
  context: CanvasRenderingContext2D,
  palette: HistogramOverlapPalette,
): Color {
  const { overlap } = palette;
  const key = `${overlap.chartFill}:${overlap.foreground}:${palette.canvasBackground}`;
  const cached = patternCache.get(context);
  if (cached?.key === key) return cached.pattern;

  const opaqueOverlapFill = compositeHex(
    overlap.chartFill,
    palette.canvasBackground,
  );

  const tile = context.canvas.ownerDocument.createElement("canvas");
  tile.width = PATTERN_SIZE;
  tile.height = PATTERN_SIZE;
  const tileContext = tile.getContext("2d");
  if (!tileContext) return opaqueOverlapFill;

  tileContext.fillStyle = opaqueOverlapFill;
  tileContext.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE);
  tileContext.strokeStyle = overlap.foreground;
  tileContext.lineWidth = 1;
  tileContext.beginPath();
  // Two diagonal families, each drawn twice one tile-period apart so the
  // strokes line up across tile edges when the pattern repeats.
  tileContext.moveTo(-2, 0);
  tileContext.lineTo(PATTERN_SIZE, PATTERN_SIZE + 2);
  tileContext.moveTo(PATTERN_SIZE - 4, -2);
  tileContext.lineTo(PATTERN_SIZE + 2, 4);
  tileContext.moveTo(PATTERN_SIZE + 2, 0);
  tileContext.lineTo(0, PATTERN_SIZE + 2);
  tileContext.moveTo(4, -2);
  tileContext.lineTo(-2, 4);
  tileContext.stroke();

  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) return opaqueOverlapFill;

  patternCache.set(context, { key, pattern });
  return pattern;
}

function readBarGeometry(element: Element): BarGeometry | undefined {
  const geometry = element.getProps(
    [...BAR_GEOMETRY_KEYS],
    false,
  ) as BarGeometry;
  const values = [geometry.x, geometry.y, geometry.width, geometry.base];
  if (!values.every(Number.isFinite) || geometry.width <= 0) return undefined;
  return geometry;
}

function intersectBars(
  current: BarGeometry,
  base: BarGeometry,
): OverlapRect | undefined {
  const left = Math.max(current.x - current.width / 2, base.x - base.width / 2);
  const right = Math.min(
    current.x + current.width / 2,
    base.x + base.width / 2,
  );
  const top = Math.max(
    Math.min(current.y, current.base),
    Math.min(base.y, base.base),
  );
  const bottom = Math.min(
    Math.max(current.y, current.base),
    Math.max(base.y, base.base),
  );

  if (right <= left || bottom <= top) return undefined;
  return { left, top, width: right - left, height: bottom - top };
}

export function createHistogramLegendLabels<TType extends ChartType>(
  chart: Chart<TType>,
  labels: { base: string; current: string },
  palette: HistogramOverlapPalette,
): LegendItem[] {
  const currentVisible = chart.isDatasetVisible(CURRENT_DATASET_INDEX);
  const baseVisible = chart.isDatasetVisible(BASE_DATASET_INDEX);

  return [
    {
      text: labels.base,
      datasetIndex: BASE_DATASET_INDEX,
      fillStyle: palette.base.chartFill,
      fontColor: palette.legendText,
      strokeStyle: palette.base.border,
      lineWidth: 2,
      hidden: !baseVisible,
    },
    {
      text: labels.current,
      datasetIndex: CURRENT_DATASET_INDEX,
      fillStyle: palette.current.chartFill,
      fontColor: palette.legendText,
      strokeStyle: palette.current.border,
      lineWidth: 2,
      hidden: !currentVisible,
    },
    {
      text: "Overlap",
      fillStyle: createOverlapPattern(chart.ctx, palette),
      fontColor: palette.legendText,
      strokeStyle: palette.overlap.border,
      lineWidth: 2,
      hidden: !baseVisible || !currentVisible,
    },
  ];
}

export function handleHistogramLegendClick(
  _event: ChartEvent,
  item: LegendItem,
  legend: LegendElement<"bar">,
): void {
  const { datasetIndex } = item;
  if (datasetIndex === undefined) return;

  const { chart } = legend;
  if (chart.isDatasetVisible(datasetIndex)) {
    chart.hide(datasetIndex);
    item.hidden = true;
  } else {
    chart.show(datasetIndex);
    item.hidden = false;
  }
}

/**
 * Paints the Base/Current overlap with the crosshatch pattern.
 *
 * The palette arrives through `options.plugins.histogramOverlap` instead of a
 * closure on purpose: react-chartjs-2 reads its `plugins` prop only when it
 * constructs the chart, so a plugin that captured the palette would keep the
 * mount-time theme forever and the crosshatch would stay light after a switch
 * to dark. `options` is re-sent on every render and `chart.update()`
 * re-resolves plugin options, so this path follows the theme.
 */
export const histogramOverlapPlugin: Plugin<
  "bar",
  HistogramOverlapPluginOptions
> = {
  id: "histogramOverlap",
  afterDatasetsDraw(chart, _args, options) {
    const palette = options?.palette;
    if (!palette) return;

    if (
      !chart.isDatasetVisible(CURRENT_DATASET_INDEX) ||
      !chart.isDatasetVisible(BASE_DATASET_INDEX)
    ) {
      return;
    }

    const currentBars = chart.getDatasetMeta(CURRENT_DATASET_INDEX).data;
    const baseBars = chart.getDatasetMeta(BASE_DATASET_INDEX).data;
    const length = Math.min(currentBars.length, baseBars.length);
    if (length === 0) return;

    const { ctx } = chart;
    const pattern = createOverlapPattern(ctx, palette);
    ctx.save();
    ctx.fillStyle = pattern;

    // afterDatasetsDraw runs outside chart.js's dataset clip, and bar geometry
    // can sit far off-scale (chart.js reports -32768 for unplottable values),
    // so every rect is clamped to the plot area before it is painted.
    const { left, top, right, bottom } = chart.chartArea;

    for (let index = 0; index < length; index += 1) {
      const current = readBarGeometry(currentBars[index]);
      const base = readBarGeometry(baseBars[index]);
      if (!current || !base) continue;

      const overlap = intersectBars(current, base);
      if (!overlap) continue;
      const x0 = Math.max(overlap.left, left);
      const y0 = Math.max(overlap.top, top);
      const x1 = Math.min(overlap.left + overlap.width, right);
      const y1 = Math.min(overlap.top + overlap.height, bottom);
      if (x1 <= x0 || y1 <= y0) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }

    ctx.restore();
  },
};
