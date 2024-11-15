import { SmallCloseIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Icon,
  IconButton,
  StackDivider,
  useUnmountEffect,
} from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { findByRunType } from "../run/registry";
import { useLineageViewContext } from "./LineageViewContext";

export interface NodeSelectorProps {
  viewMode: string;
  nodes: LineageGraphNode[];
  onClose: () => void;
}

export function NodeSelector({ viewMode, nodes, onClose }: NodeSelectorProps) {
  const {
    runRowCountDiff,
    runValueDiff,
    addLineageDiffCheck,
    addSchemaDiffCheck,
    cancel,
    actionState,
  } = useLineageViewContext();

  useUnmountEffect(() => {
    if (actionState.status === "running") {
      cancel();
    }
  });

  const getProgressMessage = () => {
    if (actionState.mode === "per_node") {
      return `${actionState.completed} / ${actionState.total}`;
    } else {
      if (actionState.currentRun?.progress?.percentage) {
        return `${actionState.currentRun.progress.percentage * 100}%`;
      } else {
        if (actionState.status === "completed") {
          return "100%";
        } else {
          return "0%";
        }
      }
    }
  };

  return (
    <Box bg="white" rounded="md" shadow="dark-lg">
      {actionState.status === "pending" && (
        <HStack
          p="5px 15px"
          mt="4"
          divider={<StackDivider borderColor="gray.200" />}
          spacing={4}
        >
          <ButtonGroup
            size="xs"
            isAttached
            variant="outline"
            rounded="xs"
            onClick={onClose}
          >
            <Button>{nodes.length} selected</Button>
            <IconButton
              aria-label="Exit select Mode"
              icon={<SmallCloseIcon />}
            />
          </ButtonGroup>
          <HStack>
            <Button
              size="xs"
              variant="outline"
              isDisabled={nodes.length === 0}
              onClick={async () => {
                await addSchemaDiffCheck();
                onClose();
              }}
            >
              <Icon as={findByRunType("schema_diff")?.icon} />
              Add schema check
            </Button>
            <Button
              size="xs"
              variant="outline"
              backgroundColor="white"
              isDisabled={nodes.length === 0}
              onClick={async () => {
                await addLineageDiffCheck(viewMode);
                onClose();
              }}
            >
              <Icon as={findByRunType("lineage_diff")?.icon} />
              Add lineage diff check
            </Button>
          </HStack>
          <HStack>
            <Button
              size="xs"
              variant="outline"
              isDisabled={nodes.length === 0}
              onClick={runRowCountDiff}
            >
              <Icon as={findByRunType("row_count_diff")?.icon} />
              Row count diffs
            </Button>
            <Button
              size="xs"
              variant="outline"
              isDisabled={nodes.length === 0}
              onClick={runValueDiff}
            >
              <Icon as={findByRunType("value_diff")?.icon} />
              Value diff
            </Button>
          </HStack>
        </HStack>
      )}
      {actionState.status !== "pending" && (
        <HStack
          p="5px 15px"
          mt="4"
          divider={<StackDivider borderColor="gray.200" />}
          spacing={4}
        >
          <Box fontSize="10pt">
            Progress: {getProgressMessage()}{" "}
            {actionState.status === "canceled" ? " (canceled)" : ""}
          </Box>

          {actionState.status === "running" ||
          actionState.status === "canceling" ? (
            <Button
              size="xs"
              variant="outline"
              onClick={cancel}
              isLoading={actionState.status === "canceling"}
              loadingText="Canceling"
            >
              Cancel
            </Button>
          ) : (
            <HStack>
              <Button size="xs" variant="outline" onClick={onClose}>
                Close
              </Button>
            </HStack>
          )}
        </HStack>
      )}
    </Box>
  );
}
