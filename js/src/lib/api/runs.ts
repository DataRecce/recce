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

export async function waitRun<PT = any, RT = any>(runId: string) {
  const response = await axiosClient.get(`/api/runs/${runId}/wait`);

  const run: Run<PT, RT> = response.data;

  return run;
}

export async function cancelRun(runId: string) {
  return await axiosClient.post(`/api/runs/${runId}/cancel`);
}

export async function submitRunFromCheck<PT = any, RT = any>(
  checkId: string
): Promise<Run<RT>> {
  throw new Error("Not implemented yet");
}
