import type {
  Chart,
  ChartEvent,
  Color,
  Element,
  LegendElement,
  LegendItem,
  Plugin,
} from "chart.js";
import type { SemanticColorChannel } from "../../theme";

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
  current: Pick<SemanticColorChannel, "border" | "chartFill">;
  overlap: Pick<SemanticColorChannel, "border" | "chartFill" | "foreground">;
}

const patternCache = new WeakMap<CanvasRenderingContext2D, CachedPattern>();

function createOverlapPattern(
  context: CanvasRenderingContext2D,
  palette: HistogramOverlapPalette["overlap"],
): Color {
  const key = `${palette.chartFill}:${palette.foreground}`;
  const cached = patternCache.get(context);
  if (cached?.key === key) return cached.pattern;

  const tile = context.canvas.ownerDocument.createElement("canvas");
  tile.width = PATTERN_SIZE;
  tile.height = PATTERN_SIZE;
  const tileContext = tile.getContext("2d");
  if (!tileContext) return palette.chartFill;

  tileContext.fillStyle = palette.chartFill;
  tileContext.fillRect(0, 0, PATTERN_SIZE, PATTERN_SIZE);
  tileContext.strokeStyle = palette.foreground;
  tileContext.lineWidth = 1;
  tileContext.beginPath();
  tileContext.moveTo(-2, 0);
  tileContext.lineTo(PATTERN_SIZE, PATTERN_SIZE + 2);
  tileContext.moveTo(PATTERN_SIZE - 2, -2);
  tileContext.lineTo(PATTERN_SIZE + 2, 2);
  tileContext.moveTo(PATTERN_SIZE + 2, 0);
  tileContext.lineTo(0, PATTERN_SIZE + 2);
  tileContext.moveTo(2, -2);
  tileContext.lineTo(-2, 2);
  tileContext.stroke();

  const pattern = context.createPattern(tile, "repeat");
  if (!pattern) return palette.chartFill;

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

export function createHistogramLegendLabels(
  chart: Chart<"bar">,
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
      strokeStyle: palette.base.border,
      lineWidth: 2,
      hidden: !baseVisible,
    },
    {
      text: labels.current,
      datasetIndex: CURRENT_DATASET_INDEX,
      fillStyle: palette.current.chartFill,
      strokeStyle: palette.current.border,
      lineWidth: 2,
      hidden: !currentVisible,
    },
    {
      text: "Overlap",
      fillStyle: createOverlapPattern(chart.ctx, palette.overlap),
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

export function createHistogramOverlapPlugin(
  palette: HistogramOverlapPalette,
): Plugin<"bar"> {
  return {
    id: "histogramOverlap",
    afterDatasetsDraw(chart) {
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
      const pattern = createOverlapPattern(ctx, palette.overlap);
      ctx.save();
      ctx.fillStyle = pattern;
      ctx.globalCompositeOperation = "copy";

      for (let index = 0; index < length; index += 1) {
        const current = readBarGeometry(currentBars[index]);
        const base = readBarGeometry(baseBars[index]);
        if (!current || !base) continue;

        const overlap = intersectBars(current, base);
        if (!overlap) continue;
        ctx.fillRect(overlap.left, overlap.top, overlap.width, overlap.height);
      }

      ctx.restore();
    },
  };
}
