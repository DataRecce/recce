import { SmallCloseIcon } from "@chakra-ui/icons";
import {
  Box,
  Button,
  ButtonGroup,
  HStack,
  Icon,
  IconButton,
  SlideFade,
  StackDivider,
  useUnmountEffect,
} from "@chakra-ui/react";
import { LineageGraphNode } from "./lineage";
import { FetchSelectedNodesRowCountButton } from "./NodeTag";
import { MdOutlineSchema } from "react-icons/md";
import {
  createCheckByNodeSchema,
  createCheckByRun,
  createLineageDiffCheck,
} from "@/lib/api/checks";
import { useLocation } from "wouter";
import { FiAlignLeft } from "react-icons/fi";
import { useRowCountQueries } from "@/lib/api/models";
import { TbBrandStackshare } from "react-icons/tb";
import { ValueDiffParams } from "@/lib/api/valuediff";
import { GetParamsFn, submitRuns } from "./multi-nodes-runner";

import { useEffect, useState } from "react";
import { cancelRun, submitRun, waitRun } from "@/lib/api/runs";

export interface NodeSelectorProps {
  viewMode: string;

  nodes: LineageGraphNode[];
  onClose: () => void;
  onActionStarted: () => void;
  onActionNodeUpdated: (node: LineageGraphNode) => void;
  onActionCompleted: () => void;
}

function AddSchemaChangesCheckButton({
  nodes,
  onFinish,
}: {
  nodes: LineageGraphNode[];
  onFinish: () => void;
}) {
  const [, setLocation] = useLocation();
  return (
    <Button
      size="xs"
      variant="outline"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        // TODO: Add schema changes
        let check;
        if (nodes.length === 1) {
          check = await createCheckByNodeSchema(nodes[0].id);
        } else {
          // TODO: Implement new type of check for multiple schema changes (RC-102)
          await Promise.all(
            nodes.map(async (node) => {
              await createCheckByNodeSchema(node.id);
            })
          );
        }
        onFinish();
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
      }}
    >
      <Icon as={MdOutlineSchema} />
      Add schema check
    </Button>
  );
}

function AddRowCountCheckButton({
  nodes,
  onFinish,
}: {
  nodes: LineageGraphNode[];
  onFinish: () => void;
}) {
  const [, setLocation] = useLocation();
  const { isLoading, fetchFn: fetchRowCountFn } = useRowCountQueries(
    nodes.map((node) => node.name)
  );

  return (
    <Button
      size="xs"
      isLoading={isLoading}
      loadingText="Querying"
      variant="outline"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        const runId = await fetchRowCountFn({ skipCache: true });
        const check = await createCheckByRun(runId);
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
        onFinish();
      }}
    >
      <Icon as={FiAlignLeft} />
      Add row count check
    </Button>
  );
}

export function AddLineageDiffCheckButton({
  viewMode,
  nodes,
  onFinish,
  withIcon,
}: {
  viewMode: string;
  nodes: LineageGraphNode[];
  onFinish: () => void;
  withIcon?: boolean;
}) {
  const [, setLocation] = useLocation();
  return (
    <Button
      size="xs"
      variant="outline"
      backgroundColor="white"
      isDisabled={nodes.length === 0}
      onClick={async () => {
        const nodeIds = nodes.map((node) => node.id);
        const check = await createLineageDiffCheck(viewMode, nodeIds);
        onFinish();
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
      }}
    >
      {withIcon && <Icon as={TbBrandStackshare} />}
      Add lineage diff check
    </Button>
  );
}

interface ActionState {
  status: "pending" | "running" | "canceling" | "canceled" | "completed";
  currentRunId?: string;
  completed: number;
  total: number;
}

export function NodeSelector({
  viewMode,
  nodes,
  onClose,
  onActionStarted,
  onActionNodeUpdated,
  onActionCompleted,
}: NodeSelectorProps) {
  const [actionState, setActionState] = useState<ActionState>({
    status: "pending",
    completed: 0,
    total: 0,
  });

  const [runId, setRunId] = useState<string>();

  const submitRuns = async (
    type: string,
    getParams: (node: LineageGraphNode) => {
      /* params is the input parameters for the run of a node */
      params?: any;
      /* skipReason is a string that explains why the node is skipped */
      skipReason?: string;
    }
  ) => {
    actionState.status = "running";
    onActionStarted();

    for (const node of nodes) {
      node.action = { status: "pending" };
      onActionNodeUpdated(node);
    }

    actionState.completed = 0;
    actionState.total = nodes.length;

    for (const node of nodes) {
      const { params, skipReason } = getParams(node);
      if (skipReason) {
        node.action = {
          status: "skipped",
          skipReason,
        };
        onActionNodeUpdated(node);
      } else {
        try {
          const { run_id } = await submitRun(type, params, { nowait: true });
          node.action = {
            status: "running",
          };
          onActionNodeUpdated(node);
          setRunId(run_id);

          while (true) {
            const run = await waitRun(run_id, 2);
            const status = run.error
              ? "failure"
              : run.result
              ? "success"
              : "running";
            node.action = {
              status,
              run,
            };
            onActionNodeUpdated(node);

            if (run.error || run.result) {
              break;
            }
          }
        } catch (e) {
          // don't need to do anything here, the error will be shown in the summary
        } finally {
          setRunId(undefined);
        }
      }
      actionState.completed++;
      if ((actionState.status as string) === "canceling") {
        actionState.status = "canceled";
        onActionCompleted();
        return;
      }
    }

    actionState.status = "completed";
    onActionCompleted();
  };

  const handleValueDiffClick = async () => {
    submitRuns("value_diff", (node) => {
      const primaryKey = node.data?.current?.primary_key;
      if (!primaryKey) {
        return {
          skipReason: "No primary key found",
        };
      }

      const params: Partial<ValueDiffParams> = {
        model: node.name,
        primary_key: primaryKey,
      };

      return { params };
    });
  };

  const handleCancel = async () => {
    actionState.status = "canceling";
    if (runId) {
      cancelRun(runId);
    }
  };

  useUnmountEffect(() => {
    if (actionState.status === "running") {
      handleCancel();
    }
  });

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
            <FetchSelectedNodesRowCountButton
              nodes={nodes}
              onFinish={onClose}
            />
            <AddSchemaChangesCheckButton nodes={nodes} onFinish={onClose} />
            <AddRowCountCheckButton nodes={nodes} onFinish={onClose} />
            <AddLineageDiffCheckButton
              viewMode={viewMode}
              nodes={nodes}
              onFinish={onClose}
              withIcon={true}
            />
            <Button
              size="xs"
              variant="outline"
              isDisabled={nodes.length === 0}
              onClick={handleValueDiffClick}
            >
              <Icon as={TbBrandStackshare} />
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
            Progress: {actionState.completed}/{actionState.total}{" "}
            {actionState.status === "canceled" ? " (canceled)" : ""}
          </Box>
          {actionState.status === "running" ||
          actionState.status === "canceling" ? (
            <Button
              size="xs"
              variant="outline"
              onClick={handleCancel}
              isLoading={actionState.status === "canceling"}
              loadingText="Canceling"
            >
              Cancel
            </Button>
          ) : (
            <Button size="xs" variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </HStack>
      )}
    </Box>
  );
}
