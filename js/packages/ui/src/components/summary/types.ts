/**
 * @file types.ts
 * @description Type definitions for change summary components
 *
 * These types define the various change statuses that can occur in a
 * lineage graph, including node-level changes (added, removed, modified)
 * and column-level changes.
 */

import type { LineageGraph } from "../../types";

/**
 * Change status for nodes and columns in a lineage graph
 *
 * Node changes:
 * - added: New resource added to the graph
 * - removed: Resource removed from the graph
 * - modified: Resource code was modified
 *
 * Column changes:
 * - col_added: New column added to a node
 * - col_removed: Column removed from a node
 * - col_changed: Column type or definition changed
 *
 * Folder changes:
 * - folder_changed: Files in a folder were modified
 *
 * null: No change detected
 */
export type ChangeStatus =
  // node change (code change - user edit)
  | "added"
  | "removed"
  | "modified"
  // column change
  | "col_added"
  | "col_removed"
  | "col_changed"
  // folder change
  | "folder_changed"
  | null;

/**
 * Labels for each change status
 * Format: [shortLabel, longLabel]
 */
export const NODE_CHANGE_STATUS_MSGS: Record<
  NonNullable<ChangeStatus>,
  [string, string]
> = {
  added: ["Model Added", "Added resource"],
  removed: ["Model Removed", "Removed resource"],
  modified: ["Model Modified", "Modified resource"],
  col_added: ["Column Added", "Added column"],
  col_removed: ["Column Removed", "Removed column"],
  col_changed: ["Column Modified", "Modified column"],
  folder_changed: ["Modified", "Modified folder"],
};

/**
 * Props for the ChangeSummary component
 */
export interface ChangeSummaryProps {
  lineageGraph: LineageGraph;
}

/**
 * Result of calculating column changes between base and current
 */
export interface ColumnChangeResult {
  adds: number;
  removes: number;
  modifies: number;
}

/**
 * Result of calculating all changes in a lineage graph
 */
export interface ChangeSummaryResult {
  adds: number;
  removes: number;
  modifies: number;
  col_added: number;
  col_removed: number;
  col_changed: number;
}
