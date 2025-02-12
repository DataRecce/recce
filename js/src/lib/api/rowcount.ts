import { RowCount, RowCountDiff } from "./models";
import { SubmitOptions, submitRun } from "./runs";
export interface RowCountParams {
  node_names: string[];
}
export interface RowCountResult {
  [key: string]: RowCount;
}
export interface RowCountDiffParams {
  node_names: string[];
}
export interface RowCountDiffResult {
  [key: string]: RowCountDiff;
}
export async function submitRowCountDiff(
  params: RowCountDiffParams,
  options?: SubmitOptions
) {
  return await submitRun<RowCountDiffParams, RowCountDiffResult>(
    "row_count_diff",
    params,
    options
  );
}
