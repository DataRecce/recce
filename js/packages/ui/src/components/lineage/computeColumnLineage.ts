import type { ColumnLineageData } from "../../api";

export interface ColumnAnnotation {
  column: string;
  isImpacted: boolean;
  transformationType?: string;
  changeStatus?: "added" | "removed" | "modified";
}

/**
 * Walk both parent_map and child_map from a selected column to collect every
 * column in its lineage chain — upstream ancestors and downstream descendants.
 *
 * Returns a Map keyed by node ID, with an array of columns and their impact
 * status for each model that participates in the lineage chain. A model can
 * contribute multiple columns (e.g., several upstream columns feeding a
 * downstream one). The selected column itself is included exactly once.
 *
 * @param impactedColumns - Pre-computed set of impacted column IDs.
 */
export function computeColumnLineage(
  cll: ColumnLineageData,
  nodeId: string,
  column: string,
  impactedColumns: Set<string>,
): Map<string, ColumnAnnotation[]> {
  const { parent_map, child_map, columns } = cll.current;

  const result = new Map<string, ColumnAnnotation[]>();
  const visited = new Set<string>();

  function walk(columnId: string, adjacency: Record<string, string[]>) {
    if (visited.has(columnId)) return;
    visited.add(columnId);

    const col = columns[columnId];
    if (col) {
      const modelId = columnId.slice(0, -(col.name.length + 1));
      const annotations = result.get(modelId) ?? [];
      annotations.push({
        column: col.name,
        isImpacted: impactedColumns.has(columnId),
        transformationType: col.transformation_type,
        changeStatus: col.change_status as ColumnAnnotation["changeStatus"],
      });
      result.set(modelId, annotations);
    }

    const next = adjacency[columnId] ?? [];
    for (const neighbor of next) {
      walk(neighbor, adjacency);
    }
  }

  const startId = `${nodeId}_${column}`;

  // Seed the start column once so the shared `visited` set doesn't block the
  // second walk from exploring the start's neighbors in the opposite direction.
  const startCol = columns[startId];
  if (startCol) {
    const modelId = startId.slice(0, -(startCol.name.length + 1));
    result.set(modelId, [
      {
        column: startCol.name,
        isImpacted: impactedColumns.has(startId),
        transformationType: startCol.transformation_type,
        changeStatus:
          startCol.change_status as ColumnAnnotation["changeStatus"],
      },
    ]);
  }
  visited.add(startId);

  for (const parent of parent_map[startId] ?? []) {
    walk(parent, parent_map);
  }
  for (const child of child_map[startId] ?? []) {
    walk(child, child_map);
  }

  return result;
}
