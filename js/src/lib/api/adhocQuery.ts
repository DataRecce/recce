import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

export interface QueryParams {
  sql_template: string;
}

export interface QueryViewOptions {
  pinned_columns?: string[];
}

export interface QueryResult extends DataFrame {}

export interface QueryDiffParams {
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryDiffResult {
  base?: DataFrame;
  current?: DataFrame;
}

export interface QueryDiffJoinParams {
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryDiffJoinResult extends DataFrame {}

export interface QueryDiffViewOptions {
  changed_only?: boolean;
  primary_keys?: string[];
  pinned_columns?: string[];
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
  return await submitRun<QueryDiffParams, QueryDiffResult>(
    "query_diff",
    params,
    options
  );
}

export async function submitQueryDiffJoin(
  params: QueryDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<QueryDiffJoinParams, QueryDiffJoinResult>(
    "query_diff_join",
    params,
    options
  );
}
