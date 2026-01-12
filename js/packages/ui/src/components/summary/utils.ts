/**
 * @file utils.ts
 * @description Utility functions for change summary calculations
 *
 * These functions calculate change statistics across a lineage graph,
 * including node-level and column-level changes.
 */

import type { NodeData } from "../../api/info";
import { token } from "../../theme/colors";
import type { LineageGraph } from "../../types";
import {
  IconAdded,
  IconChanged,
  type IconComponent,
  IconModified,
  IconRemoved,
} from "../lineage/styles";
import type {
  ChangeStatus,
  ChangeSummaryResult,
  ColumnChangeResult,
} from "./types";

/**
 * Get icon and color for a given change status
 *
 * Maps change statuses to visual indicators (icons and colors) for
 * consistent display across the UI.
 *
 * @param changeStatus - The change status to get icon for
 * @returns Object with color and icon component
 */
export function getIconForChangeStatus(changeStatus?: ChangeStatus): {
  color: string;
  icon: IconComponent | undefined;
} {
  const greenColor = String(token("colors.green.solid"));
  const redColor = String(token("colors.red.solid"));
  const amberColor = String(token("colors.amber.emphasized"));

  if (changeStatus === "added") {
    return { color: greenColor, icon: IconAdded };
  } else if (changeStatus === "removed") {
    return { color: redColor, icon: IconRemoved };
  } else if (changeStatus === "modified") {
    return { color: amberColor, icon: IconModified };
  } else if (changeStatus === "col_added") {
    return { color: greenColor, icon: IconAdded };
  } else if (changeStatus === "col_removed") {
    return { color: redColor, icon: IconRemoved };
  } else if (changeStatus === "col_changed") {
    return { color: amberColor, icon: IconModified };
  } else if (changeStatus === "folder_changed") {
    return { color: amberColor, icon: IconChanged };
  }

  return { color: "inherit", icon: undefined };
}

/**
 * Calculate column changes between base and current node data
 *
 * Compares the columns in base and current versions of a node to
 * determine how many columns were added, removed, or modified.
 *
 * @param base - Base version node data
 * @param current - Current version node data
 * @returns Column change counts
 */
export function calculateColumnChange(
  base: NodeData | undefined,
  current: NodeData | undefined,
): ColumnChangeResult {
  let adds = 0;
  let removes = 0;
  let modifies = 0;
  if (!base && !current) return { adds, removes, modifies };

  // Add columns
  if (current) {
    Object.keys(current.columns ?? {}).forEach((col) => {
      if (!base?.columns?.[col]) adds++;
    });
  }

  // Remove columns
  if (base) {
    Object.keys(base.columns ?? {}).forEach((col) => {
      if (!current?.columns?.[col]) removes++;
    });
  }

  // Modify columns
  if (current && base) {
    Object.keys(current.columns ?? {}).forEach((col) => {
      if (base.columns && current.columns?.[col] && base.columns[col]) {
        if (base.columns[col].type !== current.columns[col].type) modifies++;
      }
    });
  }

  return { adds, removes, modifies };
}

/**
 * Calculate all changes in a lineage graph
 *
 * Iterates through all modified nodes in the lineage graph and
 * aggregates node-level and column-level changes.
 *
 * @param lineageGraph - The lineage graph to analyze
 * @returns Aggregated change counts
 */
export function calculateChangeSummary(
  lineageGraph: LineageGraph,
): ChangeSummaryResult {
  const modifiedSet = lineageGraph.modifiedSet;
  let adds = 0;
  let removes = 0;
  let modifies = 0;
  let col_added = 0;
  let col_removed = 0;
  let col_changed = 0;

  modifiedSet.forEach((nodeId) => {
    if (lineageGraph.nodes[nodeId].data.changeStatus === "added") adds++;
    else if (lineageGraph.nodes[nodeId].data.changeStatus === "removed")
      removes++;
    else if (lineageGraph.nodes[nodeId].data.changeStatus === "modified")
      modifies++;

    const base = lineageGraph.nodes[nodeId].data.data.base;
    const current = lineageGraph.nodes[nodeId].data.data.current;
    const columnChange = calculateColumnChange(base, current);
    col_added += columnChange.adds;
    col_removed += columnChange.removes;
    col_changed += columnChange.modifies;
  });

  return { adds, removes, modifies, col_added, col_removed, col_changed };
}
