import type { ColumnLineageData } from "../../api";
import { computeImpactedColumns } from "./computeImpactedColumns";
import type { NodeChangeStatus } from "./nodes/LineageNode";

/**
 * Determine whether a model node is "impacted" for the new CLL experience.
 *
 * A node is impacted if:
 * 1. The model itself has a non-null changeStatus (added/removed/modified)
 * 2. The CLL API explicitly marks it as impacted (e.g., breaking change propagation
 *    where no individual column entries exist)
 * 3. Any column belonging to this node traces upstream to a changed column
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

  // Check if the CLL API explicitly marks this node as impacted
  const cllNode = cll.current.nodes[nodeId];
  if (cllNode?.impacted) return true;

  // Check if any column on this node is impacted via parent_map walk
  const impactedColumns = computeImpactedColumns(cll);
  const prefix = `${nodeId}_`;
  for (const colId of impactedColumns) {
    if (colId.startsWith(prefix)) return true;
  }

  return false;
}
