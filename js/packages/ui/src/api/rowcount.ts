import type { AxiosInstance } from "axios";
import type { WhereFilter } from "./profile";
import { type SubmitOptions, submitRun } from "./runs";

// ============================================================================
// Row Count Types
// ============================================================================

export interface RowCountParams {
  node_names: string[];
}

export interface RowCount {
  name?: string;
  curr: number | null;
}

export type RowCountResult = Record<string, RowCount>;

// ============================================================================
// Row Count Diff Types
// ============================================================================

export interface RowCountDiffParams {
  node_names: string[];
  where_filter?: WhereFilter;
}

export interface RowCountDiff {
  name?: string;
  base: number | null;
  curr: number | null;
}

export type RowCountDiffResult = Record<string, RowCountDiff>;

// ============================================================================
// API Functions
// ============================================================================

export async function submitRowCountDiff(
  params: RowCountDiffParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("row_count_diff", params, options, client);
}
