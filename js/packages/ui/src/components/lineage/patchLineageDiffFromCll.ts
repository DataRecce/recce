import type { ColumnLineageData } from "../../api/cll";
import type { LineageDiffData } from "../../api/info";

/**
 * Extract change analysis data from a CLL response and merge it into
 * an existing LineageDiffData object.
 *
 * This replaces the old pattern of refetching the entire lineage after
 * a CLL call with change_analysis: true. Instead, we patch the cached
 * diff directly so React Query triggers a re-render.
 */
export function patchLineageDiffFromCll(
  existingDiff: LineageDiffData,
  cllData: ColumnLineageData,
): LineageDiffData {
  const patch: LineageDiffData = { ...existingDiff };

  for (const [nodeId, cllNode] of Object.entries(cllData.current.nodes)) {
    if (!cllNode.change_status) {
      continue;
    }

    // Build column change map from CLL node's columns
    let columns: Record<string, "added" | "removed" | "modified"> | null = null;
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

    patch[nodeId] = {
      change_status: cllNode.change_status,
      change: cllNode.change_category
        ? { category: cllNode.change_category, columns }
        : null,
    };
  }

  return patch;
}
