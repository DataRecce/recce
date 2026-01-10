"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cacheKeys } from "../../api/cacheKeys";
import { getServerFlag, type RecceServerFlags } from "../../api/flag";
import { useApiConfigOptional } from "../../providers/contexts/ApiContext";

// Default axios client for use outside RecceProvider (OSS mode)
const defaultApiClient = axios.create();

/**
 * Hook to fetch server-side feature flags.
 *
 * Uses TanStack Query to cache and manage flag state.
 * Works both inside RecceProvider (uses configured client) and outside (uses default axios).
 *
 * @returns TanStack Query result with RecceServerFlags data
 */
export function useRecceServerFlag() {
  const apiConfig = useApiConfigOptional();
  const apiClient = apiConfig?.apiClient ?? defaultApiClient;

  return useQuery<RecceServerFlags>({
    queryKey: cacheKeys.flag(),
    queryFn: () => getServerFlag(apiClient),
  });
}
