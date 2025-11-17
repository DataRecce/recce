import { SubmitOptions, submitRun } from "./runs";
import { ColumnRenderMode, DataFrame } from "./types";

export interface ValueDiffResult {
  summary: {
    total: number;
    added: number;
    removed: number;
  };
  data: DataFrame;
}

export interface ValueDiffParams {
  model: string;
  primary_key: string | string[];
  columns?: string[];
}

export async function submitValueDiff(
  params: ValueDiffParams,
  options?: SubmitOptions,
) {
  return await submitRun("value_diff", params, options);
}

export type ValueDiffDetailResult = DataFrame;

export type ValueDiffDetailParams = ValueDiffParams;

export interface ValueDiffDetailViewOptions {
  changed_only?: boolean;
  pinned_columns?: string[];
  display_mode?: "inline" | "side_by_side";
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

export async function submitValueDiffDetail(
  params: ValueDiffParams,
  options?: SubmitOptions,
) {
  return await submitRun("value_diff_detail", params, options);
}
