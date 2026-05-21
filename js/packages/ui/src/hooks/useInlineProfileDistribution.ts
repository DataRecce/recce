"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { cacheKeys } from "../api/cacheKeys";
import {
  isHistogramPayload,
  isNullPayload,
  isTopKPayload,
  isUnsupportedResult,
  submitProfileDistribution,
} from "../api/profileDistribution";
import type {
  ProfileDistributionColumnResult,
  ProfileDistributionResult,
  Run,
} from "../api/types";
import { trackProfileDistribution } from "../lib/api/track";
import { useApiConfig } from "./useApiConfig";

/**
 * Inline paired-distribution loader for a single dbt model. DRC-3390 PR 3.
 *
 * Fires one `PROFILE_DISTRIBUTION` run per `(model)` cache key, parses the
 * discriminated-union payload PR 2 produces, and returns a stable
 * `{distributions, loading, error, isUnsupported, unsupportedReason}`
 * shape that the schema-row integration consumes per column.
 *
 * Pattern was lifted from the (pre-existing in plan, missing from PR 1)
 * `useInlineProfile` hook outlined in the PR 3 spec: fetch on demand
 * scoped to the model, share results across rows via TanStack Query's
 * cache, gate behind the `inline_profile` server flag at the caller, and
 * emit analytics events at the boundary.
 *
 * @example
 * ```tsx
 * function SchemaRow({ modelUniqueId, columnName }: Props) {
 *   const flag = useRecceServerFlag();
 *   const enabled = flag.data?.inline_profile ?? false;
 *   const { distributions, loading, error, isUnsupported, unsupportedReason } =
 *     useInlineProfileDistribution(modelUniqueId, enabled);
 *   if (loading) return <Spinner />;
 *   if (isUnsupported) return <UnsupportedBanner reason={unsupportedReason} />;
 *   if (error) return <ErrorCell />;
 *   const payload = distributions[columnName];
 *   // ...render PairedHistogramContinuous / PairedHistogramDiscrete based on kind...
 * }
 * ```
 */
export interface UseInlineProfileDistributionResult {
  /** Per-column payloads keyed by column name. Empty until the run completes. */
  distributions: Record<string, ProfileDistributionColumnResult>;
  /** True while the run is in flight (initial load or refetch). */
  loading: boolean;
  /** Error from the run submission / wait path. */
  error: Error | null;
  /** True when the adapter doesn't support the feature (single envelope). */
  isUnsupported: boolean;
  /** Human-readable explanation; only set when `isUnsupported` is true. */
  unsupportedReason?: string;
  /** Raw result envelope — exposed for advanced callers (PR 4 pre-warm cache lookups). */
  raw?: ProfileDistributionResult;
}

/**
 * Type-narrowing helper. Tested in `__tests__/useInlineProfileDistribution.test.tsx`.
 */
function extractResult(
  run: Run | undefined,
): ProfileDistributionResult | undefined {
  if (!run) return undefined;
  if (run.type !== "profile_distribution") return undefined;
  return run.result;
}

/**
 * Count failed columns (`{kind: null}`) in a result envelope.
 *
 * Exported for analytics — both the hook and PR 4's pre-warm use it.
 */
export function countFailedColumns(
  result: ProfileDistributionResult | undefined,
): number {
  if (!result?.columns) return 0;
  let n = 0;
  for (const payload of Object.values(result.columns)) {
    if (isNullPayload(payload)) n += 1;
  }
  return n;
}

/**
 * Inline profile-distribution hook.
 *
 * @param model - dbt model `unique_id`. Falsy values disable the hook.
 * @param enabled - Caller-controlled enable flag. Pass the
 *   `inline_profile` server flag here so the hook short-circuits when
 *   the feature is off.
 */
export function useInlineProfileDistribution(
  model: string | undefined,
  enabled: boolean,
): UseInlineProfileDistributionResult {
  const { apiClient } = useApiConfig();

  const query = useQuery<ProfileDistributionResult, Error>({
    queryKey: cacheKeys.profileDistribution(model ?? ""),
    enabled: enabled && Boolean(model),
    queryFn: async () => {
      const startedAt = Date.now();
      trackProfileDistribution({ phase: "request", model });
      try {
        const submitted = (await submitProfileDistribution(
          { model: model as string },
          undefined,
          apiClient,
        )) as Run;
        const result = extractResult(submitted);
        if (!result) {
          // Backend completed but returned an unexpected shape — surface as error
          throw new Error(
            "profile_distribution run completed but returned no result payload",
          );
        }
        const columnCount = result.columns
          ? Object.keys(result.columns).length
          : 0;
        trackProfileDistribution({
          phase: "result",
          model,
          total_wall_ms: Date.now() - startedAt,
          column_count: columnCount,
          error_count: countFailedColumns(result),
          unsupported: isUnsupportedResult(result),
          cache_hit: false,
        });
        return result;
      } catch (err) {
        trackProfileDistribution({
          phase: "result",
          model,
          total_wall_ms: Date.now() - startedAt,
          error_count: 0,
          unsupported: false,
          cache_hit: false,
        });
        throw err;
      }
    },
    // Distribution results are deterministic per (model, manifest_hash);
    // tanstack's default cache + the backend memoization (PR 2) plus the
    // pre-warm path (PR 4) keep stale results out. Don't auto-refetch on
    // focus — it would re-issue heavy warehouse queries.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    retry: false,
  });

  // Memoize the distributions map so consumers (one per row) don't
  // re-render every time the hook re-runs.
  const distributions = useMemo(() => {
    const cols = query.data?.columns ?? {};
    // Normalize to a fresh object — keeps consumer-side referential
    // equality predictable across stable backend results.
    return { ...cols };
  }, [query.data]);

  const isUnsupported = isUnsupportedResult(query.data);

  return {
    distributions,
    loading: query.isPending || query.isFetching,
    error: query.error ?? null,
    isUnsupported,
    unsupportedReason: isUnsupported ? query.data?.reason : undefined,
    raw: query.data,
  };
}

/**
 * Convenience selector: return the column-level payload, narrowing by
 * `kind`. Returns `undefined` for `kind: null` slots so callers can skip
 * rendering without an explicit check.
 */
export function pickColumnPayload(
  result: UseInlineProfileDistributionResult,
  columnName: string,
):
  | { kind: "histogram"; payload: ProfileDistributionColumnResult }
  | { kind: "topk"; payload: ProfileDistributionColumnResult }
  | undefined {
  const payload = result.distributions[columnName];
  if (!payload) return undefined;
  if (isHistogramPayload(payload)) return { kind: "histogram", payload };
  if (isTopKPayload(payload)) return { kind: "topk", payload };
  return undefined;
}
