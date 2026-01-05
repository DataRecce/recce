import type { AxiosInstance } from "axios";
import type { RowCountDiff, RowCountDiffResult } from "./rowcount";
import { submitRowCountDiff } from "./rowcount";
import { waitRun } from "./runs";

// Re-export for convenience (types are defined in rowcount.ts)
export type { RowCountDiff } from "./rowcount";

// ============================================================================
// Model Row Count Types
// ============================================================================

export interface QueryRowCountResult {
  runId: string;
  result: RowCountDiffResult;
}

// ============================================================================
// Model Row Count API Functions
// ============================================================================

/**
 * Fetch model row count from the API (cached value).
 * @param modelName - The name of the model
 * @param client - Required axios instance
 * @returns The row count diff for the model
 */
export async function fetchModelRowCount(
  modelName: string,
  client: AxiosInstance,
): Promise<RowCountDiff> {
  const response = await client.get<RowCountDiff>(
    `/api/models/${modelName}/row_count`,
  );
  return response.data;
}

/**
 * Query model row count by executing a row count diff run.
 * @param modelName - The name of the model
 * @param client - Required axios instance
 * @returns The row count diff for the model
 */
export async function queryModelRowCount(
  modelName: string,
  client: AxiosInstance,
): Promise<RowCountDiff> {
  const { result } = await queryRowCount([modelName], client);
  return result[modelName];
}

/**
 * Query row counts for multiple models.
 * @param modelNames - Array of model names to query
 * @param client - Required axios instance
 * @returns The run ID and row count diff results for all models
 */
export async function queryRowCount(
  modelNames: string[],
  client: AxiosInstance,
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
