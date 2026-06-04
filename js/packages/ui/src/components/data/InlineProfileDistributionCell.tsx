"use client";

import { VscError } from "react-icons/vsc";
import type {
  ProfileDistributionColumnPayload,
  ProfileDistributionHistogramPayload,
  ProfileDistributionTopKPayload,
  ProfileDistributionTopKRanksPayload,
} from "../../api";
import { formatEpochSeconds, formatTimeOfDay } from "../../utils";
import {
  PairedHistogramContinuous,
  type PairedHistogramContinuousData,
} from "./PairedHistogramContinuous";
import {
  PairedHistogramDiscrete,
  type PairedHistogramDiscreteData,
} from "./PairedHistogramDiscrete";

/**
 * @file InlineProfileDistributionCell.tsx
 * @description The schema-grid cell container that turns a single column's
 * {@link ProfileDistributionColumnPayload} into the right paired-histogram
 * leaf, and renders the loading / error / empty / per-column-failure states
 * around it.
 *
 * This is the one place the snake_case wire payload is mapped to the
 * camelCase cell props, and the only place that has to know the column's dbt
 * type (to format datetime histogram edges, which arrive as epoch seconds).
 * The leaf cells stay type-blind; this container owns the formatting seam.
 *
 * State machine (first match wins):
 *   1. `isLoading`            → pending dot
 *   2. `hasError`             → run-level error glyph
 *   3. no payload + notProfiled → "not profiled" dash (column outside a scoped run)
 *   4. no payload             → blank (column has no distribution data)
 *   5. `kind: null`           → per-column failure glyph
 *   6. `kind: "histogram"`    → {@link PairedHistogramContinuous}
 *   7. `kind: "topk"` + ranks → {@link PairedHistogramDiscrete} (ranks mode)
 *   8. `kind: "topk"` + counts→ {@link PairedHistogramDiscrete} (counts mode)
 */

export interface InlineProfileDistributionCellProps {
  /** The per-column payload from the run result, or undefined when none. */
  payload?: ProfileDistributionColumnPayload;
  /**
   * The column's dbt type, used only to format continuous histogram edges:
   * calendar dates for date/timestamp/datetime (edges are epoch seconds), or
   * `HH:MM:SS` clock times for `TIME` (edges are seconds-since-midnight).
   */
  columnType?: string;
  /**
   * Envelope-level row totals — the denominator for counts-mode proportions.
   * Unused in ranks mode (the DuckDB path that ships today), so optional. NOT
   * speculative: full warehouse adapters (Snowflake/BigQuery top-K return
   * value+count pairs) emit counts mode, so this is threaded now to match the
   * single `run.ts` payload contract rather than retrofitted later.
   */
  baseTotal?: number;
  currentTotal?: number;
  /** True while the run is in flight (no payload yet). */
  isLoading?: boolean;
  /** True when the whole run failed (distinct from a per-column failure). */
  hasError?: boolean;
  /**
   * True when this column was outside a scoped run — never requested, so it has
   * no data by design. Renders a faint dash so the empty cell reads as
   * "intentionally not profiled" rather than broken. Ignored once a payload,
   * loading, or error state applies.
   */
  notProfiled?: boolean;
  className?: string;
}

/**
 * Calendar-date types whose histogram edges are seconds since the Unix epoch.
 * Bare `TIME` is deliberately excluded — its edges are seconds-since-midnight,
 * not an epoch, and is handled by `isTimeOfDayType`.
 */
function isDatetimeType(type?: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return (
    t.includes("timestamp") || t.includes("datetime") || t.includes("date")
  );
}

/**
 * Time-of-day types (`TIME`, `TIME WITH/WITHOUT TIME ZONE`). The backend's
 * `epoch()` cast emits **seconds-since-midnight** (0–86399) for these, so the
 * edges must be read as a clock time, not a calendar date — otherwise every
 * tooltip collapses to "Jan 1, 1970". Matches `time` but not
 * `timestamp`/`datetime`, which carry real epoch seconds.
 */
function isTimeOfDayType(type?: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return (
    t.includes("time") && !t.includes("timestamp") && !t.includes("datetime")
  );
}

/**
 * A muted "failed to read" marker for the run-level and per-column error
 * states. An error icon (deliberately quiet so one bad column doesn't shout
 * next to healthy cells) whose `title` tooltip specifies what failed on hover.
 */
function DistributionErrorIcon({
  title,
  testId,
}: {
  title: string;
  testId: string;
}) {
  return (
    <span
      className="schema-distribution-error"
      title={title}
      role="img"
      aria-label={title}
      data-testid={testId}
    >
      <VscError aria-hidden />
    </span>
  );
}

/**
 * Out-of-scope marker: this column was not part of a scoped run, so it has no
 * data by design. A faint dash, quieter than the error icon, so the cell reads
 * as "intentionally not profiled" rather than a failure. Decorative
 * (`aria-hidden`): an out-of-scope cell already reads as empty to assistive
 * tech, and announcing "not profiled" on every unprofiled column would be
 * noise. The mouse-hover tooltip explains the why for sighted users.
 */
function DistributionNotProfiled() {
  return (
    <span
      className="schema-distribution-not-profiled"
      title="Not profiled — only changed columns are shown"
      aria-hidden
      data-testid="inline-distribution-not-profiled"
    >
      {"–"}
    </span>
  );
}

/** Display string for a heterogeneous categorical value. */
function formatDiscreteValue(v: unknown): string {
  if (v === null || v === undefined) return "(null)";
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function toContinuousData(
  p: ProfileDistributionHistogramPayload,
): PairedHistogramContinuousData {
  return {
    baseBinEdges: p.base_bin_edges,
    currentBinEdges: p.current_bin_edges,
    baseDensity: p.base_density,
    currentDensity: p.current_density,
    baseTotal: p.base_total,
    currentTotal: p.current_total,
  };
}

function toDiscreteData(
  p: ProfileDistributionTopKPayload | ProfileDistributionTopKRanksPayload,
  baseTotal: number,
  currentTotal: number,
): PairedHistogramDiscreteData {
  if (p.mode === "ranks") {
    return {
      mode: "ranks",
      values: p.values,
      baseRanks: p.base_ranks,
      currentRanks: p.current_ranks,
      k: p.k,
      trimmed: p.trimmed,
    };
  }
  // Counts mode. The DuckDB path only emits ranks, so this branch is inert
  // today — but it's a known future need, not speculation: full warehouse
  // adapters (Snowflake/BigQuery top-K return value+count pairs) emit counts,
  // and the cell conforms to the whole `run.ts` payload contract now so adding
  // them is a backend-only change. A per-slot `null` means the value is absent
  // from that env's top-K — coerce to 0 so the bar simply doesn't render
  // (gap-on-absent), which is exactly the cell's 0-height behavior.
  return {
    mode: "counts",
    values: p.values,
    baseCounts: p.base_counts.map((c) => c ?? 0),
    currentCounts: p.current_counts.map((c) => c ?? 0),
    baseTotal,
    currentTotal,
    trimmed: p.trimmed,
  };
}

export function InlineProfileDistributionCell({
  payload,
  columnType,
  baseTotal = 0,
  currentTotal = 0,
  isLoading = false,
  hasError = false,
  notProfiled = false,
  className,
}: InlineProfileDistributionCellProps) {
  if (isLoading) {
    return (
      <span
        className="schema-distribution-pending"
        aria-label="Loading distribution"
        role="status"
        data-testid="inline-distribution-pending"
      />
    );
  }

  if (hasError) {
    return (
      <DistributionErrorIcon
        title="Failed to read distribution"
        testId="inline-distribution-error"
      />
    );
  }

  // No payload for this column. A column outside a scoped run was never
  // requested, so show a faint "not profiled" dash; otherwise render nothing
  // (blank cell), never fake data.
  if (!payload) return notProfiled ? <DistributionNotProfiled /> : null;

  if (payload.kind === null) {
    return (
      <DistributionErrorIcon
        title="Failed to read distribution for this column"
        testId="inline-distribution-column-failure"
      />
    );
  }

  if (payload.kind === "histogram") {
    const formatValue = isTimeOfDayType(columnType)
      ? formatTimeOfDay
      : isDatetimeType(columnType)
        ? formatEpochSeconds
        : undefined;
    return (
      <PairedHistogramContinuous
        data={toContinuousData(payload)}
        formatValue={formatValue}
        className={className}
      />
    );
  }

  // kind === "topk"
  return (
    <PairedHistogramDiscrete
      data={toDiscreteData(payload, baseTotal, currentTotal)}
      formatValue={formatDiscreteValue}
      className={className}
    />
  );
}
