import { Box, Flex, ProgressCircle, Tag } from "@chakra-ui/react";
import { PiInfo, PiWarning } from "react-icons/pi";
import { LineageGraphNode } from "@/components/lineage/lineage";
import { Tooltip } from "@/components/ui/tooltip";
import {
  isRowCountDiffRun,
  isRowCountRun,
  isValueDiffRun,
} from "@/lib/api/types";
import { ActionState } from "./LineageViewContext";
import { RowCountDiffTag, RowCountTag } from "./NodeTag";

interface ActionTagProps {
  node: LineageGraphNode;
  action: ActionState["actions"][string];
}

export const ActionTag = ({ node, action }: ActionTagProps) => {
  const { status, skipReason, run } = action;

  if (status === "pending") {
    return (
      <ProgressCircle.Root value={0} size="xs">
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
      <ProgressCircle.Root value={null} size="xs">
        <ProgressCircle.Circle>
          <ProgressCircle.Track />
          <ProgressCircle.Range />
        </ProgressCircle.Circle>
      </ProgressCircle.Root>
    );
  }

  const { error, run_id, progress } = run;

  if (status === "running") {
    if (progress?.percentage === undefined) {
      return (
        <ProgressCircle.Root value={null} size="xs">
          <ProgressCircle.Circle>
            <ProgressCircle.Track />
            <ProgressCircle.Range />
          </ProgressCircle.Circle>
        </ProgressCircle.Root>
      );
    } else {
      return (
        <ProgressCircle.Root value={progress.percentage * 100} size="xs">
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

  if (isValueDiffRun(run) && run.result) {
    const r = run.result;
    let mismatched = 0;

    for (const c of r.data.data) {
      if ((c[2] as number) < 1) {
        mismatched++;
      }
    }

    return (
      <Tag.Root backgroundColor={mismatched > 0 ? "red.100" : "green.100"}>
        <Tag.Label>
          <Flex
            fontSize="10pt"
            color={mismatched > 0 ? "red" : "green"}
            alignItems="center"
            gap="3px"
          >
            {mismatched > 0
              ? `${mismatched} columns mismatched`
              : "All columns match"}
          </Flex>
        </Tag.Label>
      </Tag.Root>
    );
  }

  if (isRowCountDiffRun(run) && run.result) {
    const result = run.result;
    return <RowCountDiffTag rowCount={result[node.data.name]} node={node} />;
  }

  if (isRowCountRun(run) && run.result) {
    const result = run.result;
    return <RowCountTag rowCount={result[node.data.name]} node={node} />;
  }

  return <>{run_id}</>;
};
