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
 * vocabulary is preserved (agreement zone + differential), but bar
 * **width** now varies with the bin's quantile
 * span and bar **height** with density, so the **area** of each bar reads
 * directly as the proportion of rows in that bin.
 *
 * Per-env edges, merged x-grid: base and current are binned on their own
 * quantile edges (that's the only way each stays constant-area — see the
 * PR #1398 discussion). They generally don't line up. Rather than force
 * one env onto the other's edges (which destroys the equal-area property
 * and, in the backend, collapses the two densities into one), we overlay
 * both edge sets onto a **shared value axis** and draw a bar at every
 * segment of the *merged* edge set. Each merged segment falls entirely
 * within one base bin and one current bin, so both densities are constant
 * across it — which lets the original agreement-zone + differential
 * renderer run unchanged on the skinnier segments.
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
  /** Length 12 — base quantile-bin edges. */
  baseBinEdges: number[];
  /** Length 12 — current quantile-bin edges (independent of base's). */
  currentBinEdges: number[];
  /** Length 11 — base density per base bin (count / total / span). */
  baseDensity: number[];
  /** Length 11 — current density per current bin. */
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

interface ContinuousSegment {
  x: number;
  width: number;
  baseDensity: number;
  currentDensity: number;
  lo: number;
  hi: number;
}

/**
 * Density of the bin containing value `v`, or 0 if `v` falls outside the
 * env's range. Edges are ascending; bins are half-open `[edge[i], edge[i+1])`
 * with the final bin closed on the right so the max value lands in-range.
 * Callers only pass segment midpoints, which always sit strictly inside one
 * bin of the env that contributed an edge — so the half-open/closed choice
 * only matters for the other env's out-of-range tails (correctly → 0).
 */
function densityAt(edges: number[], density: number[], v: number): number {
  if (v < edges[0] || v > edges[edges.length - 1]) return 0;
  for (let i = 0; i < density.length; i += 1) {
    if (v >= edges[i] && v < edges[i + 1]) return density[i];
  }
  // v === last edge: belongs to the final bin.
  return density[density.length - 1];
}

/**
 * Compute per-segment x / width / density for the **merged** edge grid.
 *
 * Base and current carry independent quantile edges, so they share no
 * x-slots. We union both edge arrays into one ascending breakpoint set and
 * emit a segment between each consecutive pair. Every segment lies wholly
 * inside one base bin and one current bin, so both densities are constant
 * across it — which is what lets the renderer keep the original
 * agreement-zone (min) + differential (max − min) decomposition.
 *
 * Segments are positioned on a shared value axis spanning the union of both
 * ranges, so widths track quantile span and the **area** of each bar reads
 * as the row-proportion in that segment. Subdividing a bin onto the merged
 * grid preserves its area (sub-segments sum back to the bin's area), so each
 * env stays constant-area overall.
 *
 * File-level export (not in the package barrel) so the unit tests in this
 * directory can validate the geometry without rendering.
 */
export function computeContinuousLayout(
  data: PairedHistogramContinuousData,
  width: number,
): {
  bins: ContinuousSegment[];
  maxDensity: number;
  minVal: number;
  maxVal: number;
} {
  const { baseBinEdges, currentBinEdges, baseDensity, currentDensity } = data;

  // Guard: each env must have N+1 edges for N bins and be internally
  // consistent. Blank only when NEITHER side is usable. A one-sided column —
  // an added column (no base data) or a removed one (no current data) — still
  // renders the side that has data, mirroring the discrete cell's
  // gap-on-absent behavior rather than blanking in a way that reads as "failed"
  // (the backend emits empty edges/density for the absent side).
  const baseValid =
    baseDensity.length > 0 && baseBinEdges.length === baseDensity.length + 1;
  const currValid =
    currentDensity.length > 0 &&
    currentBinEdges.length === currentDensity.length + 1;
  // A side is legitimately "absent" (one-sided column — added/removed) only
  // when BOTH its arrays are empty. A non-empty side whose edge/density lengths
  // don't line up is malformed: treat that as corrupt and blank the whole cell
  // rather than render a half-trusted distribution.
  const baseMalformed =
    !baseValid && (baseBinEdges.length > 0 || baseDensity.length > 0);
  const currMalformed =
    !currValid && (currentBinEdges.length > 0 || currentDensity.length > 0);
  if (baseMalformed || currMalformed || (!baseValid && !currValid)) {
    return { bins: [], maxDensity: 0, minVal: 0, maxVal: 0 };
  }

  // Range + merged edge grid come only from the valid side(s).
  const validEdges = [
    ...(baseValid ? baseBinEdges : []),
    ...(currValid ? currentBinEdges : []),
  ];
  const minVal = Math.min(...validEdges);
  const maxVal = Math.max(...validEdges);
  const totalSpan = maxVal - minVal;

  const bins: ContinuousSegment[] = [];

  // Degenerate range (everything collapsed to a point): fall back to
  // uniform-width slots, index-aligning the two envs' bins, so we still
  // render something visible.
  if (totalSpan <= 0 || !Number.isFinite(totalSpan)) {
    const n = Math.max(baseDensity.length, currentDensity.length);
    const w = width / n;
    for (let i = 0; i < n; i += 1) {
      bins.push({
        x: i * w,
        width: w,
        baseDensity: baseDensity[i] ?? 0,
        currentDensity: currentDensity[i] ?? 0,
        lo: minVal,
        hi: maxVal,
      });
    }
  } else {
    // Merge both edge sets into one ascending, de-duplicated breakpoint
    // array, then emit a segment between each consecutive pair.
    const merged = Array.from(new Set(validEdges)).sort((a, b) => a - b);
    for (let i = 0; i < merged.length - 1; i += 1) {
      const lo = merged[i];
      const hi = merged[i + 1];
      if (hi <= lo) continue;
      const mid = (lo + hi) / 2;
      bins.push({
        x: ((lo - minVal) / totalSpan) * width,
        width: ((hi - lo) / totalSpan) * width,
        baseDensity: baseValid ? densityAt(baseBinEdges, baseDensity, mid) : 0,
        currentDensity: currValid
          ? densityAt(currentBinEdges, currentDensity, mid)
          : 0,
        lo,
        hi,
      });
    }
  }

  // Account for any rounding drift: stretch the last segment to the right
  // edge. Applies in both merged and uniform modes — floating-point
  // accumulation can leave a sub-pixel gap either way.
  if (bins.length > 0) {
    const last = bins[bins.length - 1];
    last.width = Math.max(0, width - last.x);
  }

  const allDensities: number[] = [];
  for (const b of bins) {
    allDensities.push(b.baseDensity, b.currentDensity);
  }
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
