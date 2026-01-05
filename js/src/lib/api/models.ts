import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";
import {
  RowCountDiff,
  RowCountDiffResult,
  submitRowCountDiff,
} from "./rowcount";
import { waitRun } from "./runs";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type {
  QueryRowCountResult,
  RowCount,
  RowCountDiff,
} from "@datarecce/ui/api";

// Import types for local use
import type { QueryRowCountResult } from "@datarecce/ui/api";

// ============================================================================
// API Functions
// ============================================================================

export async function fetchModelRowCount(
  modelName: string,
  client: AxiosInstance = axiosClient,
): Promise<RowCountDiff> {
  const response = await client.get<RowCountDiff>(
    `/api/models/${modelName}/row_count`,
  );
  return response.data;
}

export async function queryModelRowCount(
  modelName: string,
  client: AxiosInstance = axiosClient,
): Promise<RowCountDiff> {
  const { result } = await queryRowCount([modelName], client);
  return result[modelName];
}

export async function queryRowCount(
  modelNames: string[],
  client: AxiosInstance = axiosClient,
): Promise<QueryRowCountResult> {
  if (modelNames.length === 0) {
    throw new Error("No model names provided");
  }

  const { run_id } = await submitRowCountDiff(
    { node_names: modelNames },
    { nowait: true },
    client,
  );
  const run = await waitRun(run_id, undefined, client);

  return {
    runId: run_id,
    result: run.result as RowCountDiffResult,
  };
}
