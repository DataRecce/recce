import type { ColumnLineageData } from "../../api";

/**
 * Walk the CLL parent_map to find all columns impacted by upstream changes.
 *
 * A column is impacted if it traces upstream (via parent_map) to any column
 * with a non-null change_status. Uses memoized DFS to avoid redundant traversal.
 *
 * @returns Set of column IDs that are impacted
 */
export function computeImpactedColumns(cll: ColumnLineageData): Set<string> {
  const { columns, parent_map } = cll.current;

  const memo = new Map<string, boolean | "pending">();

  function isImpacted(columnId: string): boolean {
    const cached = memo.get(columnId);
    if (cached === "pending") return false; // cycle
    if (cached !== undefined) return cached;

    memo.set(columnId, "pending");

    // Directly changed
    const col = columns[columnId];
    if (col?.change_status) {
      memo.set(columnId, true);
      return true;
    }

    // Check upstream
    const parents = parent_map[columnId] ?? [];
    for (const parent of parents) {
      if (isImpacted(parent)) {
        memo.set(columnId, true);
        return true;
      }
    }

    memo.set(columnId, false);
    return false;
  }

  const impacted = new Set<string>();
  for (const columnId of Object.keys(columns)) {
    if (isImpacted(columnId)) {
      impacted.add(columnId);
    }
  }

  return impacted;
}
