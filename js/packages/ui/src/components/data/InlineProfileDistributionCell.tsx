"use client";

import { VscError } from "react-icons/vsc";
import type {
  ProfileDistributionColumnPayload,
  ProfileDistributionHistogramPayload,
  ProfileDistributionTopKPayload,
  ProfileDistributionTopKRanksPayload,
} from "../../api";
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
 * @description DRC-3390 Stage C — the schema-grid cell container that turns a
 * single column's {@link ProfileDistributionColumnPayload} into the right
 * Stage A paired-histogram leaf, and renders the loading / error / empty /
 * per-column-failure states around it.
 *
 * This is the one place the snake_case wire payload is mapped to the
 * camelCase cell props, and the only place that has to know the column's dbt
 * type (to format datetime histogram edges, which arrive as epoch seconds).
 * The leaf cells stay type-blind; this container owns the formatting seam.
 *
 * State machine (first match wins):
 *   1. `isLoading`            → pending dot
 *   2. `hasError`             → run-level error glyph
 *   3. no payload             → blank (column has no distribution data)
 *   4. `kind: null`           → per-column failure glyph
 *   5. `kind: "histogram"`    → {@link PairedHistogramContinuous}
 *   6. `kind: "topk"` + ranks → {@link PairedHistogramDiscrete} (ranks mode)
 *   7. `kind: "topk"` + counts→ {@link PairedHistogramDiscrete} (counts mode)
 */

export interface InlineProfileDistributionCellProps {
  /** The per-column payload from the run result, or undefined when none. */
  payload?: ProfileDistributionColumnPayload;
  /**
   * The column's dbt type, used only to decide whether continuous histogram
   * edges should be formatted as dates (datetime columns emit epoch seconds).
   */
  columnType?: string;
  /**
   * Envelope-level row totals — the denominator for counts-mode proportions.
   * Unused in ranks mode (the DuckDB Stage B path), so optional.
   */
  baseTotal?: number;
  currentTotal?: number;
  /** True while the run is in flight (no payload yet). */
  isLoading?: boolean;
  /** True when the whole run failed (distinct from a per-column failure). */
  hasError?: boolean;
  className?: string;
}

/** dbt types whose histogram edges are epoch seconds (see DRC-3504). */
function isDatetimeType(type?: string): boolean {
  if (!type) return false;
  const t = type.toLowerCase();
  return (
    t.includes("timestamp") ||
    t.includes("datetime") ||
    t.includes("date") ||
    t.includes("time")
  );
}

/** Format an epoch-seconds edge as a short calendar date for tooltips. */
function formatEpochSeconds(sec: number): string {
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return String(sec);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
  // Counts mode (Stage D adapters). A per-slot `null` means the value is
  // absent from that env's top-K — coerce to 0 so the bar simply doesn't
  // render (gap-on-absent), which is exactly the cell's 0-height behavior.
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

  // No payload for this column: render nothing (blank cell), never fake data.
  if (!payload) return null;

  if (payload.kind === null) {
    return (
      <DistributionErrorIcon
        title="Failed to read distribution for this column"
        testId="inline-distribution-column-failure"
      />
    );
  }

  if (payload.kind === "histogram") {
    const formatValue = isDatetimeType(columnType)
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
