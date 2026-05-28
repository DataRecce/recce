"use client";

import { useId, useMemo } from "react";
import { useIsDark } from "../../hooks/useIsDark";
import { getChartBarColors, getChartThemeColors } from "../../theme";
import { formatAsAbbreviatedNumber } from "../../utils/formatters";
import {
  BaselineRule,
  CELL_HEIGHT,
  CELL_WIDTH,
  CONTINUOUS_ARIA_LABEL,
  formatProportionTooltip,
  PairedHistogramSvg,
} from "./PairedHistogramCanvas";

/**
 * Small continuous paired-bar chart for high-cardinality quantitative data
 * (order amounts, latency, file sizes) using **constant-area** rendering.
 *
 * This is the GA replacement for the prototype `PairedHistogramContinuousCell`,
 * rewritten for the quantile-bin payload shipped by PR 2. The visual
 * vocabulary is preserved (paired bars per bin, agreement zone +
 * differential), but bar **width** now varies with the bin's quantile
 * span and bar **height** with density, so the **area** of each bar reads
 * directly as the proportion of rows in that bin.
 *
 * Why constant-area: with quantile bins, equal-row-count slots have
 * different widths. Uniform-width rendering would overweight wide,
 * sparse bins. Area = density × span gives every bar the same row-share
 * meaning regardless of bin width.
 *
 * Why not reuse `HistogramChart`: HistogramChart unconditionally renders
 * a title row + legend (~50 px overhead). At cell density (h≈28) there
 * is no room left for the bars. HistogramChart still belongs on popover
 * and detail surfaces where its title/legend/tooltip machinery is welcome —
 * just not in a 140×28 grid cell.
 *
 * Bar palette + theme colors come from `getChartBarColors` /
 * `getChartThemeColors` (canonical in `@datarecce/ui/theme`), so all
 * chart surfaces stay in lockstep.
 */

/**
 * Payload for the continuous cell. Matches `ProfileDistributionHistogramPayload`
 * from the run API (snake_case wire format) so callers can pass results
 * through with minimal adapting.
 */
export interface PairedHistogramContinuousData {
  /** Length 12 quantile-bin edges. */
  binEdges: number[];
  /** Length 11 — base density per bin (count / total / span). */
  baseDensity: number[];
  /** Length 11 — current density per bin. */
  currentDensity: number[];
  baseTotal: number;
  currentTotal: number;
}

export interface PairedHistogramContinuousProps {
  data: PairedHistogramContinuousData;
  /** Override default tooltip-range formatter. Default: 1.2K-style abbreviation. */
  formatValue?: (v: number) => string;
  /** Optional CSS class. */
  className?: string;
}

/**
 * PairedHistogramContinuous — constant-area paired-bar chart, fixed
 * `CELL_WIDTH × CELL_HEIGHT` (140×28) for SchemaView cell density.
 *
 * @example
 * ```tsx
 * <PairedHistogramContinuous data={distribution} />
 * ```
 */
export function PairedHistogramContinuous({
  data,
  formatValue = formatAsAbbreviatedNumber,
  className,
}: PairedHistogramContinuousProps) {
  const isDark = useIsDark();
  const bars = getChartBarColors(isDark);
  const theme = getChartThemeColors(isDark);
  const baseFill = bars.base;
  const currentFill = bars.current;
  const baselineColor = theme.borderColor;

  // SVG pattern IDs are document-global; useId() gives each cell instance
  // its own ID so patterns don't collide between adjacent histograms.
  const reactId = useId();
  const patternId = `phc-overlap-${reactId.replace(/:/g, "")}`;

  const layout = useMemo(() => {
    return computeContinuousLayout(data, CELL_WIDTH);
  }, [data]);

  // 2 px breathing room at the bottom so the baseline doesn't sit flush.
  const chartHeight = Math.max(8, CELL_HEIGHT - 2);

  // Empty / degenerate input — render an empty SVG so size is preserved.
  if (layout.bins.length === 0) {
    return (
      <PairedHistogramSvg
        ariaLabel={CONTINUOUS_ARIA_LABEL}
        className={className}
      />
    );
  }

  return (
    <PairedHistogramSvg ariaLabel={CONTINUOUS_ARIA_LABEL} className={className}>
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
        >
          <rect x={0} y={0} width={2} height={2} fill={baseFill} />
          <rect x={2} y={2} width={2} height={2} fill={baseFill} />
          <rect x={2} y={0} width={2} height={2} fill={currentFill} />
          <rect x={0} y={2} width={2} height={2} fill={currentFill} />
        </pattern>
      </defs>
      {layout.bins.map((bin, i) => {
        const baseH = (bin.baseDensity / layout.maxDensity) * chartHeight;
        const currH = (bin.currentDensity / layout.maxDensity) * chartHeight;
        const minH = Math.min(baseH, currH);
        const maxH = Math.max(baseH, currH);
        const diffFill = baseH > currH ? baseFill : currentFill;
        // Bars touch (continuous data should read continuously); a tiny
        // -0.25 px inset prevents adjacent bins from blurring into one
        // shape at very tight slot widths.
        const w = Math.max(0.5, bin.width - 0.25);
        const hoverTitle = formatContinuousTooltip(bin, formatValue);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable quantile order
          <g key={i}>
            {/* Invisible hit-target spanning the full slot height so hover
             * picks up the tooltip even on very small bars. `fill="none"`
             * + `pointerEvents="all"` keeps the rect pickable without
             * painting any pixels. */}
            <rect
              x={bin.x}
              y={0}
              width={bin.width}
              height={chartHeight}
              fill="none"
              pointerEvents="all"
            >
              <title>{hoverTitle}</title>
            </rect>
            {minH > 0 && (
              <rect
                x={bin.x}
                y={chartHeight - minH}
                width={w}
                height={minH}
                fill={`url(#${patternId})`}
                pointerEvents="none"
              />
            )}
            {maxH > minH && (
              <rect
                x={bin.x}
                y={chartHeight - maxH}
                width={w}
                height={maxH - minH}
                fill={diffFill}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      <BaselineRule y={chartHeight} stroke={baselineColor} />
    </PairedHistogramSvg>
  );
}

/**
 * Compute per-bin x / width / density given a quantile-bin payload and an
 * available chart width. Bars are positioned proportionally to their
 * quantile span — wide bins (sparse regions) get wide bars, narrow bins
 * (dense regions) get narrow bars. Heights remain proportional to density,
 * so the **area** of every bar reads as the row-proportion in that bin.
 *
 * File-level export (not in the package barrel) so the unit tests in this
 * directory can validate the geometry without rendering.
 */
export function computeContinuousLayout(
  data: PairedHistogramContinuousData,
  width: number,
): {
  bins: {
    x: number;
    width: number;
    baseDensity: number;
    currentDensity: number;
    lo: number;
    hi: number;
  }[];
  maxDensity: number;
  minVal: number;
  maxVal: number;
} {
  const { binEdges, baseDensity, currentDensity } = data;

  // Guard: payload must have N+1 edges for N bins, and both density
  // arrays must agree on N. If anything's off, return an empty layout —
  // the renderer falls back to an empty SVG above.
  const binCount = baseDensity.length;
  if (
    binCount === 0 ||
    binCount !== currentDensity.length ||
    binEdges.length !== binCount + 1
  ) {
    return { bins: [], maxDensity: 0, minVal: 0, maxVal: 0 };
  }

  const minVal = binEdges[0];
  const maxVal = binEdges[binEdges.length - 1];
  const totalSpan = maxVal - minVal;

  // Degenerate range (all bins collapsed to a point): fall back to
  // uniform-width slots so we still render something visible.
  const useUniform = totalSpan <= 0 || !Number.isFinite(totalSpan);

  const bins = [];
  let cursor = 0;
  for (let i = 0; i < binCount; i += 1) {
    const lo = binEdges[i];
    const hi = binEdges[i + 1];
    const span = hi - lo;
    const w = useUniform
      ? width / binCount
      : Math.max(0, (span / totalSpan) * width);
    bins.push({
      x: cursor,
      width: w,
      baseDensity: baseDensity[i],
      currentDensity: currentDensity[i],
      lo,
      hi,
    });
    cursor += w;
  }

  // Account for any rounding drift: stretch the last bin to the right edge.
  // Applies in both quantile-proportional and uniform modes — floating-point
  // accumulation can leave a sub-pixel gap either way.
  if (bins.length > 0) {
    const last = bins[bins.length - 1];
    last.width = Math.max(0, width - last.x);
  }

  const allDensities: number[] = [];
  for (const d of baseDensity) allDensities.push(d);
  for (const d of currentDensity) allDensities.push(d);
  const maxDensity = Math.max(1e-9, ...allDensities);

  return { bins, maxDensity, minVal, maxVal };
}

function formatContinuousTooltip(
  bin: {
    lo: number;
    hi: number;
    baseDensity: number;
    currentDensity: number;
  },
  fmt: (v: number) => string,
): string {
  const span = bin.hi - bin.lo;
  // Area = density × span = proportion of rows in this quantile-bin.
  const baseProp = span > 0 ? bin.baseDensity * span : 0;
  const currProp = span > 0 ? bin.currentDensity * span : 0;
  return formatProportionTooltip(
    `${fmt(bin.lo)}–${fmt(bin.hi)}`,
    baseProp,
    currProp,
  );
}
