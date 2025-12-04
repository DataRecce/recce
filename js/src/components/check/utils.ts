import { RunType } from "@/components/run/registry";
import { Run } from "@/lib/api/types";

export const isDisabledByNoResult = (
  type: RunType,
  run: Run | undefined,
): boolean => {
  if (type === "schema_diff" || type === "lineage_diff") {
    return false;
  }
  return !run?.result || !!run.error;
};
