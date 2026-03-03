"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { cacheKeys } from "../../api/cacheKeys";
import {
  getRecceInstanceInfo,
  type RecceInstanceInfo,
} from "../../api/instanceInfo";
import { useApiConfigOptional } from "../../providers/contexts/ApiContext";

// Default axios client for use outside RecceProvider (OSS mode)
const defaultApiClient = axios.create();

/**
 * Hook to fetch Recce instance information from the server.
 *
 * Uses TanStack Query to cache the response and the configured API client.
 * Works both inside RecceProvider (uses configured client) and outside (uses default axios).
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
  const apiConfig = useApiConfigOptional();
  const apiClient = apiConfig?.apiClient ?? defaultApiClient;

  return useQuery<RecceInstanceInfo>({
    queryKey: cacheKeys.instanceInfo(),
    queryFn: () => getRecceInstanceInfo(apiClient),
  });
}
