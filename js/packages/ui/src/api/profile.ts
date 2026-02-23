import type { AxiosInstance } from "axios";
import { type SubmitOptions, submitRun } from "./runs";
import { type ColumnRenderMode, type DataFrame } from "./types";

// ============================================================================
// Where Filter
// ============================================================================

export interface WhereFilter {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "is_null" | "is_not_null";
  value?: string;
}

// ============================================================================
// Profile Diff Types
// ============================================================================

export interface ProfileDiffParams {
  model: string;
  columns?: string[];
  where_filter?: WhereFilter;
}

export interface ProfileDiffResult {
  base?: DataFrame;
  current?: DataFrame;
}

export interface ProfileDiffViewOptions {
  pinned_columns?: string[];
  display_mode?: "side_by_side" | "inline";
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

// ============================================================================
// API Functions
// ============================================================================

export async function submitProfileDiff(
  params: ProfileDiffParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("profile_diff", params, options, client);
}

// ============================================================================
// Top-K Types
// ============================================================================

export interface TopKDiffParams {
  model: string;
  column_name: string;
  k: number;
  where_filter?: WhereFilter;
}

export interface TopKResult {
  values: (string | number | undefined)[];
  counts: number[];
  valids: number;
}

export interface TopKDiffResult {
  base: TopKResult;
  current: TopKResult;
}

/**
 * View options for TopKDiffResultView.
 * Controls display preferences for top-K diff visualization.
 */
export interface TopKViewOptions {
  /**
   * When true, show all items instead of just top 10.
   * Default is false (show top 10 only).
   */
  show_all?: boolean;
}

// ============================================================================
// Histogram Types
// ============================================================================

export interface HistogramDiffParams {
  model: string;
  column_name: string;
  column_type: string;
  where_filter?: WhereFilter;
}

export interface HistogramResult {
  counts: number[];
  total: number;
}

export interface HistogramDiffResult {
  base: HistogramResult;
  current: HistogramResult;
  min: number;
  max: number;
  bin_edges: number[];
  labels?: string[];
}
