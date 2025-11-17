import { axiosClient } from "./axiosClient";
import { RowCountDiffResult, submitRowCountDiff } from "./rowcount";
import { waitRun } from "./runs";

export interface RowCount {
  name?: string;
  curr: number | null;
}

export interface RowCountDiff {
  name?: string;
  base: number | null;
  curr: number | null;
}

export interface QueryRowCountResult {
  runId: string;
  result: RowCountDiffResult;
}

export async function fetchModelRowCount(
  modelName: string,
): Promise<RowCountDiff> {
  const response = await axiosClient.get<RowCountDiff>(
    `/api/models/${modelName}/row_count`,
  );
  return response.data;
}

export async function queryModelRowCount(
  modelName: string,
): Promise<RowCountDiff> {
  const { result } = await queryRowCount([modelName]);
  return result[modelName];
}

export async function queryRowCount(
  modelNames: string[],
): Promise<QueryRowCountResult> {
  if (modelNames.length === 0) {
    throw new Error("No model names provided");
  }

  const { run_id } = await submitRowCountDiff(
    { node_names: modelNames },
    { nowait: true },
  );
  const run = await waitRun(run_id);

  return {
    runId: run_id,
    result: run.result as RowCountDiffResult,
  };
}
