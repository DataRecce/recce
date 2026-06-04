import { captureException } from "@sentry/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  type ProfileDistributionColumnPayload,
  type ProfileDistributionResult,
  type Run,
  submitProfileDistribution,
} from "../api";
import { useRecceServerFlag } from "../contexts";
import { trackProfileDistribution } from "../lib/api/track";
import { useApiConfig } from "./useApiConfig";

/**
 * @file useInlineProfileDistribution.ts
 * @description Fire-and-parse hook for inline paired
 * distributions in the schema view.
 *
 * Gated end-to-end on the `inline_profile` server flag: when the flag is off
 * (the default) the hook short-circuits to `disabled` and never submits a
 * run. When on, it submits one `profile_distribution` run per node, narrows
 * the {@link ProfileDistributionResult} envelope, and emits a single Amplitude
 * timing event when the run resolves.
 *
 * The run is submitted *synchronously* — `POST /api/runs` without `nowait`
 * runs the task and returns the completed run in the same response (see
 * `run_api.create_run_handler`). That's plenty for the DuckDB `approx_all`
 * path this ships, and lets the whole thing be one stock `useQuery` with no
 * hand-rolled submit/poll loop. CAVEAT: the OSS fetch client sets no request
 * timeout (`useApiConfig.ts`), so a slow remote-warehouse adapter would hold
 * this request open with no client-side abort — there is NO timeout error or
 * Sentry capture for that case today (tracked separately). Transport errors
 * that do occur (network failure, non-2xx) surface as the hook's `error` state
 * and a Sentry capture via the queryFn's catch.
 *
 * The run is keyed by `nodeId` so React Query memoizes it across re-renders
 * and remounts (e.g. toggling between schema tabs) — re-opening the same node
 * serves the cached result instead of re-running the warehouse queries. The
 * backend has its own in-memory memoization on top of this (`cache_hit`).
 */

export type InlineProfileDistributionStatus =
  | "disabled"
  | "loading"
  | "ok"
  | "unsupported"
  | "error";

export interface UseInlineProfileDistributionOptions {
  /** dbt model name, sent as `params.model`. Required to fire the run. */
  model?: string;
  /**
   * Stable identity used for the query cache key. Defaults to `model`. Pass
   * the node's `unique_id` when two nodes can share a model name.
   */
  nodeId?: string;
  /** Optional column subset; omit to profile every non-skipped column. */
  columns?: string[];
  /**
   * Caller-side gate layered on top of the server flag — e.g. only fetch
   * while the schema view is actually mounted/visible. Defaults to `true`.
   */
  enabled?: boolean;
}

export interface UseInlineProfileDistributionResult {
  /** Coarse state for the consuming UI to switch on. */
  status: InlineProfileDistributionStatus;
  /** True while the run is in flight. */
  isLoading: boolean;
  /**
   * Per-column payloads keyed by column name. Empty unless `status === "ok"`.
   * Columns absent from this map have no distribution data (skipped/unknown).
   */
  columns: Record<string, ProfileDistributionColumnPayload>;
  /** Human-readable reason from the `unsupported` envelope, if any. */
  unsupportedReason?: string;
  /** Set when the run itself failed (network / task error), not a per-column failure. */
  error?: Error;
  /** Envelope-level row totals (the counts-mode denominator). 0 unless `ok`. */
  baseTotal: number;
  currentTotal: number;
}

const EMPTY_COLUMNS: Record<string, ProfileDistributionColumnPayload> = {};

/** Count per-column payloads that came back as a `kind: null` failure. */
function countColumnFailures(
  columns: Record<string, ProfileDistributionColumnPayload>,
): number {
  let failures = 0;
  for (const payload of Object.values(columns)) {
    if (payload.kind === null) failures += 1;
  }
  return failures;
}

const elapsedMs = (startMs: number): number =>
  typeof performance !== "undefined"
    ? Math.round(performance.now() - startMs)
    : 0;

export function useInlineProfileDistribution(
  options: UseInlineProfileDistributionOptions,
): UseInlineProfileDistributionResult {
  const { model, columns, enabled = true } = options;
  const nodeId = options.nodeId ?? model;

  const { apiClient } = useApiConfig();
  const { data: serverFlags } = useRecceServerFlag();
  const flagEnabled = serverFlags?.inline_profile ?? false;

  const queryEnabled = flagEnabled && enabled && !!model;

  // The cache key is only (nodeId, columns); it does NOT encode the
  // manifest/run version, so a re-run of the underlying diff is NOT
  // auto-invalidated here. Staleness is bounded by `gcTime` (5 min) and, in
  // practice, by base/current being fixed for a review session. Re-key on a
  // manifest token if that changes.
  //
  // `JSON.stringify` (not `join(",")`) so the per-column segments stay
  // unambiguous: `["a,b"]` and `["a","b"]` must map to different cache keys —
  // a comma is a legal character inside a quoted SQL identifier even if dbt
  // names rarely contain one. `*` is the all-columns sentinel.
  const keySuffix = columns ? JSON.stringify(columns) : "*";

  const {
    data: run,
    error: queryError,
    isFetching,
  } = useQuery<Run, Error>({
    queryKey: ["profile_distribution", nodeId, keySuffix],
    queryFn: async () => {
      const start = typeof performance !== "undefined" ? performance.now() : 0;
      try {
        // No `nowait`: the server runs the task and returns the completed run
        // in one response. One request, one resolved result — no poll loop.
        const resolved = (await submitProfileDistribution(
          { model: model as string, columns },
          { trackProps: { source: "schema_view" } },
          apiClient,
        )) as Run;
        emitTiming(resolved, elapsedMs(start));
        return resolved;
      } catch (err) {
        // Transport-level failure: network, HTTP 5xx, or a client timeout on
        // a slow run (the fetch client wraps `AbortSignal.timeout` as an
        // `HttpError` with status 0). Emit the error timing, flag it in Sentry
        // so timeouts are visible, then rethrow for React Query's error state.
        trackProfileDistribution({
          status: "error",
          total_wall_ms: elapsedMs(start),
          column_count: 0,
          error_count: 0,
        });
        captureException(err, {
          tags: { feature: "inline_profile_distribution" },
        });
        throw err;
      }
    },
    enabled: queryEnabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    // Keep the previously-resolved histograms on screen while a *wider* query
    // for the same node loads (e.g. "Profile all columns" re-requests every
    // column) so the grid doesn't flash back to pending dots — the columns
    // already profiled stay rendered, the new ones stream in. Scoped to the
    // same nodeId: navigating to a different node must NOT show the previous
    // node's distributions, so we drop the placeholder when the node changes.
    placeholderData: (previous, previousQuery) =>
      previousQuery && previousQuery.queryKey[1] === nodeId
        ? previous
        : undefined,
  });

  // A run that resolved but carries a task-level `error` field (rare in the
  // synchronous path, which usually throws instead) is surfaced as an error.
  const runError = run?.error ? new Error(run.error) : undefined;

  return useMemo<UseInlineProfileDistributionResult>(() => {
    if (!queryEnabled) {
      return {
        status: "disabled",
        isLoading: false,
        columns: EMPTY_COLUMNS,
        baseTotal: 0,
        currentTotal: 0,
      };
    }

    const error = queryError ?? runError ?? undefined;
    if (error) {
      return {
        status: "error",
        isLoading: false,
        columns: EMPTY_COLUMNS,
        error,
        baseTotal: 0,
        currentTotal: 0,
      };
    }

    const result =
      run?.type === "profile_distribution"
        ? (run.result as ProfileDistributionResult | undefined)
        : undefined;

    if (!result) {
      return {
        status: "loading",
        isLoading: true,
        columns: EMPTY_COLUMNS,
        baseTotal: 0,
        currentTotal: 0,
      };
    }

    if (result.status === "unsupported") {
      return {
        status: "unsupported",
        isLoading: false,
        columns: EMPTY_COLUMNS,
        unsupportedReason: result.reason,
        baseTotal: 0,
        currentTotal: 0,
      };
    }

    return {
      status: "ok",
      isLoading: isFetching,
      columns: result.columns,
      baseTotal: result.base_total,
      currentTotal: result.current_total,
    };
  }, [queryEnabled, queryError, runError, run, isFetching]);
}

/** Map a resolved run to the Amplitude timing payload and emit it. */
function emitTiming(run: Run, totalWallMs: number): void {
  if (run.error) {
    trackProfileDistribution({
      status: "error",
      total_wall_ms: totalWallMs,
      column_count: 0,
      error_count: 0,
    });
    return;
  }
  const result =
    run.type === "profile_distribution"
      ? (run.result as ProfileDistributionResult | undefined)
      : undefined;
  if (!result || result.status === "unsupported") {
    trackProfileDistribution({
      status: "unsupported",
      total_wall_ms: totalWallMs,
      column_count: 0,
      error_count: 0,
    });
    return;
  }
  trackProfileDistribution({
    status: "ok",
    strategy: result.strategy,
    total_wall_ms: totalWallMs,
    column_count: Object.keys(result.columns).length,
    error_count: countColumnFailures(result.columns),
    cache_hit: result.cache_hit,
  });
}
