import {
  aggregateRuns as _aggregateRuns,
  cancelRun as _cancelRun,
  getRun as _getRun,
  listRuns as _listRuns,
  searchRuns as _searchRuns,
  submitRunFromCheck as _submitRunFromCheck,
  waitRun as _waitRun,
} from "@datarecce/ui/api";
import { AxiosInstance, AxiosResponse } from "axios";
import { axiosClient } from "./axiosClient";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";
import { AxiosQueryParams, isQueryRun, Run, RunParamTypes } from "./types";

// ============================================================================
// Re-export types from @datarecce/ui/api library
// ============================================================================

export type { SubmitOptions, SubmitRunTrackProps } from "@datarecce/ui/api";

// Import types for wrapper function signatures
import type {
  RunsAggregated,
  RunType,
  SubmitOptions,
  SubmitRunTrackProps,
} from "@datarecce/ui/api";

// ============================================================================
// Internal helper for OSS-specific key mutation
// ============================================================================

function mutateAddKey(run: Run): Run {
  if (run.result == null) {
    // no result, don't do anything
    return run;
  }
  if (isQueryRun(run)) {
    run.result.columns = run.result.columns.map((c) => {
      if (c.key) {
        return c;
      }
      c.key = c.name;
      return c;
    });
  }
  return run;
}

// ============================================================================
// Wrapper functions with default axiosClient and OSS-specific behavior
// ============================================================================

export async function submitRun(
  type: RunType,
  params?: RunParamTypes,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  // OSS-specific: Include experiment tracking if enabled
  const track_props = options?.trackProps ? { ...options.trackProps } : {};
  if (getExperimentTrackingBreakingChangeEnabled()) {
    track_props.breaking_change_analysis = true;
  }

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

export async function getRun(
  runId: string,
  client: AxiosInstance = axiosClient,
) {
  const run = (await _getRun(runId, client)) as Run;
  return run;
}

export async function waitRun(
  runId: string,
  timeout?: number,
  client: AxiosInstance = axiosClient,
) {
  const run = (await _waitRun(runId, timeout, client)) as Run;
  return mutateAddKey(run);
}

export async function cancelRun(
  runId: string,
  client: AxiosInstance = axiosClient,
) {
  return await _cancelRun(runId, client);
}

export async function submitRunFromCheck(
  checkId: string,
  options?: SubmitOptions,
  client: AxiosInstance = axiosClient,
) {
  return (await _submitRunFromCheck(checkId, options, client)) as
    | Run
    | Pick<Run, "run_id">;
}

export async function searchRuns(
  type: string,
  params?: AxiosQueryParams,
  limit?: number,
  client: AxiosInstance = axiosClient,
) {
  return (await _searchRuns(type, params, limit, client)) as Run[];
}

export async function listRuns(
  client: AxiosInstance = axiosClient,
): Promise<Run[]> {
  return (await _listRuns(client)) as Run[];
}

// Re-export from library (avoid duplicate type definition)
export type { RunsAggregated } from "@datarecce/ui/api";

export async function aggregateRuns(
  client: AxiosInstance = axiosClient,
): Promise<RunsAggregated> {
  return await _aggregateRuns(client);
}
