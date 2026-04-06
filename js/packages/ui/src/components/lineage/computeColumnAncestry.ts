import type { ColumnLineageData } from "../../api";
import { computeImpactedColumns } from "./computeImpactedColumns";

export interface ColumnAnnotation {
  column: string;
  isImpacted: boolean;
  transformationType?: string;
  changeStatus?: "added" | "removed" | "modified";
}

/**
 * Walk parent_map from a selected column to collect all ancestor columns.
 *
 * Returns a Map keyed by node ID, with an array of columns and their impact
 * status for each model that participates in the selected column's lineage
 * chain. A model can have multiple ancestor columns (e.g., a downstream
 * column may depend on several columns from the same upstream model).
 * The selected column itself is included.
 */
export function computeColumnAncestry(
  cll: ColumnLineageData,
  nodeId: string,
  column: string,
): Map<string, ColumnAnnotation[]> {
  const { parent_map, columns } = cll.current;
  const impactedColumns = computeImpactedColumns(cll);

  const result = new Map<string, ColumnAnnotation[]>();
  const visited = new Set<string>();

  function walk(columnId: string) {
    if (visited.has(columnId)) return;
    visited.add(columnId);

    const col = columns[columnId];
    if (col) {
      const suffix = `_${col.name}`;
      if (columnId.endsWith(suffix)) {
        const modelId = columnId.slice(0, -suffix.length);
        const annotations = result.get(modelId) ?? [];
        annotations.push({
          column: col.name,
          isImpacted: impactedColumns.has(columnId),
          transformationType: col.transformation_type,
          changeStatus: col.change_status as ColumnAnnotation["changeStatus"],
        });
        result.set(modelId, annotations);
      }
    }

    // Walk upstream
    const parents = parent_map[columnId] ?? [];
    for (const parent of parents) {
      walk(parent);
    }
  }

  const startId = `${nodeId}_${column}`;
  walk(startId);

  return result;
}
