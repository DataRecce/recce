import { axiosClient } from "./axiosClient";
import { Run, RunType } from "./types";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "./cacheKeys";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";
import { AxiosResponse } from "axios";

export interface Check<PT = any, RT = any, VO = any> {
  check_id: string;
  name: string;
  description?: string;
  type: RunType;
  params?: PT;
  view_options?: VO;
  is_checked?: boolean;
  is_preset?: boolean;
  last_run?: Run<PT, RT>;
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

export async function createSimpleCheck(): Promise<Check> {
  const response = await axiosClient.post<CreateCheckBody, AxiosResponse<Check>>("/api/checks", {
    type: "simple",
  });
  return response.data;
}

export async function createCheckByRun(runId: string, viewOptions?: any): Promise<Check> {
  const track_props = getExperimentTrackingBreakingChangeEnabled()
    ? { breaking_change_analysis: true }
    : {};
  const response = await axiosClient.post<CreateCheckBody, AxiosResponse<Check>>("/api/checks", {
    run_id: runId,
    view_options: viewOptions,
    track_props,
  });
  return response.data;
}

export async function listChecks(): Promise<Check[]> {
  return (await axiosClient.get<never, AxiosResponse<Check[]>>("/api/checks")).data;
}

export function useChecks(enabled: boolean) {
  return useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    enabled,
  });
}

export async function getCheck(checkId: string): Promise<Check> {
  const response = await axiosClient.get<never, AxiosResponse<Check>>(`/api/checks/${checkId}`);
  return response.data;
}

export async function updateCheck(checkId: string, payload: Partial<Check>): Promise<Check> {
  const response = await axiosClient.patch<Partial<Check>, AxiosResponse<Check>>(
    `/api/checks/${checkId}`,
    payload,
  );
  return response.data;
}

export async function deleteCheck(checkId: string) {
  const response = await axiosClient.delete<never, AxiosResponse<Pick<Check, "check_id">>>(
    `/api/checks/${checkId}`,
  );
  return response.data;
}

export async function reorderChecks(order: { source: number; destination: number }) {
  return await axiosClient.post<{ source: number; destination: number }, AxiosResponse<unknown>>(
    "/api/checks/reorder",
    order,
  );
}
