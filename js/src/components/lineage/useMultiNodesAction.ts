import { LineageGraphNode } from "./lineage";
import { useLocation } from "wouter";

import { ValueDiffParams } from "@/lib/api/valuediff";
import { useRef } from "react";
import { cancelRun, submitRun, waitRun } from "@/lib/api/runs";
import { RunType } from "@/lib/api/types";
import { RowCountDiffParams, RowCountParams } from "@/lib/api/rowcount";
import { createLineageDiffCheck } from "@/lib/api/lineagecheck";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { LineageViewContextType } from "./LineageViewContext";
type ActionState = LineageViewContextType["actionState"];

const initValue: ActionState = {
  mode: "per_node",
  status: "pending",
  completed: 0,
  total: 0,
};

export const useMultiNodesAction = (
  nodes: LineageGraphNode[],
  {
    onActionStarted,
    onActionNodeUpdated,
    onActionCompleted,
  }: {
    onActionStarted: () => void;
    onActionNodeUpdated: (node: LineageGraphNode) => void;
    onActionCompleted: () => void;
  },
) => {
  const actionState = useRef<ActionState>({
    ...initValue,
  }).current;

  const { showRunId } = useRecceActionContext();

  const submitRunForNodes = async (
    type: RunType,
    skip: (node: LineageGraphNode) => string | undefined,
    getParams: (nodes: LineageGraphNode[]) => any,
  ) => {
    const mode = "multi_nodes";
    actionState.mode = mode;
    onActionStarted();
    actionState.status = "running";

    const candidates: LineageGraphNode[] = [];

    for (const node of nodes) {
      const skipReason = skip(node);

      node.isActionMode = true;
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
      showRunId(run_id);
      actionState.currentRun = { run_id };
      actionState.total = 1;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const run = await waitRun(run_id, 2);
        actionState.currentRun = run;

        const status = run.error ? "failure" : run.result ? "success" : "running";

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
    },
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
      node.isActionMode = true;
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

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          while (true) {
            const run = await waitRun(run_id, 2);
            actionState.currentRun = run;
            const status = run.error ? "failure" : run.result ? "success" : "running";
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

  const runRowCount = async () => {
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
      const params: RowCountParams = {
        node_names: nodes.map((node) => node.name),
      };

      return params;
    };

    await submitRunForNodes("row_count", skip, getParams);
  };

  const runRowCountDiff = async () => {
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

    await submitRunForNodes("row_count_diff", skip, getParams);
  };

  const runValueDiff = async () => {
    await submitRunsPerNodes("value_diff", (node) => {
      const primaryKey = node.data.current?.primary_key;
      if (!primaryKey) {
        return {
          skipReason: "No primary key found. The first unique column is used as primary key.",
        };
      }

      const params: Partial<ValueDiffParams> = {
        model: node.name,
        primary_key: primaryKey,
      };

      return { params };
    });
  };

  const addLineageDiffCheck = async () => {
    const nodeIds = nodes.map((node) => node.id);
    return await createLineageDiffCheck({
      node_ids: nodeIds,
    });
  };

  const addSchemaDiffCheck = async () => {
    let check;
    if (nodes.length === 1) {
      check = await createSchemaDiffCheck({ node_id: nodes[0].id });
    } else {
      const nodeIds = nodes.map((node) => node.id);
      check = await createSchemaDiffCheck({ node_id: nodeIds });
    }
    return check;
  };

  const cancel = async () => {
    actionState.status = "canceling";
    if (actionState.currentRun?.run_id) {
      await cancelRun(actionState.currentRun.run_id);
    }
  };

  const reset = () => {
    Object.assign(actionState, initValue);
  };

  return {
    actionState,
    runRowCount,
    runRowCountDiff,
    runValueDiff,
    addLineageDiffCheck,
    addSchemaDiffCheck,
    cancel,
    reset,
  };
};
