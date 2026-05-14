import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Run } from "../api";
import { cacheKeys, cancelRun, runTypeHasRef, waitRun } from "../api";
import type { RegistryEntry } from "../components/run";
import { findByRunType } from "../components/run";
import { useRunsAggregated } from "../contexts";
import { useApiConfig } from "./useApiConfig";
import { useCanceledRuns } from "./useCanceledRuns";

export interface UseRunResult {
  run?: Run;
  isRunning: boolean;
  error: Error | null;
  onCancel: () => Promise<void>;
  RunResultView?: RegistryEntry["RunResultView"] | undefined;
}

export const useRun = (runId?: string): UseRunResult => {
  const { apiClient } = useApiConfig();
  const queryClient = useQueryClient();
  const canceledRuns = useCanceledRuns();

  const [isRunning, setIsRunning] = useState(!!runId);
  const [, refetchRunsAggregated] = useRunsAggregated();
  const completedRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (runId) {
      setIsRunning(true);
      completedRunIdRef.current = null;
    }
  }, [runId]);

  const userCanceled = runId ? canceledRuns.has(runId) : false;
  const polling = isRunning && !userCanceled;

  const { error, data: run } = useQuery({
    queryKey: cacheKeys.run(runId ?? ""),
    queryFn: async () => {
      return (await waitRun(runId ?? "", polling ? 2 : 0, apiClient)) as Run;
    },
    enabled: !!runId && !userCanceled,
    refetchInterval: polling ? 50 : false,
    retry: false,
  });

  useEffect(() => {
    if (!run) return;
    const normalizedStatus = run.status?.toLowerCase();
    const isComplete = !!(error || run.result || run.error);
    const isStatusComplete = normalizedStatus && normalizedStatus !== "running";
    if (isComplete || isStatusComplete) {
      if (completedRunIdRef.current !== run.run_id) {
        completedRunIdRef.current = run.run_id;
        setIsRunning(false);
      }
    } else if (normalizedStatus === "running" && !userCanceled) {
      completedRunIdRef.current = null;
      setIsRunning(true);
    }
  }, [run, error, userCanceled]);

  useEffect(() => {
    if (
      (error || run?.result || run?.error) &&
      (run?.type === "row_count_diff" || run?.type === "row_count")
    ) {
      refetchRunsAggregated?.();
    }
  }, [run, error, refetchRunsAggregated]);

  const onCancel = useCallback((): Promise<void> => {
    if (!runId) return Promise.resolve();

    queryClient.setQueryData<Run | undefined>(cacheKeys.run(runId), (prev) =>
      prev
        ? { ...prev, status: "Cancelled" }
        : ({
            run_id: runId,
            status: "Cancelled",
            type: "unknown",
          } as unknown as Run),
    );
    canceledRuns.add(runId);
    setIsRunning(false);
    completedRunIdRef.current = runId;

    // Fire-and-forget: cancelRun swallows network errors internally, so we
    // intentionally do not await it. The UI has already detached above.
    void cancelRun(runId, apiClient);
    return Promise.resolve();
  }, [runId, apiClient, queryClient, canceledRuns]);

  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (run && runTypeHasRef(run.type)) {
    RunResultView = findByRunType(run.type)
      .RunResultView as RegistryEntry["RunResultView"];
  }

  return {
    run,
    isRunning,
    error,
    onCancel,
    RunResultView,
  };
};
