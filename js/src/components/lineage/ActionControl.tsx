import { Box, Button, HStack, StackDivider } from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { useLineageViewContextSafe } from "./LineageViewContext";

export interface ActionControlProps {
  onClose: () => void;
}

export function ActionControl({ onClose }: ActionControlProps) {
  const { cancel, actionState } = useLineageViewContextSafe();

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
      <HStack p="5px 15px" mt="4" divider={<StackDivider borderColor="gray.200" />} spacing={4}>
        <Box fontSize="10pt">
          Progress: {getProgressMessage()} {actionState.status === "canceled" ? " (canceled)" : ""}
        </Box>

        {actionState.status === "running" || actionState.status === "canceling" ? (
          <Button
            size="xs"
            variant="outline"
            onClick={cancel}
            isLoading={actionState.status === "canceling"}
            loadingText="Canceling">
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
    </Box>
  );
}
