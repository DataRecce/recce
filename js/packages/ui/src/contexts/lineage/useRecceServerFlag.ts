"use client";

import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "../../api/cacheKeys";
import { getServerFlag, type RecceServerFlags } from "../../api/flag";
import { useApiConfig } from "../../providers/contexts/ApiContext";

/**
 * Hook to fetch server-side feature flags.
 *
 * Uses TanStack Query to cache and manage flag state.
 *
 * @returns TanStack Query result with RecceServerFlags data
 */
export function useRecceServerFlag() {
  const { apiClient } = useApiConfig();

  return useQuery<RecceServerFlags>({
    queryKey: cacheKeys.flag(),
    queryFn: () => getServerFlag(apiClient),
  });
}
