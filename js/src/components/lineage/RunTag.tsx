import { Run } from "@/lib/api/types";
import { ValueDiffResult } from "@/lib/api/valuediff";
import { CircularProgress } from "@chakra-ui/react";
import { Link } from "wouter";

interface RunTagProps {
  run: Run;
}

export const RunTag = ({ run }: RunTagProps) => {
  const { run_id, error, result, progress } = run;

  if (!error && !result) {
    if (progress?.percentage !== undefined) {
      return (
        <CircularProgress size="20px" value={progress?.percentage * 100} />
      );
    } else {
      return <CircularProgress isIndeterminate size="20px" />;
    }
  }

  if (error) {
    return <>Error: ${error}</>;
  }

  if (run.type === "value_diff") {
    const r = result as ValueDiffResult;
    let total = 0;
    let mismatched = 0;

    for (const c of r.data.data) {
      if ((c[2] as number) < 1) {
        mismatched++;
      }
      total++;
    }

    return (
      <Link href={`/runs/${run_id}`}>
        {mismatched}/{total}
      </Link>
    );
  }

  return <>{run_id}xx</>;
};
