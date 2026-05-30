"use client";

import {
  type UseQueryOptions,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { cacheKeys, getServerInfo, type ServerInfoResult } from "../api";
import { useApiConfig } from "./useApiConfig";

type ServerInfoQueryOptions<TSelected = ServerInfoResult> = Omit<
  UseQueryOptions<ServerInfoResult, Error, TSelected>,
  "queryKey" | "queryFn"
>;

/**
 * Shared subscription to `/api/info`. Owns the canonical queryKey/queryFn used
 * by both `LineageGraphAdapter` (the primary fetcher) and downstream consumers
 * like `StalenessBanner`. React Query deduplicates by key, so multiple call
 * sites do not trigger extra network round-trips.
 *
 * Returns the full `UseQueryResult` so callers can opt into `error`,
 * `isLoading`, etc. Pass `select` via the options arg to scope re-renders to
 * a single field.
 */
export function useServerInfo<TSelected = ServerInfoResult>(
  options?: ServerInfoQueryOptions<TSelected>,
): UseQueryResult<TSelected, Error> {
  const { apiClient } = useApiConfig();
  return useQuery({
    queryKey: cacheKeys.lineage(),
    queryFn: () => getServerInfo(apiClient),
    ...options,
  });
}
