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

import { TbAlignBoxLeftStretch } from "react-icons/tb";
import { createCheckByNodeSchema, createCheckByRun } from "@/lib/api/checks";
import { useLocation } from "wouter";

import { TbBrandStackshare } from "react-icons/tb";
import { ValueDiffParams } from "@/lib/api/valuediff";
import { useCallback, useState } from "react";
import { cancelRun, submitRun, waitRun } from "@/lib/api/runs";
import { Run, RunType } from "@/lib/api/types";
import { RowCountDiffParams } from "@/lib/api/rowcount";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { createLineageDiffCheck } from "@/lib/api/lineagecheck";
import { findByRunType } from "../run/registry";

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
      <Icon as={findByRunType("schema_diff")?.icon} />
      Add schema check
    </Button>
  );
}

export function AddLineageDiffCheckButton({
  viewMode,
  nodes,
  onFinish,
  isDisabled,
  withIcon,
}: {
  viewMode: string;
  nodes: LineageGraphNode[];
  onFinish: () => void;
  withIcon?: boolean;
  isDisabled?: boolean;
}) {
  const [, setLocation] = useLocation();
  return (
    <Button
      size="xs"
      variant="outline"
      backgroundColor="white"
      isDisabled={nodes.length === 0 || isDisabled}
      onClick={async () => {
        const nodeIds = nodes.map((node) => node.id);
        const check = await createLineageDiffCheck({
          view_mode: viewMode as any,
          node_ids: nodeIds,
        });
        onFinish();
        if (check) {
          setLocation(`/checks/${check.check_id}`);
        } else {
          setLocation(`/checks`);
        }
      }}
    >
      {withIcon && <Icon as={findByRunType("lineage_diff")?.icon} />}
      Add lineage diff check
    </Button>
  );
}

interface ActionState {
  mode: "per_node" | "multi_nodes";
  status: "pending" | "running" | "canceling" | "canceled" | "completed";
  currentRun?: Partial<Run>;
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
    mode: "per_node",
    status: "pending",
    completed: 0,
    total: 0,
  });
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const submitRunForNodes = async (
    type: RunType,
    skip: (node: LineageGraphNode) => string | undefined,
    getParams: (nodes: LineageGraphNode[]) => any
  ) => {
    const mode = "multi_nodes";
    actionState.mode = mode;
    onActionStarted();
    actionState.status = "running";

    const candidates: LineageGraphNode[] = [];

    for (const node of nodes) {
      const skipReason = skip(node);

      if (skipReason) {
        node.action = {
          mode,
          status: "skipped",
          skipReason,
        };
        onActionNodeUpdated(node);
      } else {
        node.action = { mode, status: "pending" };
        candidates.push(node);
      }
    }

    const params = getParams(candidates);

    try {
      const { run_id } = await submitRun(type, params, { nowait: true });
      actionState.currentRun = { run_id };
      actionState.total = 1;

      while (true) {
        const run = await waitRun(run_id, 2);
        actionState.currentRun = run;

        const status = run.error
          ? "failure"
          : run.result
          ? "success"
          : "running";

        for (const node of candidates) {
          node.action = {
            mode,
            status,
            run,
          };
          onActionNodeUpdated(node);
        }

        if (run.error || run.result) {
          break;
        }
      }
    } catch (e) {
      // don't need to do anything here, the error will be shown in the summary
    }

    actionState.completed = 1;
    if ((actionState.status as string) === "canceling") {
      actionState.status = "canceled";
      onActionCompleted();
      return;
    }

    actionState.status = "completed";
    onActionCompleted();
  };

  const submitRunsPerNodes = async (
    type: RunType,
    getParams: (node: LineageGraphNode) => {
      /* params is the input parameters for the run of a node */
      params?: any;
      /* skipReason is a string that explains why the node is skipped */
      skipReason?: string;
    }
  ) => {
    const mode = "per_node";
    actionState.mode = mode;
    onActionStarted();
    actionState.status = "running";

    for (const node of nodes) {
      node.action = { mode, status: "pending" };
      onActionNodeUpdated(node);
    }

    actionState.completed = 0;
    actionState.total = nodes.length;

    for (const node of nodes) {
      const { params, skipReason } = getParams(node);
      if (skipReason) {
        node.action = {
          mode,
          status: "skipped",
          skipReason,
        };
        onActionNodeUpdated(node);
      } else {
        try {
          const { run_id } = await submitRun(type, params, { nowait: true });
          actionState.currentRun = { run_id };
          node.action = {
            mode,
            status: "running",
          };
          onActionNodeUpdated(node);

          while (true) {
            const run = await waitRun(run_id, 2);
            actionState.currentRun = run;
            const status = run.error
              ? "failure"
              : run.result
              ? "success"
              : "running";
            node.action = {
              mode,
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
          actionState.currentRun = undefined;
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

  const handleRowCountDiffClick = async () => {
    const nodeNames = [];
    for (const node of nodes) {
      if (node.resourceType !== "model") {
        node.action = {
          mode: "multi_nodes",
          status: "skipped",
          skipReason: "Not a model",
        };
        onActionNodeUpdated(node);
      } else {
        nodeNames.push(node.name);
      }
    }

    const skip = (node: LineageGraphNode) => {
      if (node.resourceType !== "model") {
        return "Not a model";
      }
    };
    const getParams = (nodes: LineageGraphNode[]) => {
      const params: RowCountDiffParams = {
        node_names: nodes.map((node) => node.name),
      };

      return params;
    };

    submitRunForNodes("row_count_diff", skip, getParams);
  };

  const handleValueDiffClick = async () => {
    submitRunsPerNodes("value_diff", (node) => {
      const primaryKey = node.data?.current?.primary_key;
      if (!primaryKey) {
        return {
          skipReason:
            "No primary key found. The first unique column is used as primary key.",
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
    if (actionState.currentRun?.run_id) {
      cancelRun(actionState.currentRun.run_id);
    }
  };

  const handleAddToChecklist = useCallback(async () => {
    const runId = actionState.currentRun?.run_id;

    if (!runId) {
      return;
    }

    const check = await createCheckByRun(runId);

    queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    setLocation(`/checks/${check.check_id}`);
  }, [actionState.currentRun?.run_id, setLocation, queryClient]);

  useUnmountEffect(() => {
    if (actionState.status === "running") {
      handleCancel();
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
            <AddSchemaChangesCheckButton nodes={nodes} onFinish={onClose} />

            <AddLineageDiffCheckButton
              viewMode={viewMode}
              nodes={nodes}
              onFinish={onClose}
              withIcon={true}
            />
          </HStack>
          <HStack>
            <Button
              size="xs"
              variant="outline"
              isDisabled={nodes.length === 0}
              onClick={handleRowCountDiffClick}
            >
              <Icon as={findByRunType("row_count_diff")?.icon} />
              Row count diff
            </Button>
            <Button
              size="xs"
              variant="outline"
              isDisabled={nodes.length === 0}
              onClick={handleValueDiffClick}
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
              onClick={handleCancel}
              isLoading={actionState.status === "canceling"}
              loadingText="Canceling"
            >
              Cancel
            </Button>
          ) : (
            <HStack>
              {actionState.mode === "multi_nodes" &&
                actionState.currentRun?.result && (
                  <Button
                    display="none"
                    size="xs"
                    variant="outline"
                    onClick={handleAddToChecklist}
                  >
                    Add to checklist
                  </Button>
                )}
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
