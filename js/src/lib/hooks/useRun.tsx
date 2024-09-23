import { findByRunType } from "@/components/run/registry";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { waitRun } from "@/lib/api/runs";
import { useQuery } from "@tanstack/react-query";
import { Run } from "../api/types";
import { useEffect, useState } from "react";

interface UseRunResult {
  run?: Run;
  isPending: boolean;
  error: Error | null;
  RunResultView?: React.ComponentType<any>;
}

export const useRun = (runId?: string): UseRunResult => {
  const [isPolling, setIsPolling] = useState(true);

  const { error, data: run } = useQuery({
    queryKey: cacheKeys.run(runId || ""),
    queryFn: async () => {
      return waitRun(runId || "", 1);
    },
    enabled: !!runId && isPolling,
    refetchInterval: isPolling ? 1000 : false,
  });

  useEffect(() => {
    if (error || run?.result || run?.error) {
      setIsPolling(false);
    }
  }, [run]);

  useEffect(() => {
    setIsPolling(true);
  }, [runId]);

  const RunResultView = run?.type
    ? findByRunType(run.type)?.RunResultView
    : undefined;

  return {
    run,
    isPending: isPolling,
    error,
    RunResultView,
  };
};
