import { type RunType } from "@datarecce/ui/api";
// Import Run from OSS types for proper discriminated union support
import type { Run } from "@/lib/api/types";

export const isDisabledByNoResult = (
  type: RunType,
  run: Run | undefined,
): boolean => {
  if (type === "schema_diff" || type === "lineage_diff") {
    return false;
  }
  return !run?.result || !!run.error;
};
