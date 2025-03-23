import { axiosClient } from "./axiosClient";
import { NodeColumnData } from "./info";

export interface CllParams {
  node_id: string;
  column: string;
}

export interface NodeData {
  id: string;
  name: string;
  resource_type: string;
  raw_code?: string;
  columns?: Record<string, NodeColumnData>;
}

export interface ColumnLineageData {
  current: {
    nodes: Record<string, NodeData>;
  };
}

export interface CllResponse {
  cll_id: string;
  created_at: string;
  params: CllParams;
  result: ColumnLineageData;
  status: "running" | "finished" | "failed";
  error?: string;
  progress?: number;
}

export interface SubmitOptions {
  nowait?: boolean;
}

export async function submitCll(
  nodeId: string,
  column: string,
  options?: SubmitOptions,
): Promise<CllResponse> {
  const params: CllParams = {
    node_id: nodeId,
    column,
  };
  const response = await axiosClient.post("/api/cll", {
    params,
    nowait: options?.nowait,
  });

  return response.data as CllResponse;
}

export async function waitCll(cllId: string, timeout?: number) {
  const response = await axiosClient.get(`/api/cll/${cllId}/wait`, {
    params: {
      timeout,
    },
  });

  return response.data as CllResponse;
}
