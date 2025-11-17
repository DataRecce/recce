import { SubmitOptions, submitRun } from "./runs";
import { ColumnRenderMode, DataFrame } from "./types";

export interface QueryParams
  extends QueryRunParams,
    QueryDiffParams,
    QueryPreviewChangeParams {}

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
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

export type QueryResult = DataFrame;

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
  display_mode?: "inline" | "side_by_side";
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

export async function submitQuery(
  params: QueryRunParams,
  options?: SubmitOptions,
) {
  return await submitRun("query", params, options);
}

export async function submitQueryBase(
  params: QueryRunParams,
  options?: SubmitOptions,
) {
  return await submitRun("query_base", params, options);
}

export async function submitQueryDiff(
  params: QueryDiffParams,
  options?: SubmitOptions,
) {
  return await submitRun("query_diff", params, options);
}
