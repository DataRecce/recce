"use client";

import { useQuery } from "@tanstack/react-query";

import { cacheKeys } from "../../api/cacheKeys";
import {
  getRecceInstanceInfo,
  type RecceInstanceInfo,
} from "../../api/instanceInfo";
import { useApiConfig } from "../../providers/contexts/ApiContext";

/**
 * Hook to fetch Recce instance information from the server.
 *
 * Uses TanStack Query to cache the response and the configured API client.
 *
 * @returns Query result with RecceInstanceInfo data
 *
 * @example
 * ```tsx
 * function InstanceStatus() {
 *   const { data, isLoading, error } = useRecceInstanceInfo();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error loading instance info</div>;
 *
 *   return <div>Server mode: {data?.server_mode}</div>;
 * }
 * ```
 */
export function useRecceInstanceInfo() {
  const { apiClient } = useApiConfig();

  return useQuery<RecceInstanceInfo>({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: () => getRecceInstanceInfo(apiClient),
  });
}
