import { axiosClient } from "./axiosClient";
import { Run, RunType } from "./types";
import { getExperimentTrackingBreakingChangeEnabled } from "./track";
import { AxiosResponse } from "axios";

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

export async function submitRun<PT = any, RT = any>(
  type: RunType,
  params?: PT,
  options?: SubmitOptions,
) {
  const track_props = options?.trackProps ? { ...options.trackProps } : {};
  if (getExperimentTrackingBreakingChangeEnabled()) {
    track_props.breaking_change_analysis = true;
  }

  const response = await axiosClient.post<
    SubmitRunBody,
    AxiosResponse<Run<PT, RT> | Pick<Run<PT, RT>, "run_id">>
  >("/api/runs", {
    type,
    params,
    nowait: options?.nowait,
    track_props,
  });

  return response.data;
}

export async function getRun<PT = any, RT = any>(runId: string) {
  const response = await axiosClient.get<never, AxiosResponse<Run<PT, RT>>>(`/api/runs/${runId}`);
  return response.data;
}

interface WaitRunBody {
  params: {
    timeout?: number;
  };
}

export async function waitRun<PT = any, RT = any>(runId: string, timeout?: number) {
  const response = await axiosClient.get<WaitRunBody, AxiosResponse<Run<PT, RT>>>(
    `/api/runs/${runId}/wait`,
    {
      params: {
        timeout,
      },
    },
  );

  return response.data;
}

export async function cancelRun(runId: string) {
  return await axiosClient.post<never, AxiosResponse<never>>(`/api/runs/${runId}/cancel`);
}

export async function submitRunFromCheck<PT = any, RT = any>(
  checkId: string,
  options?: SubmitOptions,
) {
  const response = await axiosClient.post<
    { nowait?: boolean },
    AxiosResponse<Run<PT, RT> | Pick<Run, "run_id">>
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

export async function searchRuns(type: string, params: any, limit?: number) {
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
  const response = await axiosClient.get<never, AxiosResponse<Run[]>>("/api/runs");
  return response.data;
}

export type RunsAggregated = Record<
  string,
  Record<
    "row_count_diff" | "value_diff" | "row_count",
    {
      run_id: string;
      result: any;
    }
  >
>;
export async function aggregateRuns(): Promise<RunsAggregated> {
  // input should be AggregateRunsIn
  const response = await axiosClient.post<unknown, AxiosResponse<RunsAggregated>>(
    `/api/runs/aggregate`,
    {},
  );

  return response.data;
}
