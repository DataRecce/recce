import { useQuery } from "@tanstack/react-query";
import { QueryDiffParams, QueryDiffResult, runQueryDiff } from "./adhocQuery";
import _ from "lodash";
import { getCheck } from "./checks";

export type RunType = "query_diff";
export type RunParams = object;

export interface Run {
  run_id: string;
  check_id?: string;
  type: RunType;
  params?: RunParams;
  result: QueryDiffResult;
}

const runs: Run[] = [];

interface SubmitRunInput {
  type: RunType;
  params?: RunParams;
}

export async function submitRun(input: SubmitRunInput) {
  const type = input.type;
  const run_id = Math.random()
    .toString(36)
    .substring(2, 16 + 2);

  if (type === "query_diff") {
    const result = await runQueryDiff(input.params as QueryDiffParams);

    const run: Run = {
      run_id,
      type,
      params: input.params,
      result,
    };

    runs.push(run);

    return run;
  } else {
    throw Error(`Wrong run type ${input.type}`);
  }
}

export async function submitRunFromCheck(checkId: string): Promise<Run> {
  const check = await getCheck(checkId);
  if (!check) {
    throw Error(`check not found: ${checkId}`);
  }

  const run = await submitRun({ type: check.type, params: check.params });
  run.check_id = checkId;
  check.last_run = run;
  return run;
}

export function useSubmitRun(input: SubmitRunInput, queryKey: any[]) {
  return useQuery({
    queryKey,
    queryFn: () => submitRun(input),
    retry: false,
    enabled: false, // never auto run
  });
}

export async function getRun(runId: string) {
  return _.find(runs, (run) => run.run_id === runId);
}
