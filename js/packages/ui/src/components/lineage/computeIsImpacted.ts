import type { ColumnLineageData } from "../../api";
import type { NodeChangeStatus } from "./nodes/LineageNode";

/**
 * Determine whether a model node is "impacted" for the new CLL experience.
 *
 * A node is impacted if ANY of:
 * 1. CLL analysis marks the node as impacted (node.impacted !== false)
 * 2. Any column belonging to this node has a non-null change_status
 * 3. The model itself has a non-null changeStatus (added/removed/modified)
 */
export function computeIsImpacted(
  nodeId: string,
  cll: ColumnLineageData | null,
  changeStatus: NodeChangeStatus | undefined,
): boolean {
  // Signal 3: model-level change
  if (changeStatus) {
    return true;
  }

  if (!cll) {
    return false;
  }

  // Signal 1: CLL node-level impact
  const cllNode = cll.current.nodes[nodeId];
  if (cllNode && cllNode.impacted !== false) {
    return true;
  }

  // Signal 2a: any column in the flat columns dict with a change_status
  const prefix = `${nodeId}_`;
  for (const [columnId, column] of Object.entries(cll.current.columns)) {
    if (columnId.startsWith(prefix) && column.change_status) {
      return true;
    }
  }

  // Signal 2b: any column on the node itself with a change_status
  if (cllNode?.columns) {
    for (const column of Object.values(cllNode.columns)) {
      if (column?.change_status) {
        return true;
      }
    }
  }

  return false;
}
