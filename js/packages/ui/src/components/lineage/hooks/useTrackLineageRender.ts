import { useCallback } from "react";
import type { LineageGraphNodes } from "../../../contexts/lineage/types";
import { isLineageGraphNode } from "../../../contexts/lineage/types";
import {
  type LineageViewRenderProps,
  trackLineageViewRender,
} from "../../../lib/api/track";

/**
 * Hook that provides a function to track lineage view render events.
 * Calculates node statistics and sends tracking data.
 *
 * @returns A memoized callback function for tracking lineage renders
 */
export const useTrackLineageRender = () => {
  return useCallback(
    (
      nodes: LineageGraphNodes[],
      currentViewMode: string,
      impactRadiusEnabled: boolean,
      cllColumnActive: boolean,
      rightSidebarOpen: boolean,
    ) => {
      const lineageGraphNodesOnly = nodes.filter(isLineageGraphNode);
      // Prefix status counts with "nodes_"
      const statusCounts = lineageGraphNodesOnly.reduce<Record<string, number>>(
        (counts, node) => {
          const key = `nodes_${node.data.changeStatus ?? "unchanged"}`;
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        },
        {},
      );
      const trackingData = {
        node_count: lineageGraphNodesOnly.length,
        view_mode: currentViewMode,
        impact_radius_enabled: impactRadiusEnabled,
        right_sidebar_open: rightSidebarOpen,
        ...statusCounts,
      } as LineageViewRenderProps;
      // Only include cll_column_active when a column is being viewed
      if (cllColumnActive) {
        trackingData.cll_column_active = true;
      }
      trackLineageViewRender(trackingData);
    },
    [],
  );
};
