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

export async function submitCll(nodeId: string, column: string): Promise<ColumnLineageData> {
  const params: CllParams = {
    node_id: nodeId,
    column,
  };
  const response = await axiosClient.post("/api/cll", {
    params,
  });

  return response.data as ColumnLineageData;
}
