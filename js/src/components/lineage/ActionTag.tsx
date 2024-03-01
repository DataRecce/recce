import { Run } from "@/lib/api/types";
import { ValueDiffResult } from "@/lib/api/valuediff";
import { ExternalLinkIcon, InfoIcon, WarningIcon } from "@chakra-ui/icons";
import { Box, CircularProgress, Flex, Link, Tooltip } from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";

interface ActionTagProps {
  action: Required<LineageGraphNode>["action"];
}

export const ActionTag = ({ action }: ActionTagProps) => {
  const { status, skipReason, run } = action;

  if (status === "pending") {
    return <CircularProgress size="20px" value={0} />;
  }

  if (status === "skipped") {
    return (
      <Flex fontSize="10pt" color="gray">
        <Box>Skipped</Box>
        {skipReason && (
          <Tooltip label={skipReason}>
            <InfoIcon />
          </Tooltip>
        )}
      </Flex>
    );
  }

  if (!run) {
    return <CircularProgress isIndeterminate size="20px" />;
  }

  const { error, result, run_id, progress } = run;
  if (status === "running") {
    if (progress?.percentage === undefined) {
      return <CircularProgress isIndeterminate size="20px" />;
    } else {
      return (
        <CircularProgress size="20px" value={progress?.percentage * 100} />
      );
    }
  }

  if (error) {
    return (
      <Flex fontSize="10pt" color="gray">
        <Box>Error</Box>
        {skipReason && (
          <Tooltip label={error}>
            <WarningIcon />
          </Tooltip>
        )}
      </Flex>
    );
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
      <Flex
        fontSize="10pt"
        color={mismatched > 0 ? "red" : "green"}
        alignItems="center"
        gap="3px"
      >
        <Box>
          {mismatched > 0
            ? `${mismatched} columns mismatched`
            : "All columns match"}
        </Box>
        <Link href={window.location.origin + `#!/runs/${run_id}`}>
          <ExternalLinkIcon cursor="pointer" />
        </Link>
      </Flex>
    );
  }

  return <>{run_id}</>;
};
