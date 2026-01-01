import type { AxiosInstance, AxiosResponse } from "axios";

/**
 * Aggregated run results by model and run type
 */
export type RunsAggregated = Record<
  string,
  Record<
    "row_count_diff" | "value_diff" | "row_count",
    {
      run_id: string;
      result: unknown;
    }
  >
>;

/**
 * Aggregate runs from API
 */
export async function aggregateRuns(
  client: AxiosInstance,
): Promise<RunsAggregated> {
  const response = await client.post<unknown, AxiosResponse<RunsAggregated>>(
    "/api/runs/aggregate",
    {},
  );
  return response.data;
}
