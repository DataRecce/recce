import type { ApiClient } from "../lib/fetchClient";
import { type SubmitOptions, submitRun } from "./runs";
import { type ColumnRenderMode, type DataFrame } from "./types";
import type { ProfileDistributionParams } from "./types/run";

// ============================================================================
// Profile Diff Types
// ============================================================================

export interface ProfileDiffParams {
  model: string;
  columns?: string[];
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
  client: ApiClient,
) {
  return await submitRun("profile_diff", params, options, client);
}

/**
 * Submit a `profile_distribution` run (DRC-3390 Stage C).
 *
 * Backed by the DuckDB-only `approx_all` pipeline in Stage B. The result is a
 * {@link ProfileDistributionResult} discriminated union (`ok` with per-column
 * payloads, or an `unsupported` envelope for adapters without native
 * approx-aggregate support). Callers normally drive this through
 * {@link useInlineProfileDistribution} rather than calling it directly.
 */
export async function submitProfileDistribution(
  params: ProfileDistributionParams,
  options: SubmitOptions | undefined,
  client: ApiClient,
) {
  return await submitRun("profile_distribution", params, options, client);
}

// ============================================================================
// Top-K Types
// ============================================================================

export interface TopKDiffParams {
  model: string;
  column_name: string;
  k: number;
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
