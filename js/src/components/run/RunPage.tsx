import { cacheKeys, waitRun } from "@datarecce/ui/api";
import { useQuery } from "@tanstack/react-query";
// Import Run from OSS types for proper discriminated union support
import type { Run } from "@/lib/api/types";
import { useApiConfig } from "@/lib/hooks/ApiConfigContext";
import { RunView } from "./RunView";
import { findByRunType, RegistryEntry, runTypeHasRef } from "./registry";

interface RunPageProps {
  runId: string;
}

export const RunPage = ({ runId }: RunPageProps) => {
  const { apiClient } = useApiConfig();
  const { error, data: run } = useQuery({
    queryKey: cacheKeys.run(runId),
    // Cast from library Run to OSS Run for discriminated union support
    queryFn: async () => (await waitRun(runId, undefined, apiClient)) as Run,
  });

  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (run && runTypeHasRef(run.type)) {
    RunResultView = findByRunType(run.type)
      .RunResultView as RegistryEntry["RunResultView"];
  }

  return <RunView error={error} run={run} RunResultView={RunResultView} />;
};
