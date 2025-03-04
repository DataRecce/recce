import { SubmitOptions, submitRun } from "./runs";
import { DataFrame } from "./types";

export interface QueryParams extends QueryRunParams, QueryDiffParams, QueryPreviewChangeParams {}

export interface QueryPreviewChangeParams {
  current_model?: string;
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryRunParams {
  sql_template: string;
}

export interface QueryViewOptions {
  pinned_columns?: string[];
}

export interface QueryResult extends DataFrame {}

export interface QueryDiffParams {
  sql_template: string;
  base_sql_template?: string;
  primary_keys?: string[];
}

export interface QueryDiffResult {
  base?: DataFrame;
  current?: DataFrame;
  diff?: DataFrame;
}

export interface QueryDiffViewOptions {
  changed_only?: boolean;
  primary_keys?: string[];
  pinned_columns?: string[];
}

export async function submitQuery(params: QueryRunParams, options?: SubmitOptions) {
  return await submitRun<QueryRunParams, QueryResult>("query", params, options);
}

export async function submitQueryBase(params: QueryRunParams, options?: SubmitOptions) {
  return await submitRun<QueryRunParams, QueryResult>("query_base", params, options);
}

export async function submitQueryDiff(params: QueryDiffParams, options?: SubmitOptions) {
  return await submitRun<QueryDiffParams, QueryDiffResult>("query_diff", params, options);
}
