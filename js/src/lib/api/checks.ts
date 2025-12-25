import { useQuery } from "@tanstack/react-query";
import { AxiosInstance, AxiosResponse } from "axios";
import { RunType } from "@/components/run/registry";
import { useApiConfig } from "../hooks/ApiConfigContext";
import { axiosClient } from "./axiosClient";
import { cacheKeys } from "./cacheKeys";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";
import { Run, RunParamTypes } from "./types";

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

export interface CreateCheckBody {
  name?: string;
  description?: string;
  run_id?: string;
  type?: RunType;
  params?: Record<string, string | boolean>;
  view_options?: Record<string, string | boolean>;
  track_props?: Record<string, string | boolean>;
}

export async function createSimpleCheck(
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  const response = await client.post<CreateCheckBody, AxiosResponse<Check>>(
    "/api/checks",
    {
      type: "simple",
    },
  );
  return response.data;
}

export async function createCheckByRun(
  runId: string,
  viewOptions?: Record<string, unknown>,
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  const track_props = getExperimentTrackingBreakingChangeEnabled()
    ? { breaking_change_analysis: true }
    : {};
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
  return (await client.get<never, AxiosResponse<Check[]>>("/api/checks")).data;
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
  const response = await client.get<never, AxiosResponse<Check<RunParamTypes>>>(
    `/api/checks/${checkId}`,
  );
  return response.data;
}

export async function updateCheck(
  checkId: string,
  payload: Partial<Check>,
  client: AxiosInstance = axiosClient,
): Promise<Check> {
  const response = await client.patch<Partial<Check>, AxiosResponse<Check>>(
    `/api/checks/${checkId}`,
    payload,
  );
  return response.data;
}

export async function deleteCheck(
  checkId: string,
  client: AxiosInstance = axiosClient,
) {
  const response = await client.delete<
    never,
    AxiosResponse<Pick<Check, "check_id">>
  >(`/api/checks/${checkId}`);
  return response.data;
}

export async function reorderChecks(
  order: {
    source: number;
    destination: number;
  },
  client: AxiosInstance = axiosClient,
) {
  return await client.post<
    { source: number; destination: number },
    AxiosResponse<unknown>
  >("/api/checks/reorder", order);
}

export async function markAsPresetCheck(
  checkId: string,
  client: AxiosInstance = axiosClient,
): Promise<void> {
  await client.post(`/api/checks/${checkId}/mark-as-preset`);
}
