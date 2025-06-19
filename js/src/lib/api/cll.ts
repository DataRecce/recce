import { axiosClient } from "./axiosClient";
import { NodeColumnData } from "./info";
import { AxiosResponse } from "axios";

export interface CllParams {
  node_id: string;
  column: string;
}

export interface ImpactRadiusParams {
  node_id: string;
}

export interface CllNodeData {
  id: string;
  name: string;
  resource_type: string;
  raw_code?: string;
  depends_on?: {
    nodes: string[];
    columns: {
      node: string;
      column: string;
    }[];
  };
  columns?: Record<string, NodeColumnData>;
}

export interface ColumnLineageData {
  current: {
    nodes: Record<string, CllNodeData>;
    columns: Record<string, NodeColumnData>;
    parent_map: Record<string, Set<string>>;
    child_map: Record<string, Set<string>>;
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

export async function getImpactRadius(nodeId: string): Promise<ColumnLineageData> {
  const params: ImpactRadiusParams = {
    node_id: nodeId,
  };
  const response = await axiosClient.post<ImpactRadiusParams, AxiosResponse<ColumnLineageData>>(
    "/api/impact-radius",
    params,
  );

  return response.data;
}
