import type { AxiosInstance } from "axios";
import { type SubmitOptions, submitRun } from "./runs";
import { type ColumnRenderMode, type DataFrame } from "./types";

// ============================================================================
// Query Types
// ============================================================================

export interface QueryRunParams {
  sql_template: string;
}

export type QueryResult = DataFrame;

export interface QueryViewOptions {
  pinned_columns?: string[];
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

// ============================================================================
// Query Diff Types
// ============================================================================

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

// ============================================================================
// Preview Change Types
// ============================================================================

export interface QueryPreviewChangeParams {
  current_model?: string;
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryParams
  extends QueryRunParams,
    QueryDiffParams,
    QueryPreviewChangeParams {}

// ============================================================================
// API Functions
// ============================================================================

export async function submitQuery(
  params: QueryRunParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("query", params, options, client);
}

export async function submitQueryBase(
  params: QueryRunParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("query_base", params, options, client);
}

export async function submitQueryDiff(
  params: QueryDiffParams,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
) {
  return await submitRun("query_diff", params, options, client);
}
