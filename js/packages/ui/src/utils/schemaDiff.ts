/**
 * @file utils/schemaDiff.ts
 * @description Utility functions for schema comparison and change detection
 */

import type { NodeData } from "../api";

/**
 * Checks if a schema has changed between base and current environments.
 *
 * Detects the following types of changes:
 * - Column additions or removals (different key counts)
 * - Column reordering (same keys but different order)
 * - Type modifications (column exists in both but type differs)
 *
 * @param baseSchema - The base environment schema columns
 * @param currSchema - The current environment schema columns
 * @returns `true` if schema changed, `false` if unchanged, `undefined` if either schema is missing
 *
 * @example
 * ```typescript
 * import { isSchemaChanged } from '@datarecce/ui';
 *
 * const base = { id: { type: 'integer' }, name: { type: 'string' } };
 * const curr = { id: { type: 'integer' }, name: { type: 'varchar' } };
 *
 * isSchemaChanged(base, curr); // true (type modified)
 * ```
 */
export function isSchemaChanged(
  baseSchema: NodeData["columns"],
  currSchema: NodeData["columns"],
): boolean | undefined {
  if (!baseSchema || !currSchema) {
    return undefined;
  }
  const baseKeys = Object.keys(baseSchema);
  const currKeys = Object.keys(currSchema);

  // added or removed columns
  if (baseKeys.length !== currKeys.length) {
    return true;
  }

  // reordered columns
  for (let i = 0; i < baseKeys.length; i++) {
    if (baseKeys[i] !== currKeys[i]) {
      return true;
    }
  }

  // modified column types
  for (const key of currKeys) {
    if (!baseSchema[key] || baseSchema[key].type !== currSchema[key]?.type) {
      return true;
    }
  }

  return false;
}
