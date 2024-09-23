import { findByRunType } from "@/components/run/registry";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { waitRun } from "@/lib/api/runs";
import { useQuery } from "@tanstack/react-query";
import { Run } from "../api/types";

interface UseRunResult {
  run?: Run;
  isPending: boolean;
  error: Error | null;
  RunResultView?: React.ComponentType<any>;
}

export const useRun = (runId?: string): UseRunResult => {
  const {
    isPending,
    error,
    data: run,
  } = useQuery({
    queryKey: cacheKeys.run(runId || ""),
    queryFn: async () => waitRun(runId || ""),
    enabled: !!runId,
  });

  const RunResultView = run?.type
    ? findByRunType(run.type)?.RunResultView
    : undefined;

  return {
    run,
    isPending,
    error,
    RunResultView,
  };
};
