import { useMemo } from "react";

/**
 * Small continuous paired-bar chart for high-cardinality quantitative data
 * (order amounts, latency, file sizes). Sibling of `PairedHistogramDiscreteCell`.
 *
 * Why not reuse `HistogramChart`: HistogramChart unconditionally renders a
 * title row + legend (~50 px overhead). At cell density (h≈36) there is no
 * room left for the bars. HistogramChart still belongs in popover and
 * detail surfaces where its title/legend/tooltip machinery is welcome —
 * just not in a 140×36 grid cell.
 *
 * Differences from `PairedHistogramDiscreteCell`:
 *   - Bars TOUCH (no slot padding). Continuous data should read continuously.
 *   - Labels are endpoint min/max (and optional midpoint), not per-slot.
 */

const BASE_FILL = "#F6AD55A5";
const CURRENT_FILL = "#63B3EDA5";
const CURRENT_STROKE = "#63B3ED";
const BASELINE_RULE = "#9ca3af";
const LABEL_COLOR = "#374151";

export interface ContinuousDistribution {
  /** Uniform bin edges. Length = bins.length + 1. */
  binEdges: number[];
  baseCounts: number[];
  currentCounts: number[];
  baseTotal: number;
  currentTotal: number;
}

export interface PairedHistogramContinuousCellProps {
  data: ContinuousDistribution;
  /** Default 140 (cell). Use ~240 for baseball-card. */
  width?: number;
  /** Default 36 (cell). Use ~92 for baseball-card. */
  height?: number;
  /** Render endpoint labels (min / max). Default false. */
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
      <title>Paired histogram (continuous)</title>

      {baseProps.map((bp, i) => {
        const cp = currProps[i];
        const baseH = (bp / maxProp) * chartHeight;
        const currH = (cp / maxProp) * chartHeight;
        const x = i * slotWidth;
        // Bars touch; tiny -0.25 px inset prevents the alpha values stacking
        // visibly at boundaries between adjacent slots.
        const w = Math.max(0.5, slotWidth - 0.25);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable bin order
          <g key={i}>
            <rect
              x={x}
              y={chartHeight - baseH}
              width={w}
              height={baseH}
              fill={BASE_FILL}
            />
            <rect
              x={x}
              y={chartHeight - currH}
              width={w}
              height={currH}
              fill={CURRENT_FILL}
              stroke={CURRENT_STROKE}
              strokeWidth={0.4}
            />
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
