// ============================================================================
// Base Types
// ============================================================================

export type AxiosQueryParams = Record<
  string,
  string | string[] | number | number[] | undefined
>;

export type RowDataTypes = number | string | boolean | null | undefined;
export type RowData = RowDataTypes[];

export type RowObjectType = Record<string, RowDataTypes> & {
  __status: "added" | "removed" | "modified" | undefined;
  _index?: number;
};

export type ColumnType =
  | "number"
  | "integer"
  | "text"
  | "boolean"
  | "date"
  | "datetime"
  | "timedelta"
  | "unknown";

export type ColumnRenderMode =
  | "raw"
  | "percent"
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9;

export interface DataFrame {
  columns: {
    key: string;
    name: string;
    type: ColumnType;
  }[];
  data: RowData[];
  limit?: number;
  more?: boolean;
}

// ============================================================================
// Run Types - Strict enum without string union
// ============================================================================

// ============================================================================
// Inline Param Definitions (defined here to avoid circular dependencies)
// ============================================================================

// Import types that are defined in other files
import { RunType } from "@/components/run/registry";
import type {
  QueryDiffParams,
  QueryDiffResult,
  QueryResult,
  QueryRunParams,
} from "./adhocQuery";
import type { LineageDiffResult } from "./info";
import type {
  HistogramDiffParams,
  HistogramDiffResult,
  ProfileDiffParams,
  ProfileDiffResult,
  TopKDiffParams,
  TopKDiffResult,
} from "./profile";
import type {
  RowCountDiffParams,
  RowCountDiffResult,
  RowCountParams,
  RowCountResult,
} from "./rowcount";
import type {
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffParams,
  ValueDiffResult,
} from "./valuediff";

// Define params that don't have their own files yet
export interface SchemaDiffParams {
  node_id?: string | string[];
  select?: string;
  exclude?: string;
  packages?: string[];
  view_mode?: "all" | "changed_models";
}

export interface LineageDiffParams {
  select?: string;
  exclude?: string;
  packages?: string[];
  view_mode?: "all" | "changed_models";
}

// ============================================================================
// Run - Discriminated Union Type
// ============================================================================

export type RunParamTypes =
  | QueryRunParams
  | QueryDiffParams
  | ValueDiffParams
  | SchemaDiffParams
  | ProfileDiffParams
  | RowCountParams
  | RowCountDiffParams
  | LineageDiffParams
  | TopKDiffParams
  | HistogramDiffParams
  | undefined;

interface BaseRun {
  type: RunType;
  run_id: string;
  run_at: string;
  name?: string;
  check_id?: string;
  progress?: {
    message?: string;
    percentage?: number;
  };
  error?: string;
  status?: "finished" | "failed" | "cancelled" | "running";
}

export type Run =
  | (BaseRun & {
      type: "simple";
      params?: undefined;
      result?: undefined;
    })
  | (BaseRun & {
      type: "sandbox";
      params?: undefined;
      result?: undefined;
    })
  | (BaseRun & {
      type: "query";
      params?: QueryRunParams;
      result?: QueryResult;
    })
  | (BaseRun & {
      type: "query_base";
      params?: QueryRunParams;
      result?: QueryResult;
    })
  | (BaseRun & {
      type: "query_diff";
      params?: QueryDiffParams;
      result?: QueryDiffResult;
    })
  | (BaseRun & {
      type: "value_diff";
      params?: ValueDiffParams;
      result?: ValueDiffResult;
    })
  | (BaseRun & {
      type: "value_diff_detail";
      params?: ValueDiffDetailParams;
      result?: ValueDiffDetailResult;
    })
  | (BaseRun & {
      type: "schema_diff";
      params?: SchemaDiffParams;
      result?: undefined;
    })
  | (BaseRun & {
      type: "profile";
      params?: ProfileDiffParams;
      result?: ProfileDiffResult;
    })
  | (BaseRun & {
      type: "profile_diff";
      params?: ProfileDiffParams;
      result?: ProfileDiffResult;
    })
  | (BaseRun & {
      type: "row_count";
      params?: RowCountParams;
      result?: RowCountResult;
    })
  | (BaseRun & {
      type: "row_count_diff";
      params?: RowCountDiffParams;
      result?: RowCountDiffResult;
    })
  | (BaseRun & {
      type: "lineage_diff";
      params?: LineageDiffParams;
      result?: LineageDiffResult;
    })
  | (BaseRun & {
      type: "top_k_diff";
      params?: TopKDiffParams;
      result?: TopKDiffResult;
    })
  | (BaseRun & {
      type: "histogram_diff";
      params?: HistogramDiffParams;
      result?: HistogramDiffResult;
    });

// ============================================================================
// Type Guards
// ============================================================================

export function isSimpleRun(run: Run): run is Extract<Run, { type: "simple" }> {
  return run.type === "simple";
}

export function isQueryRun(run: Run): run is Extract<Run, { type: "query" }> {
  return run.type === "query";
}

export function isQueryBaseRun(
  run: Run,
): run is Extract<Run, { type: "query_base" }> {
  return run.type === "query_base";
}

export function isQueryDiffRun(
  run: Run,
): run is Extract<Run, { type: "query_diff" }> {
  return run.type === "query_diff";
}

export function isValueDiffRun(
  run: Run,
): run is Extract<Run, { type: "value_diff" }> {
  return run.type === "value_diff";
}

export function isValueDiffDetailRun(
  run: Run,
): run is Extract<Run, { type: "value_diff_detail" }> {
  return run.type === "value_diff_detail";
}

export function isSchemaDiffRun(
  run: Run,
): run is Extract<Run, { type: "schema_diff" }> {
  return run.type === "schema_diff";
}

export function isProfileRun(
  run: Run,
): run is Extract<Run, { type: "profile" }> {
  return run.type === "profile";
}

export function isProfileDiffRun(
  run: Run,
): run is Extract<Run, { type: "profile_diff" }> {
  return run.type === "profile_diff";
}

export function isRowCountRun(
  run: Run,
): run is Extract<Run, { type: "row_count" }> {
  return run.type === "row_count";
}

export function isRowCountDiffRun(
  run: Run,
): run is Extract<Run, { type: "row_count_diff" }> {
  return run.type === "row_count_diff";
}

export function isLineageDiffRun(
  run: Run,
): run is Extract<Run, { type: "lineage_diff" }> {
  return run.type === "lineage_diff";
}

export function isTopKDiffRun(
  run: Run,
): run is Extract<Run, { type: "top_k_diff" }> {
  return run.type === "top_k_diff";
}

export function isHistogramDiffRun(
  run: Run,
): run is Extract<Run, { type: "histogram_diff" }> {
  return run.type === "histogram_diff";
}
