// Re-export from @datarecce/ui library

export type {
  CatalogMetadata,
  GitInfo,
  LineageData,
  LineageDataFromMetadata,
  LineageDiffData,
  ManifestMetadata,
  NodeColumnData,
  NodeData,
  PullRequestInfo,
  ServerInfoResult,
  SQLMeshInfo,
  StateMetadata,
} from "@datarecce/ui/api";
export { getServerInfo } from "@datarecce/ui/api";

// ============================================================================
// OSS-specific functions (not in library)
// ============================================================================

import type { LineageData, NodeColumnData } from "@datarecce/ui/api";
import type { AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

export interface LineageDiffResult {
  base?: LineageData;
  current?: LineageData;
  base_error?: string;
  current_error?: string;
}

export interface ModelInfoResult {
  model: {
    base: {
      columns?: Record<string, NodeColumnData>;
      primary_key?: string;
    };
    current: {
      columns?: Record<string, NodeColumnData>;
      primary_key?: string;
    };
  };
}

export async function getModelInfo(model: string): Promise<ModelInfoResult> {
  return (
    await axiosClient.get<never, AxiosResponse<ModelInfoResult>>(
      `/api/model/${model}`,
    )
  ).data;
}
