"use client";

import { useMemo } from "react";

/**
 * Small categorical paired-bar chart for top-K low-cardinality data —
 * both string-valued (country codes) and numeric-as-label (HTTP status
 * codes). Cell-density sibling of `HistogramChart`/`TopKBarChart`; those
 * keep their place on detail/popover surfaces where title + legend fit.
 *
 * This is the GA replacement for the prototype `PairedHistogramDiscreteCell`,
 * rewritten for the top-K payload shipped by PR 2.
 *
 * Two render targets, same component:
 *   - Cell preset: ~140×36, no labels — fits inline in a grid column.
 *   - Baseball-card preset: ~220×100, with abbreviated labels — primary
 *     visual on a SchemaGalleryView card.
 *
 * Visual: paired bars per category slot. When one side's count is 0
 * (value absent on that side), that bar simply doesn't render, leaving
 * a visible gap that reads as "category absent on this side." This is
 * the **gap-on-absent** semantic locked in DRC-3390.
 */

const BASE_FILL = "#F6AD55";
const CURRENT_FILL = "#63B3ED";
const BASE_FILL_DARK = "#FBD38D";
const CURRENT_FILL_DARK = "#90CDF4";
const BASELINE_RULE = "#9ca3af";
const BASELINE_RULE_DARK = "#6b7280";
const LABEL_COLOR = "#374151";
const LABEL_COLOR_DARK = "#e5e7eb";
const TRIM_COLOR = "#9ca3af";

/**
 * Payload for the discrete cell. Matches `ProfileDistributionTopKPayload`
 * from the run API (snake_case wire format) so callers can pass results
 * through with minimal adapting.
 */
export interface PairedHistogramDiscreteData {
  /** Display order = union(baseTopK, currentTopK), backend-chosen.
   * Caller may pre-sort (e.g. frequency-desc) for cell density. */
  values: string[];
  baseCounts: number[];
  currentCounts: number[];
  baseTotal: number;
  currentTotal: number;
  /** True when the original distribution had more values than K — caller
   * passes this through from the payload's `trimmed` field. */
  trimmed?: boolean;
}

export interface PairedHistogramDiscreteProps {
  data: PairedHistogramDiscreteData;
  /** Default 140 (cell). Use ~220 for baseball-card. */
  width?: number;
  /** Default 36 (cell). Use ~100 for card. */
  height?: number;
  /** Render value labels below bars. Default false — values shown on hover
   * via the per-bar tooltip; in-chart labels collide at any non-trivial
   * cardinality. True for card preset where there's room. */
  showLabels?: boolean;
  /** Maximum chars per label before truncation. Default 4. */
  labelMaxChars?: number;
  /** Theme — `"dark"` swaps to dark-mode bar/label colors. */
  theme?: "light" | "dark";
  /** Optional CSS class. */
  className?: string;
  /** Accessible label override for the SVG. */
  ariaLabel?: string;
}

/**
 * PairedHistogramDiscrete — paired-bar top-K chart with gap-on-absent
 * semantics.
 *
 * @example Cell density (default)
 * ```tsx
 * <PairedHistogramDiscrete data={topK} />
 * ```
 *
 * @example Baseball-card preset
 * ```tsx
 * <PairedHistogramDiscrete data={topK} width={220} height={100} showLabels />
 * ```
 */
export function PairedHistogramDiscrete({
  data,
  width = 140,
  height = 36,
  showLabels = false,
  labelMaxChars = 4,
  theme = "light",
  className,
  ariaLabel = "Paired baseline and current categorical distribution",
}: PairedHistogramDiscreteProps) {
  const isDark = theme === "dark";
  const baseFill = isDark ? BASE_FILL_DARK : BASE_FILL;
  const currentFill = isDark ? CURRENT_FILL_DARK : CURRENT_FILL;
  const baselineColor = isDark ? BASELINE_RULE_DARK : BASELINE_RULE;
  const labelColor = isDark ? LABEL_COLOR_DARK : LABEL_COLOR;

  const { slots, maxProp } = useMemo(() => {
    return computeDiscreteSlots(data);
  }, [data]);

  const labelHeight = showLabels ? 12 : 0;
  // 2 px breathing room between bars and the next visual element.
  const chartHeight = Math.max(8, height - labelHeight - 2);

  // Empty payload — render the SVG frame so layout stays stable.
  if (slots.length === 0) {
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
      className={className}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      {slots.map((s, i) => {
        const baseH = (s.baseProp / maxProp) * chartHeight;
        const currH = (s.currProp / maxProp) * chartHeight;
        const hoverTitle = formatDiscreteTooltip(s);
        const slotX = i * slotWidth;
        const baseX = slotX + slotPad;
        const currX = slotX + slotPad + pairBarW + gap;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable backend order
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
                fill={baseFill}
                pointerEvents="none"
              />
            )}
            {currH > 0 && (
              <rect
                x={currX}
                y={chartHeight - currH}
                width={pairBarW}
                height={currH}
                fill={currentFill}
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

      {showLabels && (
        <g
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={9}
          fill={labelColor}
          textAnchor="middle"
        >
          {slots.map((s, i) => (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: stable backend order
              key={i}
              x={i * slotWidth + slotWidth / 2}
              y={chartHeight + 9}
            >
              {truncate(s.value, labelMaxChars)}
            </text>
          ))}
        </g>
      )}

      {data.trimmed && (
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

/**
 * Compute per-slot proportions + max prop given a top-K payload.
 *
 * Exported so the layout can be unit-tested without rendering and so
 * PR 4's lineage pre-warm can validate payloads cheaply.
 */
export function computeDiscreteSlots(data: PairedHistogramDiscreteData): {
  slots: {
    value: string;
    baseProp: number;
    currProp: number;
    baseCount: number;
    currCount: number;
  }[];
  maxProp: number;
} {
  const { values, baseCounts, currentCounts, baseTotal, currentTotal } = data;

  // Guard: counts arrays must match values.length. Anything off → empty slots.
  if (
    values.length === 0 ||
    values.length !== baseCounts.length ||
    values.length !== currentCounts.length
  ) {
    return { slots: [], maxProp: 0 };
  }

  const slots = values.map((value, i) => {
    const baseCount = baseCounts[i] ?? 0;
    const currCount = currentCounts[i] ?? 0;
    return {
      value,
      baseCount,
      currCount,
      baseProp: baseTotal > 0 ? baseCount / baseTotal : 0,
      currProp: currentTotal > 0 ? currCount / currentTotal : 0,
    };
  });

  const props: number[] = [];
  for (const s of slots) {
    props.push(s.baseProp);
    props.push(s.currProp);
  }
  const maxProp = Math.max(0.001, ...props);
  return { slots, maxProp };
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
