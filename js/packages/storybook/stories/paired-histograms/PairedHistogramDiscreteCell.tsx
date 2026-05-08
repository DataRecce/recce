import { useMemo } from "react";

/**
 * Small categorical paired-bar chart for the discrete (low-cardinality)
 * data shape — both string-valued (country codes) and numeric-as-label
 * (HTTP status codes). Designed for the schema view's two render targets:
 *
 *   - Cell preset: ~120×40, no labels — fits inline in a grid column.
 *   - Baseball-card preset: ~220×100, with abbreviated labels — primary
 *     visual on a SchemaGalleryView card.
 *
 * Visual: paired bars per category slot, current drawn on top of base with
 * 65% alpha. Divergence reads as color separation where bar heights differ.
 *
 * Lives in the storybook package and is NOT exported via @datarecce/ui.
 * If the design lands, promotion path is to add it under
 * `js/packages/ui/src/components/data/` alongside HistogramChart.
 */

const BASE_FILL = "#F6AD55A5";
const CURRENT_FILL = "#63B3EDA5";
const CURRENT_STROKE = "#63B3ED";
const BASELINE_RULE = "#9ca3af";
const LABEL_COLOR = "#374151";
const TRIM_COLOR = "#9ca3af";

export interface PairedHistogramDiscreteData {
  /** Display order = top-N by max(baseProp, currProp), capped by caller. */
  values: string[];
  baseCounts: number[];
  currentCounts: number[];
  baseTotal: number;
  currentTotal: number;
}

export interface PairedHistogramDiscreteCellProps {
  data: PairedHistogramDiscreteData;
  /** Chart width in px. Default 120 (cell). Use ~220 for baseball-card. */
  width?: number;
  /** Chart height in px including labels. Default 40 (cell). Use ~100 for card. */
  height?: number;
  /** Render value labels below bars. Default false (cell). True for card. */
  showLabels?: boolean;
  /**
   * Set when the caller has already trimmed an oversize distribution down
   * to fit. Renders a faint "trimmed" marker so the user knows the chart
   * isn't the full distribution.
   */
  trimmed?: boolean;
  /** Maximum chars per label before truncation. Default 4. */
  labelMaxChars?: number;
}

export function PairedHistogramDiscreteCell({
  data,
  width = 120,
  height = 40,
  showLabels = false,
  trimmed = false,
  labelMaxChars = 4,
}: PairedHistogramDiscreteCellProps) {
  const { slots, maxProp } = useMemo(() => {
    const baseProp = data.baseCounts.map((c) =>
      data.baseTotal > 0 ? c / data.baseTotal : 0,
    );
    const currProp = data.currentCounts.map((c) =>
      data.currentTotal > 0 ? c / data.currentTotal : 0,
    );
    const slots = data.values.map((value, i) => ({
      value,
      baseProp: baseProp[i],
      currProp: currProp[i],
    }));
    const maxProp = Math.max(0.001, ...baseProp, ...currProp);
    return { slots, maxProp };
  }, [data]);

  const labelHeight = showLabels ? 12 : 0;
  // 2 px breathing room between bars and the next visual element.
  const chartHeight = Math.max(8, height - labelHeight - 2);
  const slotWidth = width / Math.max(1, slots.length);
  // Bars take 80% of the slot — 10% padding each side keeps adjacent slots
  // visually separated even when both base and current are near max.
  const barX = (i: number) => i * slotWidth + slotWidth * 0.1;
  const barW = slotWidth * 0.8;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label="Paired baseline and current categorical distribution"
    >
      <title>Paired histogram (discrete)</title>

      {slots.map((s, i) => {
        const baseH = (s.baseProp / maxProp) * chartHeight;
        const currH = (s.currProp / maxProp) * chartHeight;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          <g key={i}>
            <rect
              x={barX(i)}
              y={chartHeight - baseH}
              width={barW}
              height={baseH}
              fill={BASE_FILL}
            />
            <rect
              x={barX(i)}
              y={chartHeight - currH}
              width={barW}
              height={currH}
              fill={CURRENT_FILL}
              stroke={CURRENT_STROKE}
              strokeWidth={0.5}
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

      {showLabels && (
        <g
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={9}
          fill={LABEL_COLOR}
          textAnchor="middle"
        >
          {slots.map((s, i) => (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: stable order
              key={i}
              x={i * slotWidth + slotWidth / 2}
              y={chartHeight + 9}
            >
              {truncate(s.value, labelMaxChars)}
            </text>
          ))}
        </g>
      )}

      {trimmed && (
        <text
          x={width - 1}
          y={9}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={8}
          fill={TRIM_COLOR}
          textAnchor="end"
        >
          trimmed
        </text>
      )}
    </svg>
  );
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  if (maxChars <= 1) return "…";
  return `${s.slice(0, maxChars - 1)}…`;
}
