// packages/ui/src/api/types/run.ts
// Run types for @datarecce/ui API layer
// These types define the structure of run objects and their variants

import type {
  QueryDiffParams,
  QueryDiffResult,
  QueryResult,
  QueryRunParams,
} from "../adhocQuery";
import type { LineageDiffResult } from "../info";
// Import param/result types from API modules
import type {
  HistogramDiffParams,
  HistogramDiffResult,
  ProfileDiffParams,
  ProfileDiffResult,
  TopKDiffParams,
  TopKDiffResult,
} from "../profile";
import type {
  RowCountDiffParams,
  RowCountDiffResult,
  RowCountParams,
  RowCountResult,
} from "../rowcount";
import type {
  ValueDiffDetailParams,
  ValueDiffDetailResult,
  ValueDiffParams,
  ValueDiffResult,
} from "../valuediff";

// ============================================================================
// Run Type Enum
// ============================================================================

/**
 * All possible run types in the Recce system.
 * This is the canonical definition - consumers should import from here.
 */
export type RunType =
  | "simple"
  | "sandbox"
  | "query"
  | "query_base"
  | "query_diff"
  | "value_diff"
  | "value_diff_detail"
  | "schema_diff"
  | "profile"
  | "profile_diff"
  | "row_count"
  | "row_count_diff"
  | "lineage_diff"
  | "top_k_diff"
  | "histogram_diff";

// ============================================================================
// Run Status Types
// ============================================================================

/**
 * Possible status values for a run
 */
export type RunStatus = "finished" | "failed" | "cancelled" | "running";

/**
 * Progress information for a running task
 */
export interface RunProgress {
  message?: string;
  percentage?: number;
}

// ============================================================================
// Base Run Interface
// ============================================================================

/**
 * Base interface for all run objects.
 * All run variants extend this interface with specific params and results.
 */
export interface BaseRun {
  /** The type of run - determines params/result structure */
  type: RunType;
  /** Unique identifier for this run */
  run_id: string;
  /** ISO timestamp when the run was executed */
  run_at: string;
  /** Optional human-readable name for the run */
  name?: string;
  /** ID of the check this run belongs to, if any */
  check_id?: string;
  /** Progress information for running tasks */
  progress?: RunProgress;
  /** Error message if the run failed */
  error?: string;
  /** Current status of the run */
  status?: RunStatus;
}

// ============================================================================
// Run Param Types (without external dependencies)
// ============================================================================

/**
 * Schema diff params - used by schema_diff runs
 * Compares schema between base and current environments
 */
export interface SchemaDiffParams {
  /** Node ID(s) to compare - can be single or multiple */
  node_id?: string | string[];
  /** dbt select syntax for filtering nodes */
  select?: string;
  /** dbt exclude syntax for filtering nodes */
  exclude?: string;
  /** Package names to include */
  packages?: string[];
  /** View mode - show all models or only changed ones */
  view_mode?: "all" | "changed_models";
}

/**
 * Lineage diff params - used by lineage_diff runs
 * Compares lineage graph between base and current environments
 */
export interface LineageDiffParams {
  /** dbt select syntax for filtering nodes */
  select?: string;
  /** dbt exclude syntax for filtering nodes */
  exclude?: string;
  /** Package names to include */
  packages?: string[];
  /** View mode - show all models or only changed ones */
  view_mode?: "all" | "changed_models";
}

// ============================================================================
// Run Param Types - Union of all possible run parameters
// ============================================================================

/**
 * Union of all possible run parameter types.
 * Use this when you need to accept any run params type.
 */
export type RunParamTypes =
  | QueryRunParams
  | QueryDiffParams
  | ValueDiffParams
  | ValueDiffDetailParams
  | SchemaDiffParams
  | ProfileDiffParams
  | RowCountParams
  | RowCountDiffParams
  | LineageDiffParams
  | TopKDiffParams
  | HistogramDiffParams
  | undefined;

// ============================================================================
// Run - Full Discriminated Union Type
// ============================================================================

/**
 * Run type with full discriminated union for type narrowing.
 * TypeScript can narrow params/result types based on the `type` field.
 *
 * Example:
 * ```ts
 * if (run.type === "query_diff") {
 *   // TypeScript knows run.result is QueryDiffResult | undefined
 *   console.log(run.result?.diff);
 * }
 * ```
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

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for simple runs
 */
export function isSimpleRun(run: Run): run is Run & { type: "simple" } {
  return run.type === "simple";
}

/**
 * Type guard for sandbox runs
 */
export function isSandboxRun(run: Run): run is Run & { type: "sandbox" } {
  return run.type === "sandbox";
}

/**
 * Type guard for query runs
 */
export function isQueryRun(run: Run): run is Run & { type: "query" } {
  return run.type === "query";
}

/**
 * Type guard for query_base runs
 */
export function isQueryBaseRun(run: Run): run is Run & { type: "query_base" } {
  return run.type === "query_base";
}

/**
 * Type guard for query_diff runs
 */
export function isQueryDiffRun(run: Run): run is Run & { type: "query_diff" } {
  return run.type === "query_diff";
}

/**
 * Type guard for value_diff runs
 */
export function isValueDiffRun(run: Run): run is Run & { type: "value_diff" } {
  return run.type === "value_diff";
}

/**
 * Type guard for value_diff_detail runs
 */
export function isValueDiffDetailRun(
  run: Run,
): run is Run & { type: "value_diff_detail" } {
  return run.type === "value_diff_detail";
}

/**
 * Type guard for schema_diff runs
 */
export function isSchemaDiffRun(
  run: Run,
): run is Run & { type: "schema_diff" } {
  return run.type === "schema_diff";
}

/**
 * Type guard for profile runs
 */
export function isProfileRun(run: Run): run is Run & { type: "profile" } {
  return run.type === "profile";
}

/**
 * Type guard for profile_diff runs
 */
export function isProfileDiffRun(
  run: Run,
): run is Run & { type: "profile_diff" } {
  return run.type === "profile_diff";
}

/**
 * Type guard for row_count runs
 */
export function isRowCountRun(run: Run): run is Run & { type: "row_count" } {
  return run.type === "row_count";
}

/**
 * Type guard for row_count_diff runs
 */
export function isRowCountDiffRun(
  run: Run,
): run is Run & { type: "row_count_diff" } {
  return run.type === "row_count_diff";
}

/**
 * Type guard for lineage_diff runs
 */
export function isLineageDiffRun(
  run: Run,
): run is Run & { type: "lineage_diff" } {
  return run.type === "lineage_diff";
}

/**
 * Type guard for top_k_diff runs
 */
export function isTopKDiffRun(run: Run): run is Run & { type: "top_k_diff" } {
  return run.type === "top_k_diff";
}

/**
 * Type guard for histogram_diff runs
 */
export function isHistogramDiffRun(
  run: Run,
): run is Run & { type: "histogram_diff" } {
  return run.type === "histogram_diff";
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Array of all run type values - useful for iteration and validation
 */
export const RUN_TYPES: readonly RunType[] = [
  "simple",
  "sandbox",
  "query",
  "query_base",
  "query_diff",
  "value_diff",
  "value_diff_detail",
  "schema_diff",
  "profile",
  "profile_diff",
  "row_count",
  "row_count_diff",
  "lineage_diff",
  "top_k_diff",
  "histogram_diff",
] as const;

/**
 * Check if a string is a valid RunType
 */
export function isValidRunType(value: string): value is RunType {
  return RUN_TYPES.includes(value as RunType);
}

/**
 * Run types that support screenshot/ref functionality.
 * These are run types that render a visual result view with forwardRef support.
 */
const RUN_TYPES_WITH_REF: readonly RunType[] = [
  "query",
  "query_base",
  "query_diff",
  "row_count",
  "row_count_diff",
  "profile",
  "profile_diff",
  "value_diff",
  "value_diff_detail",
  "top_k_diff",
  "histogram_diff",
] as const;

/**
 * Check if a run type supports ref forwarding (for screenshots).
 * Run types with refs can capture screenshots of their result views.
 */
export function runTypeHasRef(runType: RunType): boolean {
  return RUN_TYPES_WITH_REF.includes(runType);
}
