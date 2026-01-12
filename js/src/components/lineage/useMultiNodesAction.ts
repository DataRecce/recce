/**
 * @file useMultiNodesAction.ts
 * @description OSS wrapper for useMultiNodesAction hook from @datarecce/ui.
 *
 * This file re-exports the base hook from @datarecce/ui and provides
 * OSS-specific tracking integration via Amplitude analytics.
 *
 * @see packages/ui/src/hooks/useMultiNodesAction.ts for the base implementation
 */

import type { LineageGraphNode } from "@datarecce/ui";
import {
  type MultiNodesActionCallbacks,
  type MultiNodesActionTrackProps,
  useMultiNodesAction as useMultiNodesActionBase,
} from "@datarecce/ui";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "@/lib/api/track";

/**
 * Maps the generic action type to OSS-specific tracking constants.
 * This allows the base hook to use generic action names while
 * OSS uses its specific Amplitude tracking events.
 */
const actionTypeToExploreAction = {
  row_count: EXPLORE_ACTION.ROW_COUNT,
  row_count_diff: EXPLORE_ACTION.ROW_COUNT_DIFF,
  value_diff: EXPLORE_ACTION.VALUE_DIFF,
} as const;

/**
 * Tracking callback implementation for OSS.
 * Translates generic action tracking to Amplitude events.
 */
const handleTrackAction = (props: MultiNodesActionTrackProps) => {
  const exploreAction = actionTypeToExploreAction[props.action];
  if (exploreAction) {
    trackExploreAction({
      action: exploreAction,
      source: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
      node_count: props.node_count,
    });
  }
};

/**
 * OSS wrapper for useMultiNodesAction that provides Amplitude tracking.
 *
 * This hook wraps the base implementation from @datarecce/ui and adds
 * OSS-specific analytics tracking via Amplitude.
 *
 * @param nodes - Array of lineage graph nodes to operate on
 * @param callbacks - Lifecycle callbacks for action execution
 * @returns Object containing action state and operation methods
 *
 * @example
 * ```tsx
 * const { actionState, runRowCount, cancel } = useMultiNodesAction(
 *   selectedNodes,
 *   {
 *     onActionStarted: () => setIsRunning(true),
 *     onActionNodeUpdated: (node) => updateNodeUI(node),
 *     onActionCompleted: () => setIsRunning(false),
 *   }
 * );
 * ```
 */
export const useMultiNodesAction = (
  nodes: LineageGraphNode[],
  callbacks: MultiNodesActionCallbacks,
) => {
  return useMultiNodesActionBase(nodes, {
    ...callbacks,
    onTrackAction: handleTrackAction,
    trackingSource: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
  });
};
