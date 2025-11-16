import { SubmitOptions, submitRun } from "./runs";
import { ColumnRenderMode, DataFrame } from "./types";

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

export async function submitProfileDiff(
  params: ProfileDiffParams,
  options?: SubmitOptions,
) {
  return await submitRun("profile_diff", params, options);
}

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
