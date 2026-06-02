import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import {
  type ProfileDistributionColumnPayload,
  type ProfileDistributionResult,
  type Run,
  submitProfileDistribution,
  waitRun,
} from "../api";
import { useRecceServerFlag } from "../contexts";
import { trackProfileDistribution } from "../lib/api/track";
import { useApiConfig } from "./useApiConfig";

/**
 * @file useInlineProfileDistribution.ts
 * @description DRC-3390 Stage C — fire-and-parse hook for inline paired
 * distributions in the schema view.
 *
 * Gated end-to-end on the `inline_profile` server flag: when the flag is off
 * (the default) the hook short-circuits to `disabled` and never submits a
 * run. When on, it submits one `profile_distribution` run per node, polls it
 * to completion, narrows the {@link ProfileDistributionResult} envelope, and
 * emits a single Amplitude timing event when the run settles.
 *
 * Polling follows the project's `useRun` pattern: a *submit* query fires the
 * run once per (node, columns) key, then a *poll* query does a single
 * `waitRun` long-poll per fetch and lets React Query's `refetchInterval`
 * re-poll until the run leaves `Running`. There is no internal poll loop, so
 * unmounting stops the polling immediately (at most one in-flight long-poll
 * is left to resolve and be discarded) rather than spinning until the run
 * happens to finish.
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
  /** True while the run is in flight (submit + poll). */
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

export function useInlineProfileDistribution(
  options: UseInlineProfileDistributionOptions,
): UseInlineProfileDistributionResult {
  const { model, columns, enabled = true } = options;
  const nodeId = options.nodeId ?? model;

  const { apiClient } = useApiConfig();
  const { data: serverFlags } = useRecceServerFlag();
  const flagEnabled = serverFlags?.inline_profile ?? false;

  const queryEnabled = flagEnabled && enabled && !!model;

  // Cache config shared by the submit + poll queries. The key is only
  // (nodeId, columns); it does NOT encode the manifest/run version, so a
  // re-run of the underlying diff is NOT auto-invalidated here. Staleness is
  // bounded by `gcTime` (5 min) and, in practice, by base/current being fixed
  // for a review session. Re-key on a manifest token if that changes.
  const keySuffix = columns?.join(",") ?? "*";
  const sharedCacheOpts = {
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  } as const;

  // Wall-clock start, captured when the submit fires so the timing event can
  // measure submit→resolved across the (separate) poll query.
  const submitStartRef = useRef<number>(0);

  // Stage 1 — submit the run exactly once per (node, columns) key. Returns
  // the run_id that the poll query keys off of.
  const { data: runId, error: submitError } = useQuery<string, Error>({
    queryKey: ["profile_distribution_submit", nodeId, keySuffix],
    queryFn: async () => {
      submitStartRef.current =
        typeof performance !== "undefined" ? performance.now() : 0;
      const submitted = await submitProfileDistribution(
        { model: model as string, columns },
        { nowait: true, trackProps: { source: "schema_view" } },
        apiClient,
      );
      return submitted.run_id;
    },
    enabled: queryEnabled,
    ...sharedCacheOpts,
  });

  // Stage 2 — poll the submitted run. One `waitRun` long-poll per fetch;
  // `refetchInterval` re-polls (mirroring `useRun`) until the run is terminal,
  // then returns false to stop. No internal loop ⇒ unmount halts polling.
  const {
    data: run,
    error: queryError,
    isFetching,
  } = useQuery<Run, Error>({
    queryKey: ["profile_distribution_run", runId ?? ""],
    queryFn: async () => (await waitRun(runId as string, 2, apiClient)) as Run,
    enabled: queryEnabled && !!runId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const running =
        !data || (data.status === "Running" && !data.result && !data.error);
      return running ? 50 : false;
    },
    ...sharedCacheOpts,
  });

  // Surface a run-level `error` field (task failed) as a hook error even
  // though the query itself resolved successfully.
  const runError = run?.error ? new Error(run.error) : undefined;

  // Track-once guard: emit the Amplitude timing event a single time per
  // resolved run, when it first reaches a terminal state.
  const trackedRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (!run) return;
    const normalizedStatus = run.status?.toLowerCase();
    const terminal =
      !!(run.result || run.error) ||
      (!!normalizedStatus && normalizedStatus !== "running");
    if (!terminal || trackedRunRef.current === run.run_id) return;
    trackedRunRef.current = run.run_id;
    const totalWallMs =
      typeof performance !== "undefined"
        ? Math.round(performance.now() - submitStartRef.current)
        : 0;
    emitTiming(run, totalWallMs);
  }, [run]);

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

    const error = submitError ?? queryError ?? runError ?? undefined;
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
  }, [queryEnabled, submitError, queryError, runError, run, isFetching]);
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
