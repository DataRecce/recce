import { cacheKeys } from "@/lib/api/cacheKeys";
import { getRun, waitRun } from "@/lib/api/runs";
import { QueryCache, useQuery } from "@tanstack/react-query";
import { RunView } from "./RunView";
import { ValueDiffResultView } from "../valuediff/ValueDiffResultView";

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

  return (
    <RunView
      isPending={isPending}
      error={error}
      run={run}
      RunResultView={ValueDiffResultView}
    />
  );
};
