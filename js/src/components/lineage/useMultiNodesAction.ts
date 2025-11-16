import { useRef } from "react";
import { RunType } from "@/components/run/registry";
import { createLineageDiffCheck } from "@/lib/api/lineagecheck";
import { RowCountDiffParams, RowCountParams } from "@/lib/api/rowcount";
import { cancelRun, submitRun, waitRun } from "@/lib/api/runs";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { ValueDiffParams } from "@/lib/api/valuediff";
import { useRecceActionContext } from "@/lib/hooks/RecceActionContext";
import { ActionState } from "./LineageViewContext";
import { LineageGraphNode } from "./lineage";

const initValue: ActionState = {
  mode: "per_node",
  status: "pending",
  completed: 0,
  total: 0,
  actions: {},
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
    getParams: (
      nodes: LineageGraphNode[],
    ) => RowCountParams | RowCountDiffParams,
  ) => {
    actionState.mode = "multi_nodes";
    actionState.actions = {};
    const mode = actionState.mode;
    const actions = actionState.actions;

    onActionStarted();
    actionState.status = "running";

    const candidates: LineageGraphNode[] = [];

    for (const node of nodes) {
      const skipReason = skip(node);

      if (skipReason) {
        actions[node.id] = {
          mode,
          status: "skipped",
          skipReason,
        };
        onActionNodeUpdated(node);
      } else {
        actions[node.id] = { mode, status: "pending" };
        candidates.push(node);
      }
    }

    const params = getParams(candidates);

    try {
      const { run_id } = await submitRun(type, params, { nowait: true });
      showRunId(run_id);
      actionState.currentRun = { run_id };
      actionState.total = 1;

      for (;;) {
        const run = await waitRun(run_id, 2);
        actionState.currentRun = run;

        const status = run.error
          ? "failure"
          : run.result
            ? "success"
            : "running";

        for (const node of candidates) {
          actions[node.id] = {
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
    } catch (_e) {
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
      params?: ValueDiffParams;
      /* skipReason is a string that explains why the node is skipped */
      skipReason?: string;
    },
  ) => {
    actionState.mode = "per_node";
    actionState.actions = {};
    const mode = actionState.mode;
    const actions = actionState.actions;

    onActionStarted();
    actionState.status = "running";

    for (const node of nodes) {
      actions[node.id] = { mode, status: "pending" };
      onActionNodeUpdated(node);
    }

    actionState.completed = 0;
    actionState.total = nodes.length;

    for (const node of nodes) {
      const { params, skipReason } = getParams(node);
      if (skipReason) {
        actions[node.id] = {
          mode,
          status: "skipped",
          skipReason,
        };
        onActionNodeUpdated(node);
      } else {
        try {
          const { run_id } = await submitRun(type, params, { nowait: true });
          actionState.currentRun = { run_id };
          actions[node.id] = {
            mode,
            status: "running",
          };
          onActionNodeUpdated(node);

          for (;;) {
            const run = await waitRun(run_id, 2);
            actionState.currentRun = run;
            const status = run.error
              ? "failure"
              : run.result
                ? "success"
                : "running";
            actions[node.id] = {
              mode,
              status,
              run,
            };
            onActionNodeUpdated(node);

            if (run.error || run.result) {
              break;
            }
          }
        } catch (_e) {
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
      if (node.data.resourceType !== "model") {
        actionState.actions[node.id] = {
          mode: "multi_nodes",
          status: "skipped",
          skipReason: "Not a model",
        };
        onActionNodeUpdated(node);
      } else {
        nodeNames.push(node.data.name);
      }
    }

    const skip = (node: LineageGraphNode) => {
      if (node.data.resourceType !== "model") {
        return "Not a model";
      }
    };
    const getParams = (nodes: LineageGraphNode[]): RowCountParams => {
      return {
        node_names: nodes.map((node) => node.data.name),
      };
    };

    await submitRunForNodes("row_count", skip, getParams);
  };

  const runRowCountDiff = async () => {
    const nodeNames = [];
    for (const node of nodes) {
      if (node.data.resourceType !== "model") {
        actionState.actions[node.id] = {
          mode: "multi_nodes",
          status: "skipped",
          skipReason: "Not a model",
        };
        onActionNodeUpdated(node);
      } else {
        nodeNames.push(node.data.name);
      }
    }

    const skip = (node: LineageGraphNode) => {
      if (node.data.resourceType !== "model") {
        return "Not a model";
      }
    };
    const getParams = (nodes: LineageGraphNode[]): RowCountDiffParams => {
      return {
        node_names: nodes.map((node) => node.data.name),
      };
    };

    await submitRunForNodes("row_count_diff", skip, getParams);
  };

  const runValueDiff = async () => {
    await submitRunsPerNodes("value_diff", (node) => {
      const primaryKey = node.data.data.current?.primary_key;
      if (!primaryKey) {
        return {
          skipReason:
            "No primary key found. The first unique column is used as primary key.",
        };
      }

      const params: ValueDiffParams = {
        model: node.data.name,
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
