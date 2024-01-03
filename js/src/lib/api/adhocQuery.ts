import { cancelRun, submitRun, waitRun } from "./runs";
import { DataFrame } from "./types";

export interface QueryParams {
  sql_template: string;
}

export interface QueryResult {
  result?: DataFrame;
  error?: string;
}

export interface QueryDiffParams {
  sql_template: string;
  primary_keys?: string[];
}

export interface QueryDiffResult {
  primary_keys?: string[];
  base?: DataFrame;
  current?: DataFrame;
  base_error?: string;
  current_error?: string;
}

export async function submitQuery(params: QueryParams) {
  const { run_id } = await submitRun<QueryParams, QueryResult>(
    "query",
    params,
    true
  );

  const timeout = new Promise((resolve) =>
    setTimeout(resolve, 5000, "timeout")
  );
  const result = await Promise.race([waitRun(run_id), timeout]);

  if (result === "timeout") {
    await cancelRun(run_id);
    throw new Error("Operation timed out after 5 seconds");
  }
  return result;
}

export async function submitQueryDiff(params: QueryDiffParams) {
  return await submitRun<QueryDiffResult, QueryDiffResult>(
    "query_diff",
    params
  );
}
