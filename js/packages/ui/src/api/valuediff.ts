import type { AxiosInstance } from "axios";
import { type SubmitOptions, submitRun } from "./runs";
import { type ColumnRenderMode, type DataFrame } from "./types";

// ============================================================================
// Value Diff Types
// ============================================================================

export interface ValueDiffParams {
  model: string;
  primary_key: string | string[];
  columns?: string[];
}

export interface ValueDiffResult {
  summary: {
    total: number;
    added: number;
    removed: number;
  };
  data: DataFrame;
}

// ============================================================================
// Value Diff Detail Types
// ============================================================================

export type ValueDiffDetailParams = ValueDiffParams;
export type ValueDiffDetailResult = DataFrame;

export interface ValueDiffDetailViewOptions {
  changed_only?: boolean;
  pinned_columns?: string[];
  display_mode?: "inline" | "side_by_side";
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

// ============================================================================
// API Functions
// ============================================================================

export async function submitValueDiff(
  params: ValueDiffParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("value_diff", params, options, client);
}

export async function submitValueDiffDetail(
  params: ValueDiffParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("value_diff_detail", params, options, client);
}
