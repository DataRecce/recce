import { RowCount } from "./models";
import { SubmitOptions, submitRun } from "./runs";
export interface RowCountDiffParams {
  node_names: string[];
}
export interface RowCountDiffResult {
  [key: string]: RowCount;
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
