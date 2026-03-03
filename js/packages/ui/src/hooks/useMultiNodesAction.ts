/**
 * @file useMultiNodesAction.ts
 * @description Hook for executing batch operations on multiple lineage graph nodes.
 *
 * This hook provides functionality for running data validation operations on
 * selected nodes in the lineage graph. It supports two execution modes:
 *
 * 1. **multi_nodes mode** - A single run is submitted for all nodes at once
 *    (used for row_count, row_count_diff)
 *
 * 2. **per_node mode** - Individual runs are submitted sequentially per node
 *    (used for value_diff which requires primary key per model)
 *
 * The hook manages action state, handles run polling, cancellation, and provides
 * callbacks for UI updates during execution.
 *
 * @example
 * ```tsx
 * const { actionState, runRowCount, runRowCountDiff, cancel, reset } = useMultiNodesAction(
 *   selectedNodes,
 *   {
 *     onActionStarted: () => setIsRunning(true),
 *     onActionNodeUpdated: (node) => updateNodeUI(node),
 *     onActionCompleted: () => setIsRunning(false),
 *   }
 * );
 * ```
 */

import { useRef } from "react";
import {
  type Check,
  cancelRun,
  createLineageDiffCheck,
  createSchemaDiffCheck,
  type RowCountDiffParams,
  type RowCountParams,
  type Run,
  type RunType,
  submitRun,
  type ValueDiffParams,
  waitRun,
} from "../api";
import { useRecceActionContext } from "../contexts/action";
import type { ActionState, LineageGraphNode } from "../contexts/lineage/types";
import { useApiClient } from "../providers";

/**
 * Action types that can be tracked.
 * Maps to common data validation operations.
 */
export type MultiNodesActionType =
  | "row_count"
  | "row_count_diff"
  | "value_diff";

/**
 * Properties passed to the tracking callback when an action is executed.
 */
export interface MultiNodesActionTrackProps {
  /** The type of action being executed */
  action: MultiNodesActionType;
  /** Source/location where the action was triggered */
  source: string;
  /** Number of nodes included in the action */
  node_count: number;
}

/**
 * Callbacks for tracking analytics events during action execution.
 * This is intentionally optional to allow the base hook to be used
 * in environments without analytics (e.g., embedded or library usage).
 */
export interface MultiNodesActionTracking {
  /**
   * Called when an action is executed.
   * Implementations can use this to send analytics events.
   * @param props - Properties describing the action
   */
  onTrackAction?: (props: MultiNodesActionTrackProps) => void;
}

/**
 * Lifecycle callbacks for action execution.
 * These are called at key points during action execution to allow
 * the UI to respond to state changes.
 */
export interface MultiNodesActionCallbacks {
  /** Called when any action starts executing */
  onActionStarted: () => void;
  /** Called when a node's action state is updated (status change, completion, etc.) */
  onActionNodeUpdated: (node: LineageGraphNode) => void;
  /** Called when all actions in the batch complete (success, failure, or cancellation) */
  onActionCompleted: () => void;
}

/**
 * Configuration options for the useMultiNodesAction hook.
 */
export interface UseMultiNodesActionOptions
  extends MultiNodesActionCallbacks,
    MultiNodesActionTracking {
  /**
   * Source identifier for tracking where actions are triggered from.
   * Used in analytics events.
   * @default "lineage_view_top_bar"
   */
  trackingSource?: string;
}

/**
 * Return type for the useMultiNodesAction hook.
 */
export interface UseMultiNodesActionReturn {
  /** Current action state (mutable ref for performance) */
  actionState: ActionState;
  /** Execute row count on selected nodes (multi_nodes mode) */
  runRowCount: () => Promise<void>;
  /** Execute row count diff on selected nodes (multi_nodes mode) */
  runRowCountDiff: () => Promise<void>;
  /** Execute value diff on selected nodes (per_node mode) */
  runValueDiff: () => Promise<void>;
  /** Create a lineage diff check for selected nodes */
  addLineageDiffCheck: () => Promise<Check>;
  /** Create a schema diff check for selected nodes */
  addSchemaDiffCheck: () => Promise<Check>;
  /** Cancel the current running action */
  cancel: () => Promise<void>;
  /** Reset action state to initial values */
  reset: () => void;
}

/**
 * Initial state for action state object.
 * This is reset when the hook initializes or reset() is called.
 */
const initValue: ActionState = {
  mode: "per_node",
  status: "pending",
  completed: 0,
  total: 0,
  actions: {},
};

/**
 * Hook for executing batch operations on multiple lineage graph nodes.
 *
 * Provides methods to run data validation operations (row count, row count diff,
 * value diff) on selected nodes, with support for action tracking, cancellation,
 * and progress monitoring.
 *
 * @param nodes - Array of lineage graph nodes to operate on
 * @param options - Configuration options including callbacks and tracking
 * @returns Object containing action state and operation methods
 *
 * @example
 * ```tsx
 * function ActionBar({ selectedNodes }) {
 *   const {
 *     actionState,
 *     runRowCount,
 *     runRowCountDiff,
 *     runValueDiff,
 *     cancel,
 *     reset
 *   } = useMultiNodesAction(selectedNodes, {
 *     onActionStarted: () => console.log('Started'),
 *     onActionNodeUpdated: (node) => console.log('Updated:', node.id),
 *     onActionCompleted: () => console.log('Completed'),
 *     onTrackAction: (props) => analytics.track(props),
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={runRowCount}>Row Count</button>
 *       <button onClick={cancel}>Cancel</button>
 *       <span>{actionState.status}</span>
 *     </div>
 *   );
 * }
 * ```
 */
export const useMultiNodesAction = (
  nodes: LineageGraphNode[],
  options: UseMultiNodesActionOptions,
): UseMultiNodesActionReturn => {
  const {
    onActionStarted,
    onActionNodeUpdated,
    onActionCompleted,
    onTrackAction,
    trackingSource = "lineage_view_top_bar",
  } = options;

  const apiClient = useApiClient();
  const actionState = useRef<ActionState>({
    ...initValue,
  }).current;

  const { showRunId } = useRecceActionContext();

  /**
   * Submit a single run for multiple nodes (multi_nodes mode).
   * Used by row_count and row_count_diff operations.
   */
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
      // Error handling is done via actionState, no need to throw
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

  /**
   * Submit individual runs for each node sequentially (per_node mode).
   * Used by value_diff operation which requires per-model primary keys.
   */
  const submitRunsPerNodes = async (
    type: RunType,
    getParams: (node: LineageGraphNode) => {
      params?: ValueDiffParams;
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
          // Error handling is done via actionState
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

  /**
   * Execute row count on all selected model nodes.
   * Non-model nodes are skipped.
   */
  const runRowCount = async () => {
    onTrackAction?.({
      action: "row_count",
      source: trackingSource,
      node_count: nodes.length,
    });

    // Pre-mark non-model nodes as skipped for immediate UI feedback
    for (const node of nodes) {
      if (node.data.resourceType !== "model") {
        actionState.actions[node.id] = {
          mode: "multi_nodes",
          status: "skipped",
          skipReason: "Not a model",
        };
        onActionNodeUpdated(node);
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

  /**
   * Execute row count diff on all selected model nodes.
   * Non-model nodes are skipped.
   */
  const runRowCountDiff = async () => {
    onTrackAction?.({
      action: "row_count_diff",
      source: trackingSource,
      node_count: nodes.length,
    });

    // Pre-mark non-model nodes as skipped for immediate UI feedback
    for (const node of nodes) {
      if (node.data.resourceType !== "model") {
        actionState.actions[node.id] = {
          mode: "multi_nodes",
          status: "skipped",
          skipReason: "Not a model",
        };
        onActionNodeUpdated(node);
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

  /**
   * Execute value diff on all selected nodes that have primary keys.
   * Nodes without primary keys are skipped.
   */
  const runValueDiff = async () => {
    onTrackAction?.({
      action: "value_diff",
      source: trackingSource,
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

  /**
   * Create a lineage diff check for the selected nodes.
   * @returns The created check object
   */
  const addLineageDiffCheck = async () => {
    const nodeIds = nodes.map((node) => node.id);
    return await createLineageDiffCheck(
      {
        node_ids: nodeIds,
      },
      apiClient,
    );
  };

  /**
   * Create a schema diff check for the selected nodes.
   * Handles both single node and multi-node scenarios.
   * @returns The created check object
   */
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

  /**
   * Cancel the current running action.
   * Sets status to "canceling" and calls cancelRun API if a run is in progress.
   */
  const cancel = async () => {
    actionState.status = "canceling";
    if (actionState.currentRun?.run_id) {
      await cancelRun(actionState.currentRun.run_id, apiClient);
    }
  };

  /**
   * Reset action state to initial values.
   * Call this before starting a new action to clear previous state.
   */
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
