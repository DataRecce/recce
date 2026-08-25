import type { ChartType, Element, Plugin } from "chart.js";

export interface HistogramBinGeometryPluginOptions {
  binEdges: number[];
}

declare module "chart.js" {
  interface PluginOptionsByType<TType extends ChartType> {
    histogramBinGeometry?: HistogramBinGeometryPluginOptions;
  }
}

interface BarGeometry {
  hidden: boolean;
  inXRange(mouseX: number): boolean;
  skip: boolean;
  width: number;
  x: number;
}

function setBarGeometry(
  bar: Element,
  left: number,
  right: number,
  includeRightEdge: boolean,
): void {
  const geometry = bar as unknown as BarGeometry;
  if (!Number.isFinite(left) || !Number.isFinite(right) || right <= left) {
    geometry.hidden = true;
    geometry.inXRange = () => false;
    geometry.skip = true;
    geometry.width = 0;
    return;
  }

  geometry.hidden = false;
  geometry.inXRange = (mouseX) =>
    mouseX >= left && (includeRightEdge ? mouseX <= right : mouseX < right);
  geometry.skip = false;
  geometry.x = (left + right) / 2;
  geometry.width = right - left;
}

/**
 * Aligns each numeric histogram bar with the literal edge pair that defines it.
 * Chart.js normally gives every ungrouped bar a shared minimum width, which is
 * incorrect when valid histogram bins have different widths.
 */
export const histogramBinGeometryPlugin: Plugin<
  "bar",
  HistogramBinGeometryPluginOptions
> = {
  id: "histogramBinGeometry",
  afterDatasetUpdate(_chart, { meta }, options) {
    const binEdges = options?.binEdges;
    const xScale = meta.xScale;
    if (!binEdges || !xScale || xScale.axis !== "x") return;

    for (const [index, bar] of meta.data.entries()) {
      const lower = binEdges[index];
      const upper = binEdges[index + 1];
      setBarGeometry(
        bar,
        xScale.getPixelForValue(lower),
        xScale.getPixelForValue(upper),
        index === meta.data.length - 1,
      );
    }
  },
};
