import {
  createSimpleCheck as _createSimpleCheck,
  deleteCheck as _deleteCheck,
  getCheck as _getCheck,
  listChecks as _listChecks,
  markAsPresetCheck as _markAsPresetCheck,
  reorderChecks as _reorderChecks,
  updateCheck as _updateCheck,
} from "@datarecce/ui/api";
import { useQuery } from "@tanstack/react-query";
import { AxiosInstance, AxiosResponse } from "axios";
import { useApiConfig } from "../hooks/ApiConfigContext";
import { axiosClient } from "./axiosClient";
import { cacheKeys } from "./cacheKeys";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";
import { RunParamTypes } from "./types";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type { Check, CreateCheckBody } from "@datarecce/ui/api";

// Import types for wrapper function signatures
import type { Check, CreateCheckBody, RunType } from "@datarecce/ui/api";

// ============================================================================
// Wrapper functions with default axiosClient and OSS-specific behavior
// ============================================================================

export async function createSimpleCheck(
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  return await _createSimpleCheck(client);
}

export async function createCheckByRun(
  runId: string,
  viewOptions?: Record<string, unknown>,
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  // OSS-specific: Include experiment tracking if enabled
  const track_props = getExperimentTrackingBreakingChangeEnabled()
    ? { breaking_change_analysis: true }
    : {};

  // Call the API directly with track_props (library version doesn't include this)
  const response = await client.post<CreateCheckBody, AxiosResponse<Check>>(
    "/api/checks",
    {
      run_id: runId,
      view_options: viewOptions,
      track_props,
    },
  );
  return response.data;
}

export async function listChecks(
  client: AxiosInstance = axiosClient,
): Promise<Check[]> {
  return await _listChecks(client);
}

export function useChecks(enabled: boolean) {
  const { apiClient } = useApiConfig();
  return useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: () => listChecks(apiClient),
    enabled,
  });
}

export async function getCheck(
  checkId: string,
  client: AxiosInstance = axiosClient,
): Promise<Check<RunParamTypes>> {
  return (await _getCheck(checkId, client)) as Check<RunParamTypes>;
}

export async function updateCheck(
  checkId: string,
  payload: Partial<Check>,
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  return await _updateCheck(checkId, payload, client);
}

export async function deleteCheck(
  checkId: string,
  client: AxiosInstance = axiosClient,
) {
  return await _deleteCheck(checkId, client);
}

export async function reorderChecks(
  order: {
    source: number;
    destination: number;
  },
  client: AxiosInstance = axiosClient,
) {
  return await _reorderChecks(order, client);
}

export async function markAsPresetCheck(
  checkId: string,
  client: AxiosInstance = axiosClient,
): Promise<void> {
  return await _markAsPresetCheck(checkId, client);
}
