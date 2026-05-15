import { useMemo } from "react";

/**
 * Small categorical paired-bar chart for the discrete (low-cardinality)
 * data shape — both string-valued (country codes) and numeric-as-label
 * (HTTP status codes). Cell-density sibling of HistogramChart/TopKBarChart;
 * those keep their place on detail/popover surfaces where title + legend
 * fit.
 *
 * Two render targets, same component:
 *   - Cell preset: ~140×36, no labels — fits inline in a grid column.
 *   - Baseball-card preset: ~220×100, with abbreviated labels — primary
 *     visual on a SchemaGalleryView card.
 *
 * Visual: paired bars per category slot, current drawn on top of base with
 * 65% alpha. Divergence reads as color separation where bar heights differ.
 */

// Paired-bar palette. Each slot renders TWO side-by-side bars: base (orange)
// on the left, current (blue) on the right. A 0% side renders no bar at all,
// leaving a visible gap that reads as "category absent on this side."
const BASE_FILL = "#F6AD55";
const CURRENT_FILL = "#63B3ED";
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
  /** Chart width in px. Default 140 (cell). Use ~220 for baseball-card. */
  width?: number;
  /** Chart height in px including labels. Default 36 (cell). Use ~100 for card. */
  height?: number;
  /** Render value labels below bars. Default false — values shown on hover
   * via the per-bar tooltip; in-chart labels collide at any non-trivial
   * cardinality. True for card preset where there's room. */
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
  width = 140,
  height = 36,
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
      baseCount: data.baseCounts[i],
      currCount: data.currentCounts[i],
    }));
    const maxProp = Math.max(0.001, ...baseProp, ...currProp);
    return { slots, maxProp };
  }, [data]);

  const labelHeight = showLabels ? 12 : 0;
  // 2 px breathing room between bars and the next visual element.
  const chartHeight = Math.max(8, height - labelHeight - 2);
  const slotWidth = width / Math.max(1, slots.length);
  // Slot layout: 10% padding each side, two bars side by side with a small
  // gap. When one side's count is 0, that bar simply doesn't render —
  // leaving a visible gap that signals "category absent on this side."
  const slotPad = slotWidth * 0.1;
  const innerW = slotWidth - slotPad * 2;
  const gap = Math.max(1, Math.min(2, innerW * 0.1));
  const pairBarW = Math.max(1, (innerW - gap) / 2);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label="Paired baseline and current categorical distribution"
    >
      {slots.map((s, i) => {
        const baseH = (s.baseProp / maxProp) * chartHeight;
        const currH = (s.currProp / maxProp) * chartHeight;
        const hoverTitle = formatDiscreteTooltip(s);
        const slotX = i * slotWidth;
        const baseX = slotX + slotPad;
        const currX = slotX + slotPad + pairBarW + gap;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          <g key={i}>
            {/* Invisible hit-target spans the full slot — hovering either
             * bar (or the gap where one is absent) shows the same tooltip
             * identifying this value. */}
            <rect
              x={slotX}
              y={0}
              width={slotWidth}
              height={chartHeight}
              fill="transparent"
            >
              <title>{hoverTitle}</title>
            </rect>
            {baseH > 0 && (
              <rect
                x={baseX}
                y={chartHeight - baseH}
                width={pairBarW}
                height={baseH}
                fill={BASE_FILL}
                pointerEvents="none"
              />
            )}
            {currH > 0 && (
              <rect
                x={currX}
                y={chartHeight - currH}
                width={pairBarW}
                height={currH}
                fill={CURRENT_FILL}
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

function formatDiscreteTooltip(s: {
  value: string;
  baseProp: number;
  currProp: number;
}): string {
  // One value = one bar identity. Always show base + current paired, even
  // when one is 0% — the user reads the divergence directly from the two
  // numbers; "only in X" framing got in the way.
  const bp = `${(s.baseProp * 100).toFixed(1)}%`;
  const cp = `${(s.currProp * 100).toFixed(1)}%`;
  return `${s.value} [base: ${bp}, current: ${cp}]`;
}
