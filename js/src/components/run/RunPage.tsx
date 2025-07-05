import { cacheKeys } from "@/lib/api/cacheKeys";
import { waitRun } from "@/lib/api/runs";
import { useQuery } from "@tanstack/react-query";
import { RunView } from "./RunView";
import { findByRunType } from "./registry";

interface RunPageProps {
  runId: string;
}

export const RunPage = ({ runId }: RunPageProps) => {
  const {
    isPending,
    error,
    data: run,
  } = useQuery({
    queryKey: cacheKeys.run(runId),
    queryFn: async () => waitRun(runId),
  });

  const RunResultView = run?.type ? findByRunType(run.type)?.RunResultView : undefined;

  return <RunView error={error} run={run} RunResultView={RunResultView} />;
};
