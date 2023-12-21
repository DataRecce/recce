import { Run, RunParams, RunType } from "./runs";
import _ from "lodash";
import { axiosClient } from "./axiosClient";

export interface Check {
  check_id: string;
  name: string;
  description?: string;
  type: RunType;
  params?: RunParams;
  is_checked?: boolean;
  last_run?: Run;
}

export async function createSimpleCheck(): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "simple",
  });
  const check = response.data;

  return check;
}

export async function createQueryDiffCheck(runId: string): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "query_diff",
    run_id: runId
  });
  const check = response.data;

  return check;
}

export async function createValueDiffCheck(runId: string): Promise<Check> {
  const response = await axiosClient.post("/api/checks", {
    type: "value_diff",
    run_id: runId,
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
