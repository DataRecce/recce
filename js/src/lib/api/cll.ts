import { axiosClient } from "./axiosClient";
import { NodeColumnData } from "./info";
import { AxiosResponse } from "axios";

export interface CllInput {
  node_id?: string;
  column?: string;
  change_analysis?: boolean;
  no_cll?: boolean;
  no_upstream?: boolean;
  no_downstream?: boolean;
}

export interface ImpactRadiusParams {
  node_id: string;
}

export interface CllNodeData {
  id: string;
  name: string;
  source_name: string;
  resource_type: string;
  raw_code?: string;
  change_status?: "added" | "removed" | "modified";
  change_category?: "breaking" | "non_breaking" | "partial_breaking" | "unknown";
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

export async function getCll(input: CllInput): Promise<ColumnLineageData> {
  const response = await axiosClient.post<CllInput, AxiosResponse<ColumnLineageData>>(
    "/api/cll",
    input,
  );

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
