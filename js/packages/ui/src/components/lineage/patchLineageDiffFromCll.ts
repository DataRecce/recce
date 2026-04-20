import type { ColumnLineageData } from "../../api/cll";
import type { MergedLineageResponse } from "../../api/info";

/**
 * Extract change analysis data from a CLL response and merge it into
 * the cached MergedLineageResponse.
 *
 * Patches node change_status and change fields in-place (shallow clone)
 * so React Query triggers a re-render.
 */
export function patchLineageFromCll(
  lineage: MergedLineageResponse,
  cllData: ColumnLineageData,
): MergedLineageResponse {
  const patchedNodes = { ...lineage.nodes };

  for (const [nodeId, cllNode] of Object.entries(cllData.current.nodes)) {
    if (!cllNode.change_status) {
      continue;
    }

    const existingNode = patchedNodes[nodeId];
    if (!existingNode) {
      continue;
    }

    // Build column change map from CLL node's columns
    let columns: Record<string, "added" | "removed" | "modified"> | undefined;
    if (cllNode.columns) {
      const columnChanges: Record<string, "added" | "removed" | "modified"> =
        {};
      let hasChanges = false;
      for (const col of Object.values(cllNode.columns)) {
        if (col.change_status) {
          columnChanges[col.name] = col.change_status;
          hasChanges = true;
        }
      }
      if (hasChanges) {
        columns = columnChanges;
      }
    }

    patchedNodes[nodeId] = {
      ...existingNode,
      change_status: cllNode.change_status,
      change: cllNode.change_category
        ? { category: cllNode.change_category, columns }
        : existingNode.change,
    };
  }

  return {
    ...lineage,
    nodes: patchedNodes,
  };
}
