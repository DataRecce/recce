import { useQuery } from "@tanstack/react-query";
import { QueryDiffParams, QueryDiffResult, runQueryDiff } from "./adhocQuery";

export type RunType = "query_diff";

export interface Run {
  run_id: string;
  type: RunType;
  result: QueryDiffResult;
}

const runs: Run[] = [];

interface SubmitRunInput {
  type: RunType;
  params: object;
}

export async function submitRun(input: SubmitRunInput): Promise<Run> {
  const type = input.type;
  const run_id = Math.random()
    .toString(36)
    .substring(2, 16 + 2);

  if (type === "query_diff") {
    const result = await runQueryDiff(input.params as QueryDiffParams);

    return {
      run_id,
      type,
      result,
    };
  } else {
    throw Error(`Wrong run type ${input.type}`);
  }
}

export function useSubmitRun(input: SubmitRunInput, queryKey: any[]) {
  return useQuery({
    queryKey,
    queryFn: () => submitRun(input),
    retry: false,
    enabled: false, // never auto run
  });
}
