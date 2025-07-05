import { ValueDiffResult } from "@/lib/api/valuediff";
import { Box, Flex, ProgressCircle, Tag } from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { RowCountDiffResult, RowCountResult } from "@/lib/api/rowcount";
import { RowCountDiffTag, RowCountTag } from "./NodeTag";
import { ActionState } from "./LineageViewContext";
import { Tooltip } from "@/components/ui/tooltip";
import { PiInfo, PiWarning } from "react-icons/pi";

interface ActionTagProps {
  node: LineageGraphNode;
  action: ActionState["actions"][string];
}

export const ActionTag = ({ node, action }: ActionTagProps) => {
  const { status, skipReason, run } = action;

  if (status === "pending") {
    return (
      <ProgressCircle.Root value={0} size="md">
        <ProgressCircle.Circle>
          <ProgressCircle.Track />
          <ProgressCircle.Range />
        </ProgressCircle.Circle>
      </ProgressCircle.Root>
    );
  }

  if (status === "skipped") {
    return (
      <Tag.Root backgroundColor={"gray.100"}>
        <Tag.Label>
          <Flex fontSize="10pt" color="gray.500" alignItems="center" gap="3px">
            <Box>Skipped</Box>
            {skipReason && (
              <Tooltip content={skipReason}>
                <PiInfo />
              </Tooltip>
            )}
          </Flex>
        </Tag.Label>
      </Tag.Root>
    );
  }

  if (!run) {
    return (
      <ProgressCircle.Root value={null} size="md">
        <ProgressCircle.Circle>
          <ProgressCircle.Track />
          <ProgressCircle.Range />
        </ProgressCircle.Circle>
      </ProgressCircle.Root>
    );
  }

  const { error, result, run_id, progress } = run;
  if (status === "running") {
    if (progress?.percentage === undefined) {
      return (
        <ProgressCircle.Root value={null} size="md">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
      );
    } else {
      return (
        <ProgressCircle.Root value={progress.percentage * 100} size="md">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
      );
    }
  }

  if (error) {
    return (
      <Flex fontSize="10pt" color="gray">
        <Box>Error</Box>
        {skipReason && (
          <Tooltip content={error}>
            <PiWarning />
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
      <Tag.Root backgroundColor={mismatched > 0 ? "red.100" : "green.100"}>
        <Tag.Label>
          <Flex
            fontSize="10pt"
            color={mismatched > 0 ? "red" : "green"}
            alignItems="center"
            gap="3px">
            {mismatched > 0 ? `${mismatched} columns mismatched` : "All columns match"}
          </Flex>
        </Tag.Label>
      </Tag.Root>
    );
  }

  if (run.type === "row_count_diff") {
    const result = run.result as RowCountDiffResult;
    return <RowCountDiffTag rowCount={result[node.name]} node={node} />;
  }

  if (run.type === "row_count") {
    const result = run.result as RowCountResult;
    return <RowCountTag rowCount={result[node.name]} node={node} />;
  }

  return <>{run_id}</>;
};
