import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Run, RunParams, RunType, getRun } from "./runs";
import _ from "lodash";

export interface Check {
  check_id: string;
  name: string;
  description?: string;
  type: RunType;
  params?: RunParams;
  isChecked?: boolean;
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

export async function updateCheck(check: Partial<Check>) {
  if (!check?.check_id) {
    throw Error(`No check_Ii`);
  }

  const oldCheck = await getCheck(check?.check_id);
  if (!oldCheck) {
    throw Error(`check not found: ${check.check_id}`);
  }
  Object.assign(oldCheck, check);
}

export async function deleteCheck(checkId: string) {
  _.remove(checks, (check) => check.check_id === checkId);
}
