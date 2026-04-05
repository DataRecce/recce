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
 * Returns a Map keyed by node ID, with the column name and impact status
 * for each model that participates in the selected column's lineage chain.
 * The selected column itself is included.
 */
export function computeColumnAncestry(
  cll: ColumnLineageData,
  nodeId: string,
  column: string,
): Map<string, ColumnAnnotation> {
  const { parent_map, columns } = cll.current;
  const impactedColumns = computeImpactedColumns(cll);

  const result = new Map<string, ColumnAnnotation>();
  const visited = new Set<string>();

  function walk(columnId: string) {
    if (visited.has(columnId)) return;
    visited.add(columnId);

    // Extract node ID from column ID (format: "node_id_column_name")
    // Column IDs use the pattern: everything before the last underscore-separated
    // component that matches a column name. But since node IDs can contain underscores,
    // we look up the column in cll.current.columns to get the name, then derive the node.
    const col = columns[columnId];
    if (col) {
      // Derive node ID by removing the column name suffix
      const suffix = `_${col.name}`;
      if (columnId.endsWith(suffix)) {
        const modelId = columnId.slice(0, -suffix.length);
        result.set(modelId, {
          column: col.name,
          isImpacted: impactedColumns.has(columnId),
          transformationType: col.transformation_type,
          changeStatus: col.change_status as ColumnAnnotation["changeStatus"],
        });
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
