import { RowCount, RowCountDiff } from "./models";
import { SubmitOptions, submitRun } from "./runs";
export interface RowCountParams {
  node_names: string[];
}
export type RowCountResult = Record<string, RowCount>;
export interface RowCountDiffParams {
  node_names: string[];
}
export type RowCountDiffResult = Record<string, RowCountDiff>;
export async function submitRowCountDiff(
  params: RowCountDiffParams,
  options?: SubmitOptions,
) {
  return await submitRun("row_count_diff", params, options);
}
