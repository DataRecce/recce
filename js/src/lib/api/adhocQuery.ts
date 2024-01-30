import { RowCount } from "./models";
import { SubmitOptions, submitRun } from "./runs";
import { DataFrame, PandasDataFrame } from "./types";

export interface QueryParams {
  sql_template: string;
}

export interface QueryViewOptions {
  pinned_columns?: string[];
}

export interface QueryResult {
  result?: PandasDataFrame;
  error?: string;
}

export interface QueryDiffParams {
  sql_template: string;
  primary_keys?: string[];
}

export interface RowCountDiffParams {
  node_names: string[];
}

export interface QueryDiffResult {
  base?: DataFrame;
  current?: DataFrame;
}

export interface RowCountDiffResult {
  [key: string]: RowCount;
}

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
  return await submitRun<QueryDiffResult, QueryDiffResult>(
    "query_diff",
    params,
    options
  );
}

export async function submitRowCountDiff(
  params: RowCountDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<RowCountDiffParams, RowCountDiffResult>(
    "row_count_diff",
    params,
    options
  );
}
