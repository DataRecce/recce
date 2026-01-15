import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type { Run } from "../api";
import { cacheKeys, cancelRun, runTypeHasRef, waitRun } from "../api";
import type { RegistryEntry } from "../components/run";
import { findByRunType } from "../components/run";
import { useRunsAggregated } from "../contexts";
import { useApiConfig } from "./useApiConfig";

export interface UseRunResult {
  run?: Run;
  aborting: boolean;
  isRunning: boolean;
  error: Error | null;
  onCancel: () => Promise<void>;
  RunResultView?: RegistryEntry["RunResultView"] | undefined;
}

export const useRun = (runId?: string): UseRunResult => {
  const { apiClient } = useApiConfig();
  const [isRunning, setIsRunning] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [, refetchRunsAggregated] = useRunsAggregated();

  const { error, data: run } = useQuery({
    queryKey: cacheKeys.run(runId ?? ""),
    queryFn: async () => {
      // Cast from library Run to OSS Run for discriminated union support
      return (await waitRun(runId ?? "", isRunning ? 2 : 0, apiClient)) as Run;
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
      refetchRunsAggregated?.();
    }
  }, [run, error, refetchRunsAggregated]);

  const onCancel = useCallback(async () => {
    setAborting(true);
    if (!runId) {
      return;
    }

    await cancelRun(runId, apiClient);
    return;
  }, [runId, apiClient]);

  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (run && runTypeHasRef(run.type)) {
    RunResultView = findByRunType(run.type)
      .RunResultView as RegistryEntry["RunResultView"];
  }

  return {
    run,
    isRunning,
    aborting,
    error,
    onCancel,
    RunResultView,
  };
};
