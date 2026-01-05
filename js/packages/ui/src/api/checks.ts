"use client";

import { useQuery } from "@tanstack/react-query";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { useApiConfigOptional } from "../providers/contexts/ApiContext";
import { cacheKeys } from "./cacheKeys";
import type { Run, RunType } from "./types";

// ============================================================================
// Types
// ============================================================================

/**
 * A check object representing a saved validation check.
 * @template PT - The type of params for this check
 * @template VO - The type of view options for this check
 */
export interface Check<PT = unknown, VO = unknown> {
  check_id: string;
  name: string;
  description?: string;
  type: RunType;
  params?: PT;
  view_options?: VO;
  is_checked?: boolean;
  is_preset?: boolean;
  last_run?: Run;
}

/**
 * Request body for creating a new check.
 */
export interface CreateCheckBody {
  name?: string;
  description?: string;
  run_id?: string;
  type?: RunType;
  params?: Record<string, unknown>;
  view_options?: Record<string, unknown>;
  track_props?: Record<string, unknown>;
}

// ============================================================================
// Default Client (for hooks used outside RecceProvider)
// ============================================================================

/**
 * Default axios client for hooks that may be used outside RecceProvider.
 * This is a fallback - components inside RecceProvider will use the configured client.
 */
const defaultApiClient = axios.create();

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a simple check (no run association).
 * @param client - Required axios instance
 * @returns The created check
 */
export async function createSimpleCheck(client: AxiosInstance): Promise<Check> {
  const response = await client.post<CreateCheckBody, AxiosResponse<Check>>(
    "/api/checks",
    {
      type: "simple",
    },
  );
  return response.data;
}

/**
 * Create a check from an existing run.
 * @param runId - The ID of the run to create a check from
 * @param viewOptions - Optional view options for the check
 * @param client - Required axios instance
 * @returns The created check
 */
export async function createCheckByRun(
  runId: string,
  viewOptions: Record<string, unknown> | undefined,
  client: AxiosInstance,
): Promise<Check> {
  // NOTE: Removed getExperimentTrackingBreakingChangeEnabled() - OSS-specific
  const response = await client.post<CreateCheckBody, AxiosResponse<Check>>(
    "/api/checks",
    {
      run_id: runId,
      view_options: viewOptions,
    },
  );
  return response.data;
}

/**
 * List all checks.
 * @param client - Required axios instance
 * @returns Array of all checks
 */
export async function listChecks(client: AxiosInstance): Promise<Check[]> {
  return (await client.get<never, AxiosResponse<Check[]>>("/api/checks")).data;
}

/**
 * Get a check by ID.
 * @param checkId - The ID of the check to retrieve
 * @param client - Required axios instance
 * @returns The check object
 */
export async function getCheck(
  checkId: string,
  client: AxiosInstance,
): Promise<Check> {
  const response = await client.get<never, AxiosResponse<Check>>(
    `/api/checks/${checkId}`,
  );
  return response.data;
}

/**
 * Update an existing check.
 * @param checkId - The ID of the check to update
 * @param payload - Partial check data to update
 * @param client - Required axios instance
 * @returns The updated check
 */
export async function updateCheck(
  checkId: string,
  payload: Partial<Check>,
  client: AxiosInstance,
): Promise<Check> {
  const response = await client.patch<Partial<Check>, AxiosResponse<Check>>(
    `/api/checks/${checkId}`,
    payload,
  );
  return response.data;
}

/**
 * Delete a check.
 * @param checkId - The ID of the check to delete
 * @param client - Required axios instance
 * @returns The deleted check ID
 */
export async function deleteCheck(
  checkId: string,
  client: AxiosInstance,
): Promise<Pick<Check, "check_id">> {
  const response = await client.delete<
    never,
    AxiosResponse<Pick<Check, "check_id">>
  >(`/api/checks/${checkId}`);
  return response.data;
}

/**
 * Reorder checks.
 * @param order - Source and destination indices
 * @param client - Required axios instance
 */
export async function reorderChecks(
  order: {
    source: number;
    destination: number;
  },
  client: AxiosInstance,
): Promise<void> {
  await client.post("/api/checks/reorder", order);
}

/**
 * Mark a check as a preset check.
 * @param checkId - The ID of the check to mark as preset
 * @param client - Required axios instance
 */
export async function markAsPresetCheck(
  checkId: string,
  client: AxiosInstance,
): Promise<void> {
  await client.post(`/api/checks/${checkId}/mark-as-preset`);
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch and cache the list of checks.
 * Can be used outside RecceProvider with a fallback to default axios client.
 *
 * @param enabled - Whether the query should be enabled
 * @returns TanStack Query result with checks data
 */
export function useChecks(enabled: boolean) {
  const apiConfig = useApiConfigOptional();
  const apiClient = apiConfig?.apiClient ?? defaultApiClient;

  return useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: () => listChecks(apiClient),
    enabled,
  });
}
