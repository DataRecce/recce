import { findByRunType } from "@/components/run/registry";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { cancelRun, waitRun } from "@/lib/api/runs";
import { useQuery } from "@tanstack/react-query";
import { Run } from "../api/types";
import { useCallback, useEffect, useState } from "react";
import { useRunsAggregated } from "./LineageGraphContext";

interface UseRunResult {
  run?: Run;
  isPending: boolean;
  error: Error | null;
  onCancel: () => void;
  RunResultView?: React.ComponentType<any>;
}

const useCancelOnUnmount = ({
  runId,
  isPolling,
  setAborting,
}: {
  runId?: string;
  isPolling?: boolean;
  setAborting: (aborting: boolean) => void;
}) => {
  useEffect(() => {
    return () => {
      setAborting(false);
      if (runId && isPolling) {
        cancelRun(runId);
      }
    };
  }, [isPolling, runId, setAborting]);
};

export const useRun = (runId?: string): UseRunResult => {
  const [isPolling, setIsPolling] = useState(false);
  const [aborting, setAborting] = useState(false);
  useCancelOnUnmount({ runId, isPolling, setAborting });
  const [, refetchRunsAggregated] = useRunsAggregated();

  const { error, data: run } = useQuery({
    queryKey: cacheKeys.run(runId || ""),
    queryFn: async () => {
      return waitRun(runId || "", 1);
    },
    enabled: !!runId,
    refetchInterval: isPolling ? 1000 : false,
  });

  useEffect(() => {
    if (error || run?.result || run?.error) {
      setIsPolling(false);
      if (run?.type === "row_count_diff") {
        refetchRunsAggregated();
      }
    } else {
      setIsPolling(true);
    }
  }, [run, error, refetchRunsAggregated]);

  const onCancel = useCallback(async () => {
    setAborting(true);
    if (!runId) {
      return;
    }

    return await cancelRun(runId);
  }, [runId, setAborting]);

  const RunResultView = run?.type
    ? findByRunType(run.type)?.RunResultView
    : undefined;

  return {
    run,
    isPending: isPolling,
    error,
    onCancel,
    RunResultView,
  };
};
