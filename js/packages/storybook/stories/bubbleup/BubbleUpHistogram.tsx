import { useMemo } from "react";

/**
 * BubbleUp-style paired histogram for inline profile cells.
 *
 * Design exploration only — this component lives in the storybook package and
 * is NOT shipped via @datarecce/ui. The captain reviews these stories before
 * the chart shape is promoted into a real ColumnProfileStats extension.
 *
 * Reference visual pattern: Honeycomb's BubbleUp UI — paired baseline +
 * current distributions in a compact cell, with the baseline as the reference
 * and the current rendered ON TOP so divergence pops.
 */

// ---------- Data shapes ----------

/**
 * Discrete variant (low-card string OR low-card numeric).
 *
 * - Low-card STRING: ordering decided OUTSIDE this component. Caller passes
 *   the values in display order — by convention, descending baseline frequency.
 * - Low-card NUMERIC: caller passes values in numeric order. Component does
 *   NOT space bars proportionally to numeric distance — every bucket gets
 *   equal width (HTTP 200/304/404/500 sit equally regardless of gaps).
 *
 * Either variant has the same shape; the *ordering policy* is the caller's job.
 */
export interface DiscreteBucket {
  /** Display label (string for both variants — numeric callers stringify). */
  value: string;
  base_count: number;
  current_count: number;
}

export interface DiscreteBubbleUpData {
  buckets: DiscreteBucket[];
  /** Total baseline samples (used for "% of base" tooltip math). */
  base_total: number;
  /** Total current samples. */
  current_total: number;
}

/**
 * High-cardinality continuous variant.
 *
 * Bars are positioned by bin midpoint and sized by bin width — distinct from
 * the discrete shape, where every bucket is equal width. Overlapping render
 * (current ON TOP of baseline) is the deliberate choice; see story
 * `HighCard_OverlapVsSideBySide` for the comparison.
 */
export interface ContinuousBin {
  lo: number;
  hi: number;
  base_count: number;
  current_count: number;
}

export interface ContinuousBubbleUpData {
  bins: ContinuousBin[];
  base_total: number;
  current_total: number;
}

// ---------- Color tokens (mirror HistogramChart light-mode) ----------

const BASE_COLOR = "#F6AD55"; // baseline = orange
const CURRENT_COLOR = "#63B3ED"; // current = blue
const BASE_FILL = "#F6AD55B3"; // ~70% alpha
const CURRENT_FILL = "#63B3EDB3";

// ---------- Cardinality thresholds (captain brief) ----------

const X_AXIS_DROP_THRESHOLD = 40;
const VALUE_TRIM_THRESHOLD = 75;

// ---------- Discrete variant ----------

export interface DiscreteBubbleUpProps {
  data: DiscreteBubbleUpData;
  /** Cell render width (px). */
  width?: number;
  /** Cell render height (px). Includes optional X-axis row. */
  height?: number;
  /**
   * Render mode:
   * - "grouped" (default for discrete): base + current sit side-by-side per bucket
   * - "overlapped": current drawn on top of base (used by continuous variant)
   */
  layout?: "grouped" | "overlapped";
  /**
   * If true, force-show the X axis even above the threshold (for the
   * "side-by-side" comparison stories). Default: auto per cardinality rules.
   */
  forceShowXAxis?: boolean;
  /**
   * If true, force-skip trimming (used to demonstrate why trimming exists).
   * Default: auto per cardinality rules.
   */
  forceNoTrim?: boolean;
}

export function DiscreteBubbleUpHistogram({
  data,
  width = 220,
  height = 64,
  layout = "grouped",
  forceShowXAxis,
  forceNoTrim,
}: DiscreteBubbleUpProps) {
  const { renderedBuckets, didTrim, showXAxis } = useMemo(() => {
    let buckets = data.buckets;
    let didTrim = false;

    // Trim: if >VALUE_TRIM_THRESHOLD distinct, keep top-N baseline + outliers
    // by current/base ratio (so spikes show even if baseline is small).
    if (!forceNoTrim && buckets.length > VALUE_TRIM_THRESHOLD) {
      const TOP_BASE = 30;
      const TOP_OUTLIERS = 10;

      const byBase = [...buckets]
        .map((b, i) => ({ b, i }))
        .sort((a, z) => z.b.base_count - a.b.base_count);
      const topByBase = new Set(byBase.slice(0, TOP_BASE).map((x) => x.i));

      const outlierScore = (b: DiscreteBucket) => {
        const baseProp =
          data.base_total > 0 ? b.base_count / data.base_total : 0;
        const currProp =
          data.current_total > 0 ? b.current_count / data.current_total : 0;
        // simple absolute proportion delta — surfaces both new spikes and drops
        return Math.abs(currProp - baseProp);
      };
      const byOutlier = [...buckets]
        .map((b, i) => ({ b, i, s: outlierScore(b) }))
        .sort((a, z) => z.s - a.s);
      for (const x of byOutlier.slice(0, TOP_OUTLIERS)) topByBase.add(x.i);

      buckets = buckets.filter((_, i) => topByBase.has(i));
      didTrim = true;
    }

    const showXAxis = forceShowXAxis ?? buckets.length <= X_AXIS_DROP_THRESHOLD;

    return { renderedBuckets: buckets, didTrim, showXAxis };
  }, [data, forceShowXAxis, forceNoTrim]);

  const axisHeight = showXAxis ? 12 : 0;
  const chartHeight = height - axisHeight - 2; // 2px breathing room

  const maxCount = Math.max(
    1,
    ...renderedBuckets.flatMap((b) => [b.base_count, b.current_count]),
  );

  const slotWidth = width / Math.max(1, renderedBuckets.length);
  // For grouped: split slot into two bars. For overlapped: full-width bars.
  const barWidth = layout === "grouped" ? slotWidth * 0.4 : slotWidth * 0.9;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label="Paired baseline and current histogram"
    >
      <title>BubbleUp paired histogram</title>
      {renderedBuckets.map((b, i) => {
        const baseH = (b.base_count / maxCount) * chartHeight;
        const currH = (b.current_count / maxCount) * chartHeight;
        const slotX = i * slotWidth;

        if (layout === "grouped") {
          const baseX = slotX + slotWidth * 0.1;
          const currX = slotX + slotWidth * 0.5;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable order, trimmed
            <g key={i}>
              <rect
                x={baseX}
                y={chartHeight - baseH}
                width={barWidth}
                height={baseH}
                fill={BASE_FILL}
                stroke={BASE_COLOR}
                strokeWidth={0.5}
              />
              <rect
                x={currX}
                y={chartHeight - currH}
                width={barWidth}
                height={currH}
                fill={CURRENT_FILL}
                stroke={CURRENT_COLOR}
                strokeWidth={0.5}
              />
            </g>
          );
        }

        // Overlapped: base behind, current in front (translucent)
        const x = slotX + slotWidth * 0.05;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable order
          <g key={i}>
            <rect
              x={x}
              y={chartHeight - baseH}
              width={barWidth}
              height={baseH}
              fill={BASE_FILL}
            />
            <rect
              x={x}
              y={chartHeight - currH}
              width={barWidth}
              height={currH}
              fill={CURRENT_FILL}
              stroke={CURRENT_COLOR}
              strokeWidth={0.5}
            />
          </g>
        );
      })}

      {/* baseline rule */}
      <line
        x1={0}
        y1={chartHeight}
        x2={width}
        y2={chartHeight}
        stroke="#9ca3af"
        strokeWidth={0.5}
      />

      {showXAxis && renderedBuckets.length > 0 && (
        <g
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={9}
          fill="#374151"
          textAnchor="middle"
        >
          {/* Render every Nth label to avoid collision */}
          {renderedBuckets.map((b, i) => {
            const stride = Math.max(
              1,
              Math.ceil(renderedBuckets.length / Math.floor(width / 28)),
            );
            if (i % stride !== 0) return null;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: stable order
              <text key={i} x={i * slotWidth + slotWidth / 2} y={height - 2}>
                {truncateLabel(b.value, Math.max(2, Math.floor(slotWidth / 5)))}
              </text>
            );
          })}
        </g>
      )}

      {didTrim && (
        <text
          x={width - 2}
          y={9}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={8}
          fill="#9ca3af"
          textAnchor="end"
        >
          trimmed
        </text>
      )}
    </svg>
  );
}

function truncateLabel(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  if (maxChars <= 1) return "…";
  return `${s.slice(0, maxChars - 1)}…`;
}

// ---------- Continuous (high-card quantitative) variant ----------

export interface ContinuousBubbleUpProps {
  data: ContinuousBubbleUpData;
  width?: number;
  height?: number;
  /**
   * Default "overlapped" — bars share x-extent, current drawn translucent
   * over base so divergence is visible without doubling the cell width.
   * "side-by-side" exists only to demonstrate why overlap was chosen.
   */
  layout?: "overlapped" | "side-by-side";
  showXAxis?: boolean;
}

export function ContinuousBubbleUpHistogram({
  data,
  width = 220,
  height = 64,
  layout = "overlapped",
  showXAxis = true,
}: ContinuousBubbleUpProps) {
  const axisHeight = showXAxis ? 12 : 0;
  const chartHeight = height - axisHeight - 2;

  const { bins } = data;
  if (bins.length === 0) {
    return <svg width={width} height={height} />;
  }

  const minLo = Math.min(...bins.map((b) => b.lo));
  const maxHi = Math.max(...bins.map((b) => b.hi));
  const xRange = Math.max(1e-9, maxHi - minLo);
  const xScale = (v: number) => ((v - minLo) / xRange) * width;

  const maxCount = Math.max(
    1,
    ...bins.flatMap((b) => [b.base_count, b.current_count]),
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block" }}
      role="img"
      aria-label="Paired baseline and current continuous histogram"
    >
      <title>BubbleUp continuous paired histogram</title>
      {bins.map((b, i) => {
        const x0 = xScale(b.lo);
        const fullW = Math.max(1, xScale(b.hi) - x0);
        const baseH = (b.base_count / maxCount) * chartHeight;
        const currH = (b.current_count / maxCount) * chartHeight;

        if (layout === "side-by-side") {
          const halfW = fullW / 2;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable bin order
            <g key={i}>
              <rect
                x={x0}
                y={chartHeight - baseH}
                width={Math.max(0.5, halfW - 0.5)}
                height={baseH}
                fill={BASE_FILL}
              />
              <rect
                x={x0 + halfW}
                y={chartHeight - currH}
                width={Math.max(0.5, halfW - 0.5)}
                height={currH}
                fill={CURRENT_FILL}
              />
            </g>
          );
        }

        // Overlapped — base full-width behind, current full-width on top
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: stable bin order
          <g key={i}>
            <rect
              x={x0}
              y={chartHeight - baseH}
              width={Math.max(0.5, fullW - 0.5)}
              height={baseH}
              fill={BASE_FILL}
            />
            <rect
              x={x0}
              y={chartHeight - currH}
              width={Math.max(0.5, fullW - 0.5)}
              height={currH}
              fill={CURRENT_FILL}
              stroke={CURRENT_COLOR}
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
        stroke="#9ca3af"
        strokeWidth={0.5}
      />

      {showXAxis && (
        <g
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={9}
          fill="#374151"
        >
          <text x={0} y={height - 2} textAnchor="start">
            {formatNum(minLo)}
          </text>
          <text x={width / 2} y={height - 2} textAnchor="middle">
            {formatNum((minLo + maxHi) / 2)}
          </text>
          <text x={width} y={height - 2} textAnchor="end">
            {formatNum(maxHi)}
          </text>
        </g>
      )}
    </svg>
  );
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

// ---------- Cell wrapper (frames the chart like a profile cell) ----------

export interface ProfileCellProps {
  columnName: string;
  columnType: string;
  children: React.ReactNode;
}

export function ProfileCellFrame({
  columnName,
  columnType,
  children,
}: ProfileCellProps) {
  return (
    <div
      style={{
        width: 240,
        padding: "6px 8px",
        border: "1px solid #e5e7eb",
        borderRadius: 4,
        background: "#fff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#374151",
          marginBottom: 4,
        }}
      >
        <span style={{ fontWeight: 600 }}>{columnName}</span>
        <span style={{ color: "#6b7280" }}>{columnType}</span>
      </div>
      {children}
      <div
        style={{
          display: "flex",
          gap: 10,
          fontSize: 9,
          color: "#6b7280",
          marginTop: 3,
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: BASE_FILL,
              marginRight: 3,
              verticalAlign: "middle",
            }}
          />
          base
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              background: CURRENT_FILL,
              marginRight: 3,
              verticalAlign: "middle",
            }}
          />
          current
        </span>
      </div>
    </div>
  );
}
