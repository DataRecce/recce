import { findByRunType } from "@/components/run/registry";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { cancelRun, waitRun } from "@/lib/api/runs";
import { useQuery } from "@tanstack/react-query";
import { Run } from "../api/types";
import React, { useCallback, useEffect, useState } from "react";
import { useRunsAggregated } from "./LineageGraphContext";
import { RunResultViewProps } from "@/components/run/types";

interface UseRunResult {
  run?: Run;
  aborting: boolean;
  isRunning: boolean;
  error: Error | null;
  onCancel: () => Promise<void>;
  RunResultView?: React.ComponentType<RunResultViewProps>;
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

  // Track previous run state to detect changes
  const [prevRun, setPrevRun] = useState(run);
  const [prevError, setPrevError] = useState(error);

  // Adjust isRunning during render when run/error state changes
  if (run !== prevRun || error !== prevError) {
    setPrevRun(run);
    setPrevError(error);

    if (error || run?.result || run?.error) {
      setIsRunning(false);
    } else if (run?.status === "running") {
      setIsRunning(true);
    }
  }

  // Side effect: refetch aggregated runs when row count runs complete
  useEffect(() => {
    if (
      (error || run?.result || run?.error) &&
      (run?.type === "row_count_diff" || run?.type === "row_count")
    ) {
      refetchRunsAggregated();
    }
  }, [run, error, refetchRunsAggregated]);

  const onCancel = useCallback(async () => {
    setAborting(true);
    if (!runId) {
      return;
    }

    await cancelRun(runId);
    return;
  }, [runId, setAborting]);

  const RunResultView = run?.type ? findByRunType(run.type).RunResultView : undefined;

  return {
    run,
    isRunning,
    aborting,
    error,
    onCancel,
    RunResultView,
  };
};
