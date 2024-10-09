import _ from "lodash";
import { axiosClient } from "./axiosClient";
import { Run, RunType } from "./types";

export interface SubmitOptions {
  nowait?: boolean;
}

export async function submitRun<PT = any, RT = any>(
  type: RunType,
  params?: PT,
  options?: SubmitOptions
) {
  const response = await axiosClient.post("/api/runs", {
    type,
    params,
    nowait: options?.nowait,
  });

  const run: Run<PT, RT> | Pick<Run, "run_id"> = response.data;

  return run;
}

export async function getRun<PT = any, RT = any>(runId: string) {
  const response = await axiosClient.get(`/api/runs/${runId}`);
  const run: Run<PT, RT> = response.data;
  return run;
}

export async function waitRun<PT = any, RT = any>(
  runId: string,
  timeout?: number
) {
  const response = await axiosClient.get(`/api/runs/${runId}/wait`, {
    params: {
      timeout,
    },
  });

  const run: Run<PT, RT> = response.data;

  return run;
}

export async function cancelRun(runId: string) {
  return await axiosClient.post(`/api/runs/${runId}/cancel`);
}

export async function submitRunFromCheck<PT = any, RT = any>(
  checkId: string,
  options?: SubmitOptions
) {
  const response = await axiosClient.post(`/api/checks/${checkId}/run`, {
    nowait: options?.nowait,
  });

  const run: Run<PT, RT> | Pick<Run, "run_id"> = response.data;

  return run;
}

export async function searchRuns(type: string, params: any, limit?: number) {
  const response = await axiosClient.post(`/api/runs/search`, {
    type,
    params,
    limit,
  });

  return response.data;
}

export async function listRuns() {
  const response = await axiosClient.get("/api/runs");
  const runs: Run<any, any>[] = response.data;
  return runs;
}

export interface RunsAggregated {
  [unique_id: string]: {
    [run_type: string]: {
      run_id: string;
      result: any;
    };
  };
}
export async function aggregateRuns(): Promise<RunsAggregated> {
  const response = await axiosClient.post(`/api/runs/aggregate`, {});

  return response.data;
}
