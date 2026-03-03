import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
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
  // Initialize to true when runId is provided - a newly submitted run is typically running.
  // The first successful fetch will update this to false if the run has already completed.
  const [isRunning, setIsRunning] = useState(!!runId);
  const [aborting, setAborting] = useState(false);
  const [, refetchRunsAggregated] = useRunsAggregated();

  // Track the run ID that has been detected as complete to prevent re-triggering
  // This ref persists across renders and prevents the race condition where
  // React Query's fast polling (50ms) fires before state updates propagate
  const completedRunIdRef = useRef<string | null>(null);

  // Reset isRunning to true when runId changes (new run submitted)
  // This ensures polling starts immediately for newly submitted runs
  useEffect(() => {
    if (runId) {
      setIsRunning(true);
      // Clear the completed ref so we can detect completion for the new run
      completedRunIdRef.current = null;
    }
  }, [runId]);

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

  // Control polling based on run completion status
  // Uses useEffect instead of state-during-render to avoid race conditions
  // with React Query's fast polling interval (50ms)
  useEffect(() => {
    if (!run) return;

    // Normalize status to lowercase for case-insensitive comparison
    // Backend may return "Running" (capitalized) or "running" (lowercase)
    const normalizedStatus = run.status?.toLowerCase();

    // Check if run has completed (has result or error)
    const isComplete = !!(error || run.result || run.error);
    const isStatusComplete = normalizedStatus && normalizedStatus !== "running";

    if (isComplete || isStatusComplete) {
      // Only trigger state update once per completed run
      if (completedRunIdRef.current !== run.run_id) {
        completedRunIdRef.current = run.run_id;
        setIsRunning(false);
      }
    } else if (normalizedStatus === "running") {
      // Run is still in progress
      completedRunIdRef.current = null;
      setIsRunning(true);
    }
  }, [run, error]);

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
