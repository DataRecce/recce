"use client";

import type { Run, RunType } from "../api";

/**
 * Options for creating a Run object from result data
 */
export interface CreateRunOptions<TResult, TParams = unknown> {
  type: RunType;
  result: TResult;
  params?: TParams;
  run_id?: string;
  run_at?: string;
}

/**
 * Creates a minimal Run object from result data.
 * Use when you have result/params and need to pass to library components.
 *
 * @example
 * ```tsx
 * import { createRunFromResult } from '@datarecce/ui/adapters';
 * import { RowCountDiffResultView } from '@datarecce/ui/components';
 *
 * const run = createRunFromResult({
 *   type: 'row_count_diff',
 *   result: myData,
 *   params: { select: 'my_model' },
 * });
 * return <RowCountDiffResultView run={run} />;
 * ```
 */
export function createRunFromResult<TResult, TParams = unknown>({
  type,
  result,
  params,
  run_id = `synthetic-${Date.now()}`,
  run_at = new Date().toISOString(),
}: CreateRunOptions<TResult, TParams>): Run {
  return {
    type,
    run_id,
    run_at,
    params,
    result,
    status: "Finished",
  } as Run;
}

/**
 * Type-safe factory functions for each run type.
 */
export const RunFactory = {
  rowCount: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "row_count", result, params }),
  rowCountDiff: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "row_count_diff", result, params }),
  query: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "query", result, params }),
  queryBase: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "query_base", result, params }),
  queryDiff: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "query_diff", result, params }),
  profile: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "profile", result, params }),
  profileDiff: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "profile_diff", result, params }),
  valueDiff: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "value_diff", result, params }),
  valueDiffDetail: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "value_diff_detail", result, params }),
  histogramDiff: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "histogram_diff", result, params }),
  topKDiff: (result: unknown, params?: unknown) =>
    createRunFromResult({ type: "top_k_diff", result, params }),
};
