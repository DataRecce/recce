// ============================================================================
// Re-export base types from @datarecce/ui/api library
// ============================================================================

export type {
  AxiosQueryParams,
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowData,
  RowDataTypes,
  RowObjectType,
} from "@datarecce/ui/api";

// ============================================================================
// Re-export run types from @datarecce/ui/api library
// ============================================================================

export type {
  BaseRun,
  LineageDiffParams,
  RunProgress,
  RunStatus,
  RunType,
  SchemaDiffParams,
} from "@datarecce/ui/api";

// Re-export type guards and utilities
export {
  isHistogramDiffRun,
  isLineageDiffRun,
  isProfileDiffRun,
  isProfileRun,
  isQueryBaseRun,
  isQueryDiffRun,
  isQueryRun,
  isRowCountDiffRun,
  isRowCountRun,
  isSandboxRun,
  isSchemaDiffRun,
  isSimpleRun,
  isTopKDiffRun,
  isValidRunType,
  isValueDiffDetailRun,
  isValueDiffRun,
  RUN_TYPES,
} from "@datarecce/ui/api";

// ============================================================================
// Re-export param types from API files
// ============================================================================

// Import RunType and BaseRun for local Run union
import type {
  BaseRun,
  LineageDiffParams,
  RunType,
  SchemaDiffParams,
} from "@datarecce/ui/api";
// These are imported from local files because they're used in the OSS-specific
// Run discriminated union below, which includes OSS-specific tracking behavior
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
