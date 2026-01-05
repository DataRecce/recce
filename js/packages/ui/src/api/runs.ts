import type { AxiosInstance, AxiosResponse } from "axios";
import { isQueryRun, type Run, type RunType } from "./types";

// ============================================================================
// Types
// ============================================================================

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
 * Properties for tracking run submissions (analytics)
 */
export interface SubmitRunTrackProps {
  breaking_change_analysis?: boolean;
  source?: "lineage_model_node" | "lineage_column_node";
  [key: string]: unknown;
}

/**
 * Options for submitting a run
 */
export interface SubmitOptions {
  nowait?: boolean;
  trackProps?: SubmitRunTrackProps;
}

// ============================================================================
// Core Run API Functions
// ============================================================================

/**
 * Submit a new run of the specified type.
 * @param type - The type of run to execute
 * @param params - Parameters specific to the run type
 * @param options - Submission options (nowait, tracking)
 * @param client - Required axios instance (no default - library pattern)
 * @returns The created run, or just run_id if nowait is true
 */
export async function submitRun(
  type: RunType,
  params: unknown,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
): Promise<Run | Pick<Run, "run_id">> {
  const track_props = options?.trackProps ? { ...options.trackProps } : {};
  // NOTE: Removed getExperimentTrackingBreakingChangeEnabled() - OSS-specific

  const response = await client.post<
    unknown,
    AxiosResponse<Run | Pick<Run, "run_id">>
  >("/api/runs", {
    type,
    params,
    nowait: options?.nowait,
    track_props,
  });

  return response.data;
}

/**
 * Get a run by ID.
 * @param runId - The ID of the run to retrieve
 * @param client - Required axios instance
 * @returns The run object
 */
export async function getRun(
  runId: string,
  client: AxiosInstance,
): Promise<Run> {
  const response = await client.get<never, AxiosResponse<Run>>(
    `/api/runs/${runId}`,
  );
  return response.data;
}

/**
 * Wait for a run to complete.
 * @param runId - The ID of the run to wait for
 * @param timeout - Optional timeout in seconds
 * @param client - Required axios instance
 * @returns The completed run object with result
 */
export async function waitRun(
  runId: string,
  timeout: number | undefined,
  client: AxiosInstance,
): Promise<Run> {
  const response = await client.get<unknown, AxiosResponse<Run>>(
    `/api/runs/${runId}/wait`,
    { params: { timeout } },
  );
  return mutateAddKey(response.data);
}

/**
 * Cancel a running run.
 * @param runId - The ID of the run to cancel
 * @param client - Required axios instance
 */
export async function cancelRun(
  runId: string,
  client: AxiosInstance,
): Promise<void> {
  await client.post(`/api/runs/${runId}/cancel`);
}

/**
 * Submit a run from an existing check.
 * Re-runs the check with its stored parameters.
 * @param checkId - The ID of the check to run
 * @param options - Submission options (nowait)
 * @param client - Required axios instance
 * @returns The created run, or just run_id if nowait is true
 */
export async function submitRunFromCheck(
  checkId: string,
  options: SubmitOptions | undefined,
  client: AxiosInstance,
): Promise<Run | Pick<Run, "run_id">> {
  const response = await client.post<
    unknown,
    AxiosResponse<Run | Pick<Run, "run_id">>
  >(`/api/checks/${checkId}/run`, {
    nowait: options?.nowait,
  });
  return response.data;
}

/**
 * Search for runs matching criteria.
 * @param type - The run type to search for
 * @param params - Parameters to match against run params
 * @param limit - Maximum number of results to return
 * @param client - Required axios instance
 * @returns Array of matching runs
 */
export async function searchRuns(
  type: string,
  params: Record<string, unknown> | undefined,
  limit: number | undefined,
  client: AxiosInstance,
): Promise<Run[]> {
  const response = await client.post<unknown, AxiosResponse<Run[]>>(
    "/api/runs/search",
    { type, params, limit },
  );
  return response.data;
}

/**
 * List all runs.
 * @param client - Required axios instance
 * @returns Array of all runs
 */
export async function listRuns(client: AxiosInstance): Promise<Run[]> {
  const response = await client.get<never, AxiosResponse<Run[]>>("/api/runs");
  return response.data;
}

/**
 * Aggregate runs from API.
 * Returns run results grouped by model and run type.
 * @param client - Required axios instance
 * @returns Aggregated run results
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

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Internal helper to add key to query result columns.
 * Query results may have columns without a key property set.
 * This ensures all columns have a key for data grid rendering.
 */
function mutateAddKey(run: Run): Run {
  if (run.result == null) {
    return run;
  }
  if (isQueryRun(run) && run.result) {
    // Type narrowing - run.result structure for query runs
    const result = run.result as {
      columns?: Array<{ key?: string; name: string }>;
    };
    if (result.columns) {
      result.columns = result.columns.map((c) => {
        if (c.key) return c;
        return { ...c, key: c.name };
      });
    }
  }
  return run;
}
