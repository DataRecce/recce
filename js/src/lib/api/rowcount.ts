import { AxiosInstance } from "axios";
import { axiosClient } from "./axiosClient";
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
  client: AxiosInstance = axiosClient,
) {
  return await submitRun("row_count_diff", params, options, client);
}
