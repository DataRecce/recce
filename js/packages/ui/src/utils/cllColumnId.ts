/**
 * @file cllColumnId.ts
 * @description The one place the CLL column-id grammar is encoded.
 *
 * Column-level-lineage ids are `{node_id}_{column_name}` (mirrors the backend's
 * `recce/util/lineage.py`). Because both halves can contain underscores and one
 * node id can be a string-prefix of another, this id is NOT safely parseable by
 * splitting/prefix-stripping — that mis-attributes a sibling model's columns
 * (DRC-3390 review #1). Always go the other way: build the id from a KNOWN
 * (nodeId, column) pair and test membership. A fully-typed Node/Column identity
 * is tracked in DRC-3646; until then, route the join + membership through here.
 */

/** Construct a CLL column id from a node's `unique_id` and a column name. */
export function cllColumnId(nodeId: string, column: string): string {
  return `${nodeId}_${column}`;
}

/**
 * Whether `column` of `nodeId` is in an impacted-column set — exact membership
 * over a column name we already know belongs to the node, never prefix-stripping
 * the global set.
 */
export function isColumnImpacted(
  nodeId: string,
  column: string,
  impactedColumns: ReadonlySet<string> | undefined,
): boolean {
  return impactedColumns?.has(cllColumnId(nodeId, column)) ?? false;
}
