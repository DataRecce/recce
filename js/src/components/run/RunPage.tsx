import { useQuery } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { waitRun } from "@/lib/api/runs";
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
    queryFn: async () => waitRun(runId, undefined, apiClient),
  });

  let RunResultView: RegistryEntry["RunResultView"] | undefined;
  if (run && runTypeHasRef(run.type)) {
    RunResultView = findByRunType(run.type)
      .RunResultView as RegistryEntry["RunResultView"];
  }

  return <RunView error={error} run={run} RunResultView={RunResultView} />;
};
