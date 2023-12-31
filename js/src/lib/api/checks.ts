import _ from "lodash";
import { axiosClient } from "./axiosClient";
import { Run, RunType } from "./types";

export interface Check<PT = any, RT = any> {
  check_id: string;
  name: string;
  description?: string;
  type: RunType;
  params?: PT;
  is_checked?: boolean;
  last_run?: Run<PT, RT>;
}

export async function createSimpleCheck(): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "simple",
  });
  const check = response.data;

  return check;
}

export async function createCheckByNodeSchema(nodeId: string): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "schema_diff",
    params: {
      node_id: nodeId,
    },
  });
  const check = response.data;

  return check;
}

export async function createCheckByRowCounts(nodeIds: string[]): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "row_count_diff",
    params: {
      node_ids: nodeIds,
    },
  });
  const check = response.data;

  return check;
}

export async function createCheckByRun(runId: string): Promise<Check> {
  const response = await axiosClient.post("/api/checks", { run_id: runId });
  const check = response.data;

  return check;
}

export async function listChecks(): Promise<Check[]> {
  const response = await axiosClient.get("/api/checks");
  return response.data;
}

export async function getCheck(checkId: string): Promise<Check> {
  const response = await axiosClient.get(`/api/checks/${checkId}`);
  return response.data;
}

export async function updateCheck(
  checkId: string,
  payload: Partial<Check>
): Promise<Check> {
  const response = await axiosClient.patch(`/api/checks/${checkId}`, payload);
  return response.data;
}

export async function deleteCheck(checkId: string) {
  const response = await axiosClient.delete(`/api/checks/${checkId}`);
  return response.data;
}
