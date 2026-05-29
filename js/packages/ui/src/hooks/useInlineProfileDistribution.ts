import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
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

  // Track-once guard: emit the Amplitude timing event a single time per
  // resolved run, not on every re-render that re-reads the cached query.
  const trackedRunRef = useRef<string | null>(null);

  const {
    data: run,
    error: queryError,
    isFetching,
  } = useQuery<Run, Error>({
    queryKey: ["profile_distribution", nodeId, columns?.join(",") ?? "*"],
    queryFn: async () => {
      const startedAt =
        typeof performance !== "undefined" ? performance.now() : 0;
      const submitted = await submitProfileDistribution(
        { model: model as string, columns },
        { nowait: true, trackProps: { source: "schema_view" } },
        apiClient,
      );
      let resolved = await waitRun(submitted.run_id, 2, apiClient);
      while (
        resolved.status === "Running" &&
        !resolved.result &&
        !resolved.error
      ) {
        resolved = await waitRun(submitted.run_id, 2, apiClient);
      }

      // Emit timing once, here in the queryFn so it fires exactly per fetch.
      if (trackedRunRef.current !== resolved.run_id) {
        trackedRunRef.current = resolved.run_id;
        const totalWallMs =
          typeof performance !== "undefined"
            ? Math.round(performance.now() - startedAt)
            : 0;
        emitTiming(resolved, totalWallMs);
      }
      return resolved;
    },
    enabled: queryEnabled,
    // The result is stable for a given (model, manifest) — don't re-poll on
    // window focus or remount. Schema re-runs invalidate via the query key.
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Surface a run-level `error` field (task failed) as a hook error even
  // though the query itself resolved successfully.
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
