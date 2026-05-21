"use client";

import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import { memo } from "react";
import {
  isHistogramPayload,
  isTopKPayload,
} from "../../api/profileDistribution";
import type { ProfileDistributionColumnResult } from "../../api/types/run";
import {
  PairedHistogramContinuous,
  type PairedHistogramContinuousData,
} from "./PairedHistogramContinuous";
import {
  PairedHistogramDiscrete,
  type PairedHistogramDiscreteData,
} from "./PairedHistogramDiscrete";

/**
 * Compact-mode integration cell for a single column's paired distribution.
 * DRC-3390 PR 3.
 *
 * Wraps the four states a schema row can be in for the distribution
 * column at GA — **loading**, **error**, **empty** (per-column failure
 * or absent payload), and **rendered** (continuous or discrete) — in a
 * single fixed-size slot so the surrounding grid doesn't reflow as
 * rows transition.
 *
 * Grid mode is **explicitly out of scope** at GA (per the DRC-3390 issue
 * description). Only Compact mode is wired here.
 *
 * Owns no fetching; receives `payload` + `loading` + `error` from the
 * parent (`useInlineProfileDistribution`). The hook caches per-model and
 * the parent maps each column to its slot.
 */
export interface InlineProfileDistributionCellProps {
  /** Per-column result from `useInlineProfileDistribution(...).distributions[column]`. */
  payload?: ProfileDistributionColumnResult;
  /** Loading state from the hook. While true, render a spinner — *not*
   * the chart from a previous value, to avoid implying staleness. */
  loading?: boolean;
  /** Error state from the hook (task-level failure, not per-column). */
  error?: Error | null;
  /** Width in px — default sized to schema-row Compact density. */
  width?: number;
  /** Height in px — default sized to schema-row Compact density. */
  height?: number;
  /** Theme — `"dark"` swaps to dark-mode bar/baseline/label colors. */
  theme?: "light" | "dark";
  /** Optional CSS class for the wrapper. */
  className?: string;
}

/**
 * Inline cell wrapper. Returns a same-sized box for every state so a
 * column transitioning loading → rendered doesn't shift adjacent cells.
 */
function InlineProfileDistributionCellImpl({
  payload,
  loading = false,
  error = null,
  width = 140,
  height = 28,
  theme = "light",
  className,
}: InlineProfileDistributionCellProps) {
  const isDark = theme === "dark";
  const wrapperStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
    width,
    height,
  };

  // ----- Loading ------------------------------------------------------
  if (loading) {
    return (
      <span
        className={className}
        style={wrapperStyle}
        role="status"
        aria-live="polite"
        aria-label="Loading column distribution"
        data-testid="inline-profile-distribution-loading"
      >
        <CircularProgress
          size={12}
          thickness={5}
          sx={{ color: isDark ? "grey.400" : "grey.600", ml: 0.5 }}
        />
      </span>
    );
  }

  // ----- Error (task-level) ------------------------------------------
  if (error) {
    return (
      <Tooltip title={error.message ?? "Failed to load distribution"} arrow>
        <span
          className={className}
          style={{
            ...wrapperStyle,
            color: isDark ? "rgb(248 113 113)" : "rgb(220 38 38)",
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            paddingLeft: 4,
          }}
          role="img"
          aria-label="Distribution failed to load"
          data-testid="inline-profile-distribution-error"
        >
          ⚠ error
        </span>
      </Tooltip>
    );
  }

  // ----- Per-column failure or absent (kind: null OR payload undefined)
  // Render nothing — schema row still shows name/type/badge. This is the
  // spec's "empty state": no spinner, no error chrome.
  if (!payload || payload.kind === null) {
    return (
      <span
        className={className}
        style={wrapperStyle}
        aria-hidden="true"
        data-testid="inline-profile-distribution-empty"
      />
    );
  }

  // ----- Continuous (histogram) --------------------------------------
  if (isHistogramPayload(payload)) {
    const data: PairedHistogramContinuousData = {
      binEdges: payload.bin_edges,
      baseDensity: payload.base_density,
      currentDensity: payload.current_density,
      baseTotal: payload.base_total,
      currentTotal: payload.current_total,
    };
    return (
      <span
        className={className}
        style={wrapperStyle}
        data-testid="inline-profile-distribution-continuous"
      >
        <PairedHistogramContinuous
          data={data}
          width={width}
          height={height}
          theme={theme}
        />
      </span>
    );
  }

  // ----- Discrete (top-K) --------------------------------------------
  if (isTopKPayload(payload)) {
    const data: PairedHistogramDiscreteData = {
      values: payload.values,
      baseCounts: payload.base_counts,
      currentCounts: payload.current_counts,
      baseTotal: payload.base_total,
      currentTotal: payload.current_total,
      trimmed: payload.trimmed,
    };
    return (
      <span
        className={className}
        style={wrapperStyle}
        data-testid="inline-profile-distribution-discrete"
      >
        <PairedHistogramDiscrete
          data={data}
          width={width}
          height={height}
          theme={theme}
        />
      </span>
    );
  }

  // Defensive fallback for any future `kind` we haven't taught the UI
  // about yet. Render the same empty slot rather than crashing the row.
  return (
    <span
      className={className}
      style={wrapperStyle}
      aria-hidden="true"
      data-testid="inline-profile-distribution-empty"
    />
  );
}

export const InlineProfileDistributionCell = memo(
  InlineProfileDistributionCellImpl,
);
InlineProfileDistributionCell.displayName = "InlineProfileDistributionCell";
