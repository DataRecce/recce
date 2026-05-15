import { useId, useMemo } from "react";

/**
 * Small continuous paired-bar chart for high-cardinality quantitative data
 * (order amounts, latency, file sizes). Sibling of `PairedHistogramDiscreteCell`.
 *
 * Why not reuse `HistogramChart`: HistogramChart unconditionally renders a
 * title row + legend (~50 px overhead). At cell density (h≈36) there is no
 * room left for the bars. HistogramChart still belongs on popover and
 * detail surfaces where its title/legend/tooltip machinery is welcome —
 * just not in a 140×36 grid cell.
 *
 * Differences from `PairedHistogramDiscreteCell`:
 *   - Bars TOUCH (no slot padding). Continuous data should read continuously.
 *   - Labels are endpoint min/max (and optional midpoint), not per-slot.
 */

// Stacked-bar palette. Each bin draws up to two segments stacked from the
// baseline: a 2×2 checkerboard agreement zone of min(base, current) — orange
// and blue cells alternating, true 50/50 area — then the differential in
// either solid orange (base higher) or solid blue (current higher).
const BASE_FILL = "#F6AD55";
const CURRENT_FILL = "#63B3ED";
const BASELINE_RULE = "#9ca3af";
const LABEL_COLOR = "#374151";

export interface PairedHistogramContinuousData {
  /** Uniform bin edges. Length = bins.length + 1. */
  binEdges: number[];
  baseCounts: number[];
  currentCounts: number[];
  baseTotal: number;
  currentTotal: number;
}

export interface PairedHistogramContinuousCellProps {
  data: PairedHistogramContinuousData;
  /** Default 140 (cell). Use ~240 for baseball-card. */
  width?: number;
  /** Default 36 (cell). Use ~92 for baseball-card. */
  height?: number;
  /** Render endpoint labels (min / max). Default false — bin range shown
   * on hover via the per-bar tooltip; in-chart labels eat too much vertical
   * room at cell density. Enable for the card preset. */
  showEndpoints?: boolean;
  /** Also render midpoint label between min and max. Default false. */
  showMidpoint?: boolean;
  /** Override default label formatter. Default: 1.2K-style abbreviation. */
  formatValue?: (v: number) => string;
}

export function PairedHistogramContinuousCell({
  data,
  width = 140,
  height = 36,
  showEndpoints = false,
  showMidpoint = false,
  formatValue = formatAbbrev,
}: PairedHistogramContinuousCellProps) {
  // SVG pattern IDs are document-global; useId() gives each cell instance
  // its own ID so patterns don't collide between adjacent histograms.
  const reactId = useId();
  const patternId = `paired-histogram-overlap-${reactId.replace(/[:]/g, "")}`;
  const { slotWidth, maxProp, baseProps, currProps, minVal, maxVal } =
    useMemo(() => {
      const baseProps = data.baseCounts.map((c) =>
        data.baseTotal > 0 ? c / data.baseTotal : 0,
      );
      const currProps = data.currentCounts.map((c) =>
        data.currentTotal > 0 ? c / data.currentTotal : 0,
      );
      const slots = baseProps.length;
      return {
        slotWidth: width / Math.max(1, slots),
        maxProp: Math.max(0.001, ...baseProps, ...currProps),
        baseProps,
        currProps,
        minVal: data.binEdges[0],
        maxVal: data.binEdges[data.binEdges.length - 1],
      };
    }, [data, width]);

  const labelHeight = showEndpoints ? 11 : 0;
  const chartHeight = Math.max(8, height - labelHeight - 2);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label="Paired baseline and current continuous distribution"
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
        >
          <rect x={0} y={0} width={2} height={2} fill={BASE_FILL} />
          <rect x={2} y={2} width={2} height={2} fill={BASE_FILL} />
          <rect x={2} y={0} width={2} height={2} fill={CURRENT_FILL} />
          <rect x={0} y={2} width={2} height={2} fill={CURRENT_FILL} />
        </pattern>
      </defs>
      {baseProps.map((bp, i) => {
        const cp = currProps[i];
        const baseH = (bp / maxProp) * chartHeight;
        const currH = (cp / maxProp) * chartHeight;
        const minH = Math.min(baseH, currH);
        const maxH = Math.max(baseH, currH);
        const diffFill = baseH > currH ? BASE_FILL : CURRENT_FILL;
        const x = i * slotWidth;
        // Bars touch; tiny -0.25 px inset prevents adjacent bins from
        // visually blurring into one shape.
        const w = Math.max(0.5, slotWidth - 0.25);
        const binLo = data.binEdges[i];
        const binHi = data.binEdges[i + 1];
        const hoverTitle = formatContinuousTooltip(
          binLo,
          binHi,
          bp,
          cp,
          formatValue,
        );
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable bin order
          <g key={i}>
            {/* Invisible hit-target spanning the full slot height so hover
             * picks up the tooltip even on small bars. */}
            <rect
              x={x}
              y={0}
              width={slotWidth}
              height={chartHeight}
              fill="transparent"
            >
              <title>{hoverTitle}</title>
            </rect>
            {minH > 0 && (
              <rect
                x={x}
                y={chartHeight - minH}
                width={w}
                height={minH}
                fill={`url(#${patternId})`}
                pointerEvents="none"
              />
            )}
            {maxH > minH && (
              <rect
                x={x}
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
        stroke={BASELINE_RULE}
        strokeWidth={0.5}
      />

      {showEndpoints && (
        <g
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={9}
          fill={LABEL_COLOR}
        >
          <text x={0} y={height - 1} textAnchor="start">
            {formatValue(minVal)}
          </text>
          {showMidpoint && (
            <text x={width / 2} y={height - 1} textAnchor="middle">
              {formatValue((minVal + maxVal) / 2)}
            </text>
          )}
          <text x={width} y={height - 1} textAnchor="end">
            {formatValue(maxVal)}
          </text>
        </g>
      )}
    </svg>
  );
}

function formatAbbrev(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function formatContinuousTooltip(
  lo: number,
  hi: number,
  baseProp: number,
  currProp: number,
  fmt: (v: number) => string,
): string {
  const bp = `${(baseProp * 100).toFixed(1)}%`;
  const cp = `${(currProp * 100).toFixed(1)}%`;
  return `${fmt(lo)}–${fmt(hi)} [base: ${bp}, current: ${cp}]`;
}
