import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

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

export async function submitValueDiff(params: ValueDiffParams, options?: SubmitOptions) {
  return await submitRun<ValueDiffParams, ValueDiffResult>("value_diff", params, options);
}

export type ValueDiffDetailResult = DataFrame;

export type ValueDiffDetailParams = ValueDiffParams;

export interface ValueDiffDetailViewOptions {
  changed_only?: boolean;
  pinned_columns?: string[];
}

export async function submitValueDiffDetail(params: ValueDiffParams, options?: SubmitOptions) {
  return await submitRun<ValueDiffParams, ValueDiffResult>("value_diff_detail", params, options);
}
