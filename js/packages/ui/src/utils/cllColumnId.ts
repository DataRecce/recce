/**
 * @file cllColumnId.ts
 * @description Canonical constructor + membership test for the CLL column-id
 * grammar. New code should build and test ids through here rather than
 * hand-rolling the string; some older lineage call sites still construct it
 * inline (e.g. `components/lineage/lineage.ts`).
 *
 * Column-level-lineage ids are `{node_id}_{column_name}` (mirrors the backend's
 * `recce/util/lineage.py`). Because both halves can contain underscores and one
 * node id can be a string-prefix of another, this id is NOT safely parseable by
 * splitting/prefix-stripping — doing so mis-attributes a sibling model's columns
 * (e.g. `model.shop.orders` absorbing a column of `model.shop.orders_summary`).
 * Always go the other way: build the id from a KNOWN (nodeId, column) pair and
 * test membership. A fully-typed Node/Column identity would remove the hazard
 * entirely (tracked separately); until then, route the join + membership here.
 */

/** Construct a CLL column id from a node's `unique_id` and a column name. */
export function cllColumnId(nodeId: string, column: string): string {
  return `${nodeId}_${column}`;
}

/**
 * Whether `column` of `nodeId` is in an impacted-column set — exact membership
 * over a column name we already know belongs to the node, never prefix-stripping
 * the global set.
 *
 * Caller contract: `column` MUST be a real column of `nodeId`. The helper cannot
 * disambiguate the underscore boundary on its own — `orders` + `summary_total`
 * and `orders_summary` + `total` both build `orders_summary_total` — so a query
 * for a column the node doesn't have can collide with a sibling's. Callers
 * iterate the node's own columns (the schema grid's merged rows, the profile
 * scope's `nodeColumnNames`), so this never arises in practice. The lossless
 * fix is typed identity.
 */
export function isColumnImpacted(
  nodeId: string,
  column: string,
  impactedColumns: ReadonlySet<string> | undefined,
): boolean {
  return impactedColumns?.has(cllColumnId(nodeId, column)) ?? false;
}
