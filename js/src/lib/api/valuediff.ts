import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

export type ValueDiffError = {
  test: string;
  invalids: number;
  sql: string;
  model: string;
  column_name: string;
  base: boolean;
};

export type ValueDiffResult = {
  summary: {
    total: number;
    added: number;
    removed: number;
  };
  data: DataFrame;
  errors: ValueDiffError[];
};

export interface ValueDiffParams {
  model: string;
  primary_key: string;
}

export async function submitValueDiff(
  params: ValueDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<ValueDiffParams, ValueDiffResult>(
    "value_diff",
    params,
    options
  );
}
