/**
 * @file types.ts
 * @description Schema diff types for comparing schemas between environments.
 */

/**
 * Schema diff row status
 */
export type SchemaDiffStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Schema diff row data
 */
export interface SchemaDiffRow {
  /** Column name */
  name: string;
  /** Whether column was reordered */
  reordered?: boolean;
  /** Index in current environment */
  currentIndex?: number;
  /** Index in base environment */
  baseIndex?: number;
  /** Data type in current environment */
  currentType?: string;
  /** Data type in base environment */
  baseType?: string;
  /** Row status */
  __status?: SchemaDiffStatus;
  /** Row key */
  __rowKey?: string;
}
