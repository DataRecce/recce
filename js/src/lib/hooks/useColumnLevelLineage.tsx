import { cacheKeys } from "@/lib/api/cacheKeys";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CllResponse, waitCll } from "../api/cll";

interface UseCllResult {
  cll?: CllResponse;
  isRunning: boolean;
  error: Error | null;
}

export const useCll = (cllId?: string): UseCllResult => {
  const [isRunning, setIsRunning] = useState(false);

  const { error, data: cll } = useQuery({
    queryKey: cacheKeys.cll(cllId ?? ""),
    queryFn: async () => {
      return waitCll(cllId ?? "", isRunning ? 2 : 0);
    },
    enabled: !!cllId,
    refetchInterval: isRunning ? 150 : false,
    retry: false,
  });

  useEffect(() => {
    if (error || cll?.result || cll?.error) {
      if (isRunning) {
        setIsRunning(false);
      }
    }

    if (cll?.status === "running") {
      setIsRunning(true);
    }
  }, [cll, error, isRunning]);

  return {
    cll,
    isRunning,
    error,
  };
};
