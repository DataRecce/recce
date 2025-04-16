import { findByRunType } from "@/components/run/registry";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { cancelRun, waitRun } from "@/lib/api/runs";
import { useQuery } from "@tanstack/react-query";
import { Run } from "../api/types";
import { useCallback, useEffect, useState } from "react";
import { useRunsAggregated } from "./LineageGraphContext";

interface UseRunResult {
  run?: Run;
  aborting: boolean;
  isRunning: boolean;
  error: Error | null;
  onCancel: () => Promise<void>;
  RunResultView?: React.ComponentType<any>;
}

export const useRun = (runId?: string): UseRunResult => {
  const [isRunning, setIsRunning] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [, refetchRunsAggregated] = useRunsAggregated();

  const { error, data: run } = useQuery({
    queryKey: cacheKeys.run(runId ?? ""),
    queryFn: async () => {
      return waitRun(runId ?? "", isRunning ? 2 : 0);
    },
    enabled: !!runId,
    refetchInterval: isRunning ? 50 : false,
    retry: false,
  });

  useEffect(() => {
    if (error || run?.result || run?.error) {
      if (isRunning) {
        setIsRunning(false);
      }
      if (run?.type === "row_count_diff" || run?.type === "row_count") {
        refetchRunsAggregated();
      }
    }

    if (run?.status === "running") {
      setIsRunning(true);
    }
  }, [run, error, isRunning, refetchRunsAggregated]);

  const onCancel = useCallback(async () => {
    setAborting(true);
    if (!runId) {
      return;
    }

    await cancelRun(runId);
    return;
  }, [runId, setAborting]);

  const RunResultView = run?.type ? findByRunType(run.type)?.RunResultView : undefined;

  return {
    run,
    isRunning,
    aborting,
    error,
    onCancel,
    RunResultView,
  };
};
