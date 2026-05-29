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
 *
 * Note: ``profile_distribution`` is a backend-only run type (DRC-3390). It
 * feeds into schema-view cells rather than rendering as a checklist run, so
 * the run registry has no entry for it — `findByRunType` returns `undefined`.
 * The dispatcher accepts it; the registry does not.
 */
export type RunType =
  | "simple"
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
  | "histogram_diff"
  | "profile_distribution";

// ============================================================================
// Run Status Types
// ============================================================================

/**
 * Possible status values for a run
 */
export type RunStatus = "Finished" | "Failed" | "Cancelled" | "Running";

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
  /** Who triggered this run: "user" | "recce_ai" */
  triggered_by?: string;
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
  | ProfileDistributionParams
  | undefined;

// ============================================================================
// Profile Distribution (DRC-3390 Stage B)
//
// Backend-only run type — Stage C's schema-view cells consume these payloads,
// they don't render as a checklist run. The shape is the API contract Stage B
// freezes; the backend serves DuckDB; non-DuckDB adapters return the
// ``unsupported`` envelope variant.
// ============================================================================

/**
 * Params for a profile_distribution run.
 *
 * Pass ``model`` (the dbt model unique id) and optionally a ``columns``
 * subset to scope the run to just those columns. Omit ``columns`` to profile
 * every non-skipped column in the model.
 */
export interface ProfileDistributionParams {
  model: string;
  columns?: string[];
}

/**
 * Paired-histogram payload for a continuous (numeric or datetime) column.
 *
 * Each env carries its OWN edge array, built from its OWN quantiles:
 * ``base_bin_edges`` / ``current_bin_edges`` each hold 12 edges, paired with
 * ``base_density`` / ``current_density`` of 11 entries each. The two edge
 * arrays intentionally do NOT line up — the backend renders each env on its
 * own quantile spans (``density = (1/NUM_BINS)/span``), the only assumption-
 * free rendering of percentile-only data. The frontend overlays the two
 * staircases on a shared value axis; it must not assume aligned bins. See
 * PR #1398 / DRC-3390 for the contract rationale.
 *
 * Edge encoding is always numeric, but the UNIT depends on the column type:
 * numeric columns emit raw values, datetime columns emit epoch SECONDS (the
 * DRC-3504 ``epoch()`` cast). The payload carries no numeric-vs-datetime
 * marker, so the consumer must use the column's out-of-band dbt type to
 * decide whether to format edges as dates. Stage C owns that formatting.
 */
export interface ProfileDistributionHistogramPayload {
  kind: "histogram";
  /** Numeric values, or epoch seconds for datetime columns — see above. */
  base_bin_edges: number[];
  current_bin_edges: number[];
  base_density: number[];
  current_density: number[];
  base_total: number;
  current_total: number;
}

/**
 * Categorical top-K payload, **counts mode** — emitted by adapters whose
 * sketch exposes per-value counts (Snowflake / BigQuery / … in Stage D).
 *
 * ``values`` is the union of the two envs' top-K, in current-then-base order.
 * ``base_counts`` / ``current_counts`` are aligned onto ``values`` (same
 * length, ``null`` in the slots where that env didn't have the value in its
 * top-K — Stage C renders those as gap-on-absent). The column-wide
 * denominator for proportions is the envelope's ``base_total`` /
 * ``current_total``, not the sum of the shown slots.
 *
 * When the adapter exposes **no** counts (DuckDB ``approx_top_k`` in Stage B),
 * the backend emits {@link ProfileDistributionTopKRanksPayload} instead — the
 * counts arrays here are therefore never wholly ``null``.
 *
 * ``trimmed`` is true when either env hit the sketch's ``k`` cap, meaning
 * there are more distinct values than fit in the slice.
 */
export interface ProfileDistributionTopKPayload {
  kind: "topk";
  /** Absent or ``"counts"`` selects this variant (vs ``"ranks"``). */
  mode?: "counts";
  values: unknown[];
  base_counts: (number | null)[];
  current_counts: (number | null)[];
  trimmed: boolean;
}

/**
 * Categorical top-K payload, **ranks mode** — emitted when the adapter
 * returns the top-K values but no counts (DuckDB ``approx_top_k``, the
 * Stage B hot path). Bar heights encode rank position only.
 *
 * Slot order is baked in by the backend: base's top-K in base-rank order,
 * then values present only in current's top-K appended on the right (in
 * current-rank order). ``base_ranks`` / ``current_ranks`` carry each value's
 * 1-indexed rank within that env's top-K, or ``null`` where the value isn't
 * in that env's top-K (no bar drawn for that side — gap-on-absent). ``k`` is
 * the top-K cap, driving bar-height scaling.
 *
 * Promoting this variant into the wire contract (it previously lived only in
 * the Storybook fixtures) is what lets DuckDB categorical columns render a
 * real paired cell — see DRC-3390's 2026-05-29 contract correction.
 */
export interface ProfileDistributionTopKRanksPayload {
  kind: "topk";
  mode: "ranks";
  values: unknown[];
  base_ranks: (number | null)[];
  current_ranks: (number | null)[];
  k: number;
  trimmed: boolean;
}

/**
 * Per-column failure marker — the column was attempted but couldn't be
 * computed (e.g., its percentile fragment errored even after the per-column
 * retry path). The frontend renders the column's cell as an inline error
 * without blanking the rest of the row.
 */
export interface ProfileDistributionNullPayload {
  kind: null;
}

/**
 * Per-column payload — one of the variants above. Stage C narrows on ``kind``
 * (histogram / topk / null), then on ``mode`` within ``topk`` (counts vs
 * ranks), to pick the right cell renderer.
 */
export type ProfileDistributionColumnPayload =
  | ProfileDistributionHistogramPayload
  | ProfileDistributionTopKPayload
  | ProfileDistributionTopKRanksPayload
  | ProfileDistributionNullPayload;

/**
 * "Ok" envelope — the adapter supports the feature; ``columns`` holds the
 * per-column payloads keyed by column name.
 */
export interface ProfileDistributionOkResult {
  status: "ok";
  /** Strategy router picked this branch — Stage B only emits ``approx_all``. */
  strategy: "approx_all";
  columns: Record<string, ProfileDistributionColumnPayload>;
  base_total: number;
  current_total: number;
  /** True when this payload came from the in-memory memoization cache. */
  cache_hit?: boolean;
}

/**
 * "Unsupported" envelope — the adapter lacks native approximate-aggregate
 * support. Stage B's hot path for everything that isn't DuckDB; Stage D
 * extends adapter coverage so fewer adapters fall here.
 *
 * Stage C renders a single banner (not per-column markers) when it sees
 * this envelope.
 */
export interface ProfileDistributionUnsupportedResult {
  status: "unsupported";
  reason: string;
  columns: Record<string, never>;
}

/**
 * Discriminated union for the profile_distribution result.
 *
 * Narrow on ``status``:
 * ```ts
 * if (result.status === "ok") {
 *   // result.columns is fully typed
 * } else {
 *   // result.reason is the unsupported banner message
 * }
 * ```
 */
export type ProfileDistributionResult =
  | ProfileDistributionOkResult
  | ProfileDistributionUnsupportedResult;

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
    })
  | (BaseRun & {
      type: "profile_distribution";
      params?: ProfileDistributionParams;
      result?: ProfileDistributionResult;
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
  "profile_distribution",
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
 *
 * Declared with ``as const satisfies readonly RunType[]`` so the literal-tuple
 * type survives — that lets {@link runTypeHasRef} act as a true type guard
 * narrowing to ``RunTypeWithRef`` instead of bare ``boolean``.
 */
const RUN_TYPES_WITH_REF = [
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
] as const satisfies readonly RunType[];

/**
 * Subset of {@link RunType} whose result view supports forwardRef. A narrower
 * type than ``RunType`` so a positive {@link runTypeHasRef} check transitively
 * narrows to a registered run type (every entry here also has a registry entry).
 */
export type RunTypeWithRef = (typeof RUN_TYPES_WITH_REF)[number];

/**
 * Check if a run type supports ref forwarding (for screenshots).
 * Run types with refs can capture screenshots of their result views.
 */
export function runTypeHasRef(runType: RunType): runType is RunTypeWithRef {
  return (RUN_TYPES_WITH_REF as readonly RunType[]).includes(runType);
}
