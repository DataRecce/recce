import _ from "lodash";
import { axiosClient } from "./axiosClient";
import { Run, RunType } from "./types";

export async function submitRun<PT = any, RT = any>(
  type: RunType,
  params?: PT
) {
  const response = await axiosClient.post("/api/runs", {
    type,
    params,
  });

  const run: Run<PT, RT> = response.data;

  return run;
}

export async function submitRunFromCheck<PT = any, RT = any>(
  checkId: string
): Promise<Run<RT>> {
  throw new Error("Not implemented yet");
}
