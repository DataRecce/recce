// ============================================================================
// OSS-specific functions (not in library)
// ============================================================================

import type { NodeColumnData } from "@datarecce/ui/api";
import type { AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";

// Re-export LineageDiffResult from library for convenience
export type { LineageDiffResult } from "@datarecce/ui/api";

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
