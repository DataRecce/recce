import { axiosClient } from "./axiosClient";
import { NodeColumnData } from "./info";
import { AxiosResponse } from "axios";

export interface CllParams {
  node_id: string;
  column: string;
}

export interface NodeData {
  id: string;
  name: string;
  resource_type: string;
  raw_code?: string;
  depends_on?: {
    node: string;
    column: string;
  }[];
  columns?: Record<string, NodeColumnData>;
}

export interface ColumnLineageData {
  current: {
    nodes: Record<string, NodeData>;
  };
}

export async function getCll(nodeId: string, column: string): Promise<ColumnLineageData> {
  const params: CllParams = {
    node_id: nodeId,
    column,
  };
  const response = await axiosClient.post<CllParams, AxiosResponse<ColumnLineageData>>("/api/cll", {
    params,
  });

  return response.data;
}
