import {
  cancelRun,
  createLineageDiffCheck,
  createSchemaDiffCheck,
  type RowCountDiffParams,
  type RowCountParams,
  type RunType,
  submitRun,
  type ValueDiffParams,
  waitRun,
} from "@datarecce/ui/api";
import { useRef } from "react";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "@/lib/api/track";
// Import Run from OSS types for proper discriminated union support
import type { Run } from "@/lib/api/types";
import { useApiConfig } from "@/lib/hooks/ApiConfigContext";
import { useRecceActionContext } from "@/lib/hooks/RecceActionAdapter";
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
  const { apiClient } = useApiConfig();
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
      const { run_id } = await submitRun(
        type,
        params,
        { nowait: true },
        apiClient,
      );
      showRunId(run_id);
      actionState.currentRun = { run_id };
      actionState.total = 1;

      for (;;) {
        // Cast from library Run to OSS Run for discriminated union support
        const run = (await waitRun(run_id, 2, apiClient)) as Run;
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
          const { run_id } = await submitRun(
            type,
            params,
            { nowait: true },
            apiClient,
          );
          actionState.currentRun = { run_id };
          actions[node.id] = {
            mode,
            status: "running",
          };
          onActionNodeUpdated(node);

          for (;;) {
            // Cast from library Run to OSS Run for discriminated union support
            const run = (await waitRun(run_id, 2, apiClient)) as Run;
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
    trackExploreAction({
      action: EXPLORE_ACTION.ROW_COUNT,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
      node_count: nodes.length,
    });

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
    trackExploreAction({
      action: EXPLORE_ACTION.ROW_COUNT_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
      node_count: nodes.length,
    });

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
    trackExploreAction({
      action: EXPLORE_ACTION.VALUE_DIFF,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
      node_count: nodes.length,
    });

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
    return await createLineageDiffCheck(
      {
        node_ids: nodeIds,
      },
      apiClient,
    );
  };

  const addSchemaDiffCheck = async () => {
    let check;
    if (nodes.length === 1) {
      check = await createSchemaDiffCheck({ node_id: nodes[0].id }, apiClient);
    } else {
      const nodeIds = nodes.map((node) => node.id);
      check = await createSchemaDiffCheck({ node_id: nodeIds }, apiClient);
    }
    return check;
  };

  const cancel = async () => {
    actionState.status = "canceling";
    if (actionState.currentRun?.run_id) {
      await cancelRun(actionState.currentRun.run_id, apiClient);
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
