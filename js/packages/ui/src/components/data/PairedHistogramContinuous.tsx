"use client";

import { useId, useMemo } from "react";

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
 * a title row + legend (~50 px overhead). At cell density (h≈36) there
 * is no room left for the bars. HistogramChart still belongs on popover
 * and detail surfaces where its title/legend/tooltip machinery is welcome —
 * just not in a 140×36 grid cell.
 */

// Stacked-bar palette. Each bin draws up to two segments stacked from the
// baseline: an agreement zone of min(base, current) — a 2×2 SVG-pattern
// checkerboard of orange/blue cells (true 50/50 area, reads as "both
// distributions agree here") — then a single differential rect in either
// solid orange (base higher) or solid blue (current higher).
const BASE_FILL = "#F6AD55";
const CURRENT_FILL = "#63B3ED";
const BASE_FILL_DARK = "#FBD38D";
const CURRENT_FILL_DARK = "#90CDF4";
const BASELINE_RULE = "#9ca3af";
const BASELINE_RULE_DARK = "#6b7280";
const LABEL_COLOR = "#374151";
const LABEL_COLOR_DARK = "#e5e7eb";

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
  /** Default 140 (cell). Use ~240 for baseball-card / popover. */
  width?: number;
  /** Default 36 (cell). Use ~92 for baseball-card. */
  height?: number;
  /** Render endpoint labels (min / max). Default false — bin range is
   * shown on hover via the per-bar tooltip; in-chart labels eat too much
   * vertical room at cell density. Enable for the card preset. */
  showEndpoints?: boolean;
  /** Also render midpoint label between min and max. Default false. */
  showMidpoint?: boolean;
  /** Override default label formatter. Default: 1.2K-style abbreviation. */
  formatValue?: (v: number) => string;
  /** Theme — `"dark"` swaps to dark-mode bar colors / label colors. */
  theme?: "light" | "dark";
  /** Optional CSS class. */
  className?: string;
  /** Accessible label override for the SVG. */
  ariaLabel?: string;
}

/**
 * PairedHistogramContinuous — constant-area paired-bar chart.
 *
 * @example Cell density (default)
 * ```tsx
 * <PairedHistogramContinuous data={distribution} />
 * ```
 *
 * @example Baseball-card preset with endpoint + midpoint labels
 * ```tsx
 * <PairedHistogramContinuous
 *   data={distribution}
 *   width={240}
 *   height={92}
 *   showEndpoints
 *   showMidpoint
 * />
 * ```
 */
export function PairedHistogramContinuous({
  data,
  width = 140,
  height = 36,
  showEndpoints = false,
  showMidpoint = false,
  formatValue = formatAbbrev,
  theme = "light",
  className,
  ariaLabel = "Paired baseline and current continuous distribution",
}: PairedHistogramContinuousProps) {
  const isDark = theme === "dark";
  const baseFill = isDark ? BASE_FILL_DARK : BASE_FILL;
  const currentFill = isDark ? CURRENT_FILL_DARK : CURRENT_FILL;
  const baselineColor = isDark ? BASELINE_RULE_DARK : BASELINE_RULE;
  const labelColor = isDark ? LABEL_COLOR_DARK : LABEL_COLOR;

  // SVG pattern IDs are document-global; useId() gives each cell instance
  // its own ID so patterns don't collide between adjacent histograms.
  const reactId = useId();
  const patternId = `phc-overlap-${reactId.replace(/[:]/g, "")}`;

  const layout = useMemo(() => {
    return computeContinuousLayout(data, width);
  }, [data, width]);

  const labelHeight = showEndpoints ? 11 : 0;
  const chartHeight = Math.max(8, height - labelHeight - 2);

  // Empty / degenerate input — render an empty SVG so size is preserved.
  if (layout.bins.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={className}
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
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
             * picks up the tooltip even on very small bars. */}
            <rect
              x={bin.x}
              y={0}
              width={bin.width}
              height={chartHeight}
              fill="transparent"
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

      <line
        x1={0}
        y1={chartHeight}
        x2={width}
        y2={chartHeight}
        stroke={baselineColor}
        strokeWidth={0.5}
      />

      {showEndpoints && (
        <g
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={9}
          fill={labelColor}
        >
          <text x={0} y={height - 1} textAnchor="start">
            {formatValue(layout.minVal)}
          </text>
          {showMidpoint && (
            <text x={width / 2} y={height - 1} textAnchor="middle">
              {formatValue((layout.minVal + layout.maxVal) / 2)}
            </text>
          )}
          <text x={width} y={height - 1} textAnchor="end">
            {formatValue(layout.maxVal)}
          </text>
        </g>
      )}
    </svg>
  );
}

/**
 * Compute per-bin x / width / density given a quantile-bin payload and an
 * available chart width. Bars are positioned proportionally to their
 * quantile span — wide bins (sparse regions) get wide bars, narrow bins
 * (dense regions) get narrow bars. Heights remain proportional to density,
 * so the **area** of every bar reads as the row-proportion in that bin.
 *
 * Exported so tests + lineage pre-warm (PR 4) can validate the geometry
 * without rendering.
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
  if (bins.length > 0 && !useUniform) {
    const last = bins[bins.length - 1];
    last.width = Math.max(0, width - last.x);
  }

  const allDensities: number[] = [];
  for (const d of baseDensity) allDensities.push(d);
  for (const d of currentDensity) allDensities.push(d);
  const maxDensity = Math.max(1e-9, ...allDensities);

  return { bins, maxDensity, minVal, maxVal };
}

function formatAbbrev(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
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
  const bp = `${(baseProp * 100).toFixed(1)}%`;
  const cp = `${(currProp * 100).toFixed(1)}%`;
  return `${fmt(bin.lo)}–${fmt(bin.hi)} [base: ${bp}, current: ${cp}]`;
}
