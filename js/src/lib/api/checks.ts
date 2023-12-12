import { useQuery } from "@tanstack/react-query";
import { Run, RunParams, RunType, getRun } from "./runs";
import _ from "lodash";

interface Check {
  check_id: string;
  name: string;
  description?: string;
  type: RunType;
  params?: RunParams;
  last_run?: Run;
}

const checks: Check[] = [];

export async function createCheckByRun(runId: string) {
  const run = await getRun(runId);
  const checkId = Math.random()
    .toString(36)
    .substring(2, 16 + 2);

  if (!run) {
    throw Error(`cannot find run: ${runId}`);
  }

  const check: Check = {
    check_id: checkId,
    name: `Query ${new Date().toLocaleString()}`,
    type: run.type,
    params: run.params,
    last_run: run,
  };

  checks.push(check);

  return check;
}

export async function listChecks() {
  return checks;
}

export async function getCheck(checkId: string) {
  return _.find(checks, (check) => check.check_id === checkId);
}

export async function deleteCheck(checkId: string) {
  _.remove(checks, (check) => check.check_id === checkId);
}

export function useListChecks() {
  return useQuery({
    queryKey: ["checks", "list"],
    queryFn: () => listChecks(),
  });
}
