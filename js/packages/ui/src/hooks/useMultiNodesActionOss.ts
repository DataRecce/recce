/**
 * @file useMultiNodesActionOss.ts
 * @description OSS wrapper for useMultiNodesAction hook.
 *
 * This wraps the base hook and adds Amplitude tracking.
 *
 * @see useMultiNodesAction for the base implementation
 */

import type { LineageGraphNode } from "../index";
import {
  EXPLORE_ACTION,
  EXPLORE_SOURCE,
  trackExploreAction,
} from "../lib/api/track";
import {
  type MultiNodesActionCallbacks,
  type MultiNodesActionTrackProps,
  useMultiNodesAction as useMultiNodesActionBase,
} from "./useMultiNodesAction";

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
 * @param nodes - Array of lineage graph nodes to operate on
 * @param callbacks - Lifecycle callbacks for action execution
 * @returns Object containing action state and operation methods
 */
export const useMultiNodesActionOss = (
  nodes: LineageGraphNode[],
  callbacks: MultiNodesActionCallbacks,
) => {
  return useMultiNodesActionBase(nodes, {
    ...callbacks,
    onTrackAction: handleTrackAction,
    trackingSource: EXPLORE_SOURCE.LINEAGE_VIEW_TOP_BAR,
  });
};
