// Import types for local Run union from @datarecce/ui/api
import type {
  BaseRun,
  HistogramDiffParams,
  HistogramDiffResult,
  LineageDiffParams,
  ProfileDiffParams,
  ProfileDiffResult,
  QueryDiffParams,
  QueryDiffResult,
  QueryResult,
  QueryRunParams,
  RowCountDiffParams,
  RowCountDiffResult,
  RowCountParams,
  RowCountResult,
  SchemaDiffParams,
  TopKDiffParams,
  TopKDiffResult,
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffParams,
  ValueDiffResult,
} from "@datarecce/ui/api";
import type { LineageDiffResult } from "./info";

// ============================================================================
// Run Param Types - Union of all possible run parameters
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

// ============================================================================
// Run - Discriminated Union Type (OSS-specific with full type narrowing)
// ============================================================================

/**
 * OSS-specific Run type with full discriminated union for type narrowing.
 * This extends the library's BaseRun with specific params/result types.
 */
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
