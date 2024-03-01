import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

export interface ProfileDiffParams {
  model: string;
}

export interface ProfileDiffResult {
  base?: DataFrame;
  current?: DataFrame;
}

export interface ProfileDiffViewOptions {
  pinned_columns?: string[];
}

export async function submitProfileDiff(
  params: ProfileDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<ProfileDiffParams, ProfileDiffResult>(
    "profile_diff",
    params,
    options
  );
}

export interface TopKDiffParams {
  model: string;
  column_name: string;
  k: number;
}

export interface TopKResult {
  values: (string | number)[];
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
