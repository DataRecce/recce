import { QueryParams, QueryDiffResult, QueryCurrentResult, ValueDiffResult } from "./adhocQuery";
import _ from "lodash";
import { getCheck } from "./checks";
import { axiosClient } from "./axiosClient";

export type RunType = "query_diff" | 'query_current' | "value_diff" | "schema_diff" | "simple";
export type RunParams = object;

export interface Run {
  run_id: string;
  check_id?: string;
  type: RunType;
  params?: RunParams;
  result: QueryDiffResult | QueryCurrentResult | ValueDiffResult;
}

interface SubmitRunInput {
  type: RunType;
  params?: RunParams;
}

export async function submitRun(input: SubmitRunInput) {
  const type = input.type;
  const params = input.params;

  if (type === "query_diff" || type === "query_current") {
    const response = await axiosClient.post("/api/runs", {
      type,
      params,
    })

    const run: Run = response.data;

    return run;
  } else {
    throw Error(`Wrong run type ${input.type}`);
  }
}


export async function submitQuery(query: QueryParams): Promise<Run> {
    return await submitRun({ type: query.queryType, params: query.params });
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
