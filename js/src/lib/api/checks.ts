import _, { omit } from "lodash";
import { axiosClient } from "./axiosClient";
import { Run, RunType } from "./types";
import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "./cacheKeys";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";

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

export async function createSimpleCheck(): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "simple",
  });
  const check = response.data;

  return check;
}

export async function createCheckByRun(runId: string, viewOptions?: any): Promise<Check> {
  const track_props = getExperimentTrackingBreakingChangeEnabled()
    ? { breaking_change_analysis: true }
    : {};
  const response = await axiosClient.post("/api/checks", {
    run_id: runId,
    view_options: viewOptions,
    track_props,
  });
  const check = response.data;

  return check;
}

export async function listChecks(): Promise<Check[]> {
  const response = await axiosClient.get("/api/checks");
  return response.data;
}

export function useChecks(enabled: boolean) {
  return useQuery({
    queryKey: cacheKeys.checks(),
    queryFn: listChecks,
    enabled,
  });
}

export async function getCheck(checkId: string): Promise<Check> {
  const response = await axiosClient.get(`/api/checks/${checkId}`);
  return response.data;
}

export async function updateCheck(checkId: string, payload: Partial<Check>): Promise<Check> {
  const response = await axiosClient.patch(`/api/checks/${checkId}`, payload);
  return response.data;
}

export async function deleteCheck(checkId: string) {
  const response = await axiosClient.delete(`/api/checks/${checkId}`);
  return response.data;
}

export async function reorderChecks(order: { source: number; destination: number }) {
  return await axiosClient.post("/api/checks/reorder", order);
}
