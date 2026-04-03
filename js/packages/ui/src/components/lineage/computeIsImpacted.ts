import type { ColumnLineageData } from "../../api";
import type { NodeChangeStatus } from "./nodes/LineageNode";
import { computeImpactedColumns } from "./computeImpactedColumns";

/**
 * Determine whether a model node is "impacted" for the new CLL experience.
 *
 * A node is impacted if:
 * 1. The model itself has a non-null changeStatus (added/removed/modified)
 * 2. Any column belonging to this node traces upstream to a changed column
 *    (determined by walking the CLL parent_map)
 */
export function computeIsImpacted(
  nodeId: string,
  cll: ColumnLineageData | null,
  changeStatus: NodeChangeStatus | undefined,
): boolean {
  // Model-level change
  if (changeStatus) return true;
  if (!cll) return false;

  // Check if any column on this node is impacted via parent_map walk
  const impactedColumns = computeImpactedColumns(cll);
  const prefix = `${nodeId}_`;
  for (const colId of impactedColumns) {
    if (colId.startsWith(prefix)) return true;
  }

  return false;
}
