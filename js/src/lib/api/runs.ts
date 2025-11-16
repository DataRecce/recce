import { AxiosResponse } from "axios";
import { RunType } from "@/components/run/registry";
import { axiosClient } from "./axiosClient";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";
import { AxiosQueryParams, isQueryRun, Run, RunParamTypes } from "./types";

export interface SubmitRunTrackProps {
  breaking_change_analysis?: boolean;
  source?: "lineage_model_node" | "lineage_column_node";
  [key: string]: unknown;
}

export interface SubmitOptions {
  nowait?: boolean;
  trackProps?: SubmitRunTrackProps;
}

interface SubmitRunBody {
  type: RunType;
  params?: Record<string, unknown>;
  nowait?: boolean;
  track_props: SubmitRunTrackProps;
}

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

export async function submitRun(
  type: RunType,
  params?: RunParamTypes,
  options?: SubmitOptions,
) {
  const track_props = options?.trackProps ? { ...options.trackProps } : {};
  if (getExperimentTrackingBreakingChangeEnabled()) {
    track_props.breaking_change_analysis = true;
  }

  const response = await axiosClient.post<
    SubmitRunBody,
    AxiosResponse<Run | Pick<Run, "run_id">>
  >("/api/runs", {
    type,
    params,
    nowait: options?.nowait,
    track_props,
  });

  return response.data;
}

export async function getRun(runId: string) {
  const response = await axiosClient.get<never, AxiosResponse<Run>>(
    `/api/runs/${runId}`,
  );
  return response.data;
}

interface WaitRunBody {
  params: {
    timeout?: number;
  };
}

export async function waitRun(runId: string, timeout?: number) {
  const response = await axiosClient.get<WaitRunBody, AxiosResponse<Run>>(
    `/api/runs/${runId}/wait`,
    {
      params: {
        timeout,
      },
    },
  );

  return mutateAddKey(response.data);
}

export async function cancelRun(runId: string) {
  return await axiosClient.post<never, AxiosResponse<never>>(
    `/api/runs/${runId}/cancel`,
  );
}

export async function submitRunFromCheck(
  checkId: string,
  options?: SubmitOptions,
) {
  const response = await axiosClient.post<
    { nowait?: boolean },
    AxiosResponse<Run | Pick<Run, "run_id">>
  >(`/api/checks/${checkId}/run`, {
    nowait: options?.nowait,
  });

  return response.data;
}

interface SearchRunsBody {
  type: string;
  params: Record<string, unknown>;
  limit?: number;
}

export async function searchRuns(
  type: string,
  params?: AxiosQueryParams,
  limit?: number,
) {
  const response = await axiosClient.post<SearchRunsBody, AxiosResponse<Run[]>>(
    `/api/runs/search`,
    {
      type,
      params,
      limit,
    },
  );

  return response.data;
}

export async function listRuns(): Promise<Run[]> {
  const response = await axiosClient.get<never, AxiosResponse<Run[]>>(
    "/api/runs",
  );
  return response.data;
}

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
export async function aggregateRuns(): Promise<RunsAggregated> {
  // input should be AggregateRunsIn
  const response = await axiosClient.post<
    unknown,
    AxiosResponse<RunsAggregated>
  >(`/api/runs/aggregate`, {});

  return response.data;
}
