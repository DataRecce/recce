import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

export interface QueryParams {
  sql_template: string;
}

export interface QueryResult {
  result?: DataFrame;
  error?: string;
}

export interface QueryDiffParams {
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryDiffResult {
  primary_keys?: string[];
  changed_only?: boolean;
  base?: DataFrame;
  current?: DataFrame;
  base_error?: string;
  current_error?: string;
}

export async function submitQuery(
  params: QueryParams,
  options?: SubmitOptions
) {
  return await submitRun<QueryParams, QueryResult>("query", params, options);
}

export async function submitQueryDiff(
  params: QueryDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<QueryDiffResult, QueryDiffResult>(
    "query_diff",
    params,
    options
  );
}
