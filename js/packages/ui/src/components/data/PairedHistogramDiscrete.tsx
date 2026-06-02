"use client";

import { useMemo } from "react";
import { useIsDark } from "../../hooks/useIsDark";
import { getChartBarColors, getChartThemeColors } from "../../theme";
import {
  BaselineRule,
  CELL_HEIGHT,
  CELL_WIDTH,
  DISCRETE_ARIA_LABEL,
  formatProportionTooltip,
  formatRankTooltip,
  PairedHistogramSvg,
} from "./PairedHistogramCanvas";

/**
 * Small categorical paired-bar chart for top-K low-cardinality data —
 * both string-valued (country codes) and numeric-as-label (HTTP status
 * codes). Cell-density sibling of `HistogramChart`/`TopKBarChart`; those
 * keep their place on detail/popover surfaces where title + legend fit.
 *
 * This is the GA replacement for the prototype `PairedHistogramDiscreteCell`,
 * rewritten for the top-K payload shipped by PR 2.
 *
 * Visual: paired bars per category slot. When one side's count is 0
 * (value absent on that side), that bar simply doesn't render, leaving
 * a visible gap that reads as "category absent on this side." This is
 * the **gap-on-absent** semantic locked in DRC-3390.
 *
 * Two rendering modes share the same slot/bar layout:
 *
 *   - **counts** (default) — bars sized by per-side proportion. Used when
 *     the backend can return both values and counts (e.g. DuckDB
 *     `approx_top_k_counts`, Snowflake `APPROX_TOP_K`).
 *   - **ranks**           — bars sized by rank position only, with
 *     `height = (k - rank + 1) / k * chartHeight`. Used when the engine
 *     only returns top-K values without counts (DuckDB `approx_top_k`).
 *     Stable case reads as two side-by-side descending staircases; an
 *     order shift makes current bars zig-zag against base's clean descent.
 *
 * Stage B's wire contract guarantees both sides use the same algorithm —
 * if either side has no counts, both are returned as rank-only. The cell
 * never has to mix counts on one side with ranks on the other.
 *
 * Bar palette + theme colors come from `getChartBarColors` /
 * `getChartThemeColors` (canonical in `@datarecce/ui/theme`).
 */

/**
 * Counts-mode payload. Matches `ProfileDistributionTopKPayload`
 * from the run API (snake_case wire format) so callers can pass results
 * through with minimal adapting.
 */
export interface PairedHistogramDiscreteCountsData {
  /** Optional discriminator — absent or `"counts"` selects this mode. */
  mode?: "counts";
  /** Display order = union(baseTopK, currentTopK), backend-chosen.
   * Caller may pre-sort (e.g. frequency-desc) for cell density.
   *
   * Element type is `unknown` to match Stage B's wire contract — values
   * may arrive as strings, numbers, booleans, dates, NULL, etc. The
   * renderer routes each value through `formatValue` to produce its
   * display string. */
  values: unknown[];
  baseCounts: number[];
  currentCounts: number[];
  /** Denominator for per-slot proportions. Convention is the **column-wide**
   * row count, not `sum(baseCounts)` — so a trimmed top-K renders bars
   * whose proportions sum to <1 (the missing mass is the long tail). When
   * trimmed is false (or absent), column total and sum-of-shown coincide.
   * Stage B owns the wire-format contract; cells just consume what's passed. */
  baseTotal: number;
  currentTotal: number;
  /** True when the original distribution had more values than K — caller
   * passes this through from the payload's `trimmed` field. */
  trimmed?: boolean;
}

/**
 * Ranks-mode payload — used when the backend cannot return counts (the
 * DuckDB `approx_top_k` path). Bar heights encode rank position only.
 *
 * Slot order is **baked in by the caller**: base's top-K in base-rank
 * order, then values that appear only in current's top-K appended on the
 * right (sorted by current rank ascending). The component renders the
 * `values` array straight through — it does not re-sort.
 */
export interface PairedHistogramDiscreteRanksData {
  /** Discriminator — selects rank-only rendering. */
  mode: "ranks";
  /** Display order = base's top-K in base-rank order, then values
   *  in current's top-K but not base's, sorted by current rank.
   *
   * Element type is `unknown` to match Stage B's wire contract — values
   * may arrive as strings, numbers, booleans, dates, NULL, etc. The
   * renderer routes each value through `formatValue` to produce its
   * display string. */
  values: unknown[];
  /** Per-value rank in base's top-K, 1-indexed. `null` = value not in
   * base's top-K (no base bar drawn for that slot). */
  baseRanks: (number | null)[];
  /** Per-value rank in current's top-K, 1-indexed. `null` = value not
   * in current's top-K (no current bar drawn for that slot). */
  currentRanks: (number | null)[];
  /** Max rank in top-K (e.g. 12). Drives bar-height scaling. */
  k: number;
  /** True when the original distribution had more values than K. */
  trimmed?: boolean;
}

/**
 * Discriminated union of the two supported payload shapes. Counts mode
 * sizes bars by per-side proportion; ranks mode sizes by rank position.
 */
export type PairedHistogramDiscreteData =
  | PairedHistogramDiscreteCountsData
  | PairedHistogramDiscreteRanksData;

export interface PairedHistogramDiscreteProps {
  data: PairedHistogramDiscreteData;
  /**
   * Convert each raw value to its display string. Default: `String(v)`.
   * Override to handle NULL nicely, abbreviate large numbers, format
   * dates, etc.
   *
   * Stage B's payload contract types `values` as `unknown[]`; this hook
   * is the cell's single seam for turning heterogeneous raw values into
   * something legible. Stage C will dispatch on column type and pass the
   * right formatter; the cell itself stays type-blind.
   */
  formatValue?: (v: unknown) => string;
  /** Optional CSS class. */
  className?: string;
}

/**
 * Renderer-agnostic slot shape — the bar heights are pre-resolved so the
 * SVG body doesn't have to know whether they came from proportions or
 * rank positions. `hoverTitle` already carries the formatted display
 * string, so the SVG body never sees the raw `unknown` value.
 */
interface RenderSlot {
  baseH: number;
  currH: number;
  hoverTitle: string;
}

/**
 * PairedHistogramDiscrete — paired-bar top-K chart with gap-on-absent
 * semantics, fixed `CELL_WIDTH × CELL_HEIGHT` (140×28) for SchemaView
 * cell density. Supports counts mode (proportion-sized bars) and ranks
 * mode (rank-position-sized bars).
 *
 * @example
 * ```tsx
 * <PairedHistogramDiscrete data={topK} />
 * ```
 */
export function PairedHistogramDiscrete({
  data,
  formatValue = defaultFormatValue,
  className,
}: PairedHistogramDiscreteProps) {
  const isDark = useIsDark();
  const bars = getChartBarColors(isDark);
  const theme = getChartThemeColors(isDark);
  const baseFill = bars.base;
  const currentFill = bars.current;
  const baselineColor = theme.borderColor;
  const trimColor = theme.secondaryTextColor;

  // 2 px breathing room at the bottom so the baseline doesn't sit flush.
  const chartHeight = Math.max(8, CELL_HEIGHT - 2);

  const renderSlots = useMemo(
    () => computeRenderSlots(data, chartHeight, formatValue),
    [data, chartHeight, formatValue],
  );

  // Empty payload — render the SVG frame so layout stays stable.
  if (renderSlots.length === 0) {
    return (
      <PairedHistogramSvg
        ariaLabel={DISCRETE_ARIA_LABEL}
        className={className}
      />
    );
  }

  const slotWidth = CELL_WIDTH / Math.max(1, renderSlots.length);
  // Slot layout: 10% padding each side, two bars side by side with a small
  // gap. When one side's count is 0, that bar simply doesn't render —
  // leaving a visible gap that signals "category absent on this side."
  const slotPad = slotWidth * 0.1;
  const innerW = slotWidth - slotPad * 2;
  const gap = Math.max(1, Math.min(2, innerW * 0.1));
  const pairBarW = Math.max(1, (innerW - gap) / 2);

  return (
    <PairedHistogramSvg ariaLabel={DISCRETE_ARIA_LABEL} className={className}>
      {renderSlots.map((s, i) => {
        const slotX = i * slotWidth;
        const baseX = slotX + slotPad;
        const currX = slotX + slotPad + pairBarW + gap;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable backend order
          <g key={i}>
            {/* Invisible hit-target spans the full slot — hovering either
             * bar (or the gap where one is absent) shows the same tooltip
             * identifying this value. `fill="none"` + `pointerEvents="all"`
             * keeps the rect pickable without painting any pixels. */}
            <rect
              x={slotX}
              y={0}
              width={slotWidth}
              height={chartHeight}
              fill="none"
              pointerEvents="all"
            >
              <title>{s.hoverTitle}</title>
            </rect>
            {s.baseH > 0 && (
              <rect
                x={baseX}
                y={chartHeight - s.baseH}
                width={pairBarW}
                height={s.baseH}
                fill={baseFill}
                pointerEvents="none"
              />
            )}
            {s.currH > 0 && (
              <rect
                x={currX}
                y={chartHeight - s.currH}
                width={pairBarW}
                height={s.currH}
                fill={currentFill}
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      <BaselineRule y={chartHeight} stroke={baselineColor} />

      {data.trimmed && (
        // Small chip-style background behind the marker so the text stays
        // legible when a tall rightmost bar reaches the top of the chart.
        <g pointerEvents="none">
          <rect
            x={CELL_WIDTH - 38}
            y={1}
            width={37}
            height={10}
            fill={theme.overlayBackgroundColor}
            rx={2}
            data-testid="trimmed-marker-bg"
          />
          <text
            x={CELL_WIDTH - 1}
            y={9}
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize={8}
            fill={trimColor}
            textAnchor="end"
          >
            trimmed
          </text>
        </g>
      )}
    </PairedHistogramSvg>
  );
}

/**
 * Bridge from the discriminated payload to the renderer-agnostic slot
 * shape. Picks the right compute function and converts proportions /
 * ranks into pixel heights so the SVG body is identical between modes.
 *
 * `formatValue` runs here, once per slot, so the SVG body only ever sees
 * pre-formatted display strings. The compute functions stay payload-typed
 * (`value: unknown`).
 */
function computeRenderSlots(
  data: PairedHistogramDiscreteData,
  chartHeight: number,
  formatValue: (v: unknown) => string,
): RenderSlot[] {
  if (data.mode === "ranks") {
    const { slots } = computeRanksSlots(data);
    return slots.map((s) => ({
      baseH: heightForRank(s.baseRank, data.k, chartHeight),
      currH: heightForRank(s.currRank, data.k, chartHeight),
      hoverTitle: formatRankTooltip(
        formatValue(s.value),
        s.baseRank,
        s.currRank,
      ),
    }));
  }

  const { slots, maxProp } = computeDiscreteSlots(data);
  return slots.map((s) => ({
    baseH: (s.baseProp / maxProp) * chartHeight,
    currH: (s.currProp / maxProp) * chartHeight,
    hoverTitle: formatProportionTooltip(
      formatValue(s.value),
      s.baseProp,
      s.currProp,
    ),
  }));
}

/** Default `formatValue`: `String(v)`. Cheap, safe; the seam exists so
 * Stage C can override it per column type. */
function defaultFormatValue(v: unknown): string {
  return String(v);
}

/**
 * Rank-position → pixel height. Rank 1 fills the chart; rank k draws as
 * `1/k * chartHeight`; `null` rank → 0 (bar omitted entirely).
 *
 * Result is clamped to `[0, chartHeight]` so a Stage B contract violation
 * (rank > k → negative height, rank ≤ 0 → over-tall) renders a
 * well-formed bar instead of an SVG layout glitch.
 */
function heightForRank(
  rank: number | null,
  k: number,
  chartHeight: number,
): number {
  if (rank === null || k <= 0) return 0;
  const h = ((k - rank + 1) / k) * chartHeight;
  return Math.max(0, Math.min(chartHeight, h));
}

/**
 * Compute per-slot proportions + max prop given a counts-mode top-K
 * payload.
 *
 * File-level export (not in the package barrel) so the unit tests in
 * this directory can validate the layout without rendering.
 */
export function computeDiscreteSlots(data: PairedHistogramDiscreteCountsData): {
  slots: {
    value: unknown;
    baseProp: number;
    currProp: number;
    baseCount: number;
    currCount: number;
  }[];
  maxProp: number;
} {
  const { values, baseCounts, currentCounts, baseTotal, currentTotal } = data;

  // Guard: counts arrays must match values.length. Anything off → empty slots.
  // Array.isArray checks defend against malformed payloads (TS contract drift,
  // partial-loading payloads) reaching the `.length` access — we'd rather render
  // an empty SVG frame than crash the schema row.
  if (
    !Array.isArray(values) ||
    !Array.isArray(baseCounts) ||
    !Array.isArray(currentCounts) ||
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
  // Epsilon floor avoids div-by-zero in the renderer when every count is 0.
  // Matches `computeContinuousLayout`'s maxDensity floor.
  const maxProp = Math.max(1e-9, ...props);
  return { slots, maxProp };
}

/**
 * Compute per-slot ranks given a ranks-mode top-K payload. Slot order
 * is preserved from `data.values` — Stage B's contract is that the
 * caller has already arranged base-first, then current-only appended
 * sorted by current rank.
 *
 * Defensively drops entries absent from both top-Ks (Stage B's contract
 * says they won't appear) and emits a `console.warn` so the contract
 * violation surfaces in dev tools instead of vanishing silently.
 *
 * File-level export (not in the package barrel) so the unit tests in
 * this directory can validate the layout without rendering.
 */
export function computeRanksSlots(data: PairedHistogramDiscreteRanksData): {
  slots: {
    value: unknown;
    baseRank: number | null;
    currRank: number | null;
  }[];
} {
  const { values, baseRanks, currentRanks } = data;

  // Guard: rank arrays must match values.length. Anything off → empty slots.
  // Array.isArray checks defend against malformed payloads (TS contract drift,
  // partial-loading payloads) reaching the `.length` access — we'd rather render
  // an empty SVG frame than crash the schema row.
  if (
    !Array.isArray(values) ||
    !Array.isArray(baseRanks) ||
    !Array.isArray(currentRanks) ||
    values.length === 0 ||
    values.length !== baseRanks.length ||
    values.length !== currentRanks.length
  ) {
    return { slots: [] };
  }

  const mapped = values.map((value, i) => ({
    value,
    baseRank: baseRanks[i] ?? null,
    currRank: currentRanks[i] ?? null,
  }));
  const slots = mapped.filter(
    (s) => s.baseRank !== null || s.currRank !== null,
  );
  if (slots.length < mapped.length) {
    console.warn(
      `[PairedHistogramDiscrete] computeRanksSlots: dropped ${
        mapped.length - slots.length
      } value(s) absent from both base and current top-K (Stage B contract violation).`,
    );
  }
  return { slots };
}
