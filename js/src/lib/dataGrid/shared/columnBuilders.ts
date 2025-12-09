/**
 * @file columnBuilders.ts
 * @description Column configuration utilities for data grids
 *
 * Provides helper functions for building column configurations.
 * Note: React components for headers are kept in diffColumnBuilder.tsx
 * to maintain separation between pure logic and React components.
 */

import { ColumnRenderMode, ColumnType } from "@/lib/api/types";
import { includesIgnoreCase } from "@/utils/transforms";

// ============================================================================
// Types
// ============================================================================

export interface ColumnConfig {
  key: string;
  name: string;
  columnType: ColumnType;
  columnStatus?: string;
  columnRenderMode?: ColumnRenderMode;
  frozen?: boolean;
  isPrimaryKey?: boolean;
}

export interface ColumnOrderConfig {
  primaryKeys: string[];
  pinnedColumns: string[];
  allColumns: string[];
  excludeColumns?: string[];
  caseInsensitive?: boolean;
}

export interface GridColumnsConfig {
  columnMap: Record<
    string,
    { key: string; colType: ColumnType; status?: string }
  >;
  primaryKeys: string[];
  pinnedColumns: string[];
  columnsRenderMode: Record<string, ColumnRenderMode>;
  changedOnly?: boolean;
  rowStats?: { added: number; removed: number; modified: number };
  excludeColumns?: string[];
  caseInsensitive?: boolean;
  /**
   * When true, throws an error if a primary key or pinned column is not found
   * in the columnMap. When false (default), silently skips missing columns.
   *
   * - querydiff: uses false (lenient, handles schema differences)
   * - valuediff: uses true (strict, PKs must exist)
   */
  strictMode?: boolean;
}

// ============================================================================
// Column Order Builder
// ============================================================================

/**
 * Determines the order of columns based on primary keys, pinned columns,
 * and remaining columns.
 *
 * @returns Array of column names in the correct display order
 */
export function buildColumnOrder(config: ColumnOrderConfig): string[] {
  const {
    primaryKeys,
    pinnedColumns,
    allColumns,
    excludeColumns = [],
    caseInsensitive = false,
  } = config;

  const order: string[] = [];
  const added = new Set<string>();

  const normalize = (s: string) => (caseInsensitive ? s.toLowerCase() : s);
  const isExcluded = (key: string) =>
    caseInsensitive
      ? includesIgnoreCase(excludeColumns, key)
      : excludeColumns.includes(key);

  // Add primary keys first
  primaryKeys.forEach((key) => {
    const normalizedKey = normalize(key);
    if (!added.has(normalizedKey) && !isExcluded(key)) {
      order.push(key);
      added.add(normalizedKey);
    }
  });

  // Add pinned columns
  pinnedColumns.forEach((key) => {
    const normalizedKey = normalize(key);
    if (!added.has(normalizedKey) && !isExcluded(key)) {
      order.push(key);
      added.add(normalizedKey);
    }
  });

  // Add remaining columns
  allColumns.forEach((key) => {
    const normalizedKey = normalize(key);
    if (!added.has(normalizedKey) && !isExcluded(key)) {
      order.push(key);
      added.add(normalizedKey);
    }
  });

  return order;
}

// ============================================================================
// Column Filtering Helpers
// ============================================================================

/**
 * Checks if a column should be included based on changedOnly filter
 */
export function shouldIncludeColumn(
  columnStatus: string | undefined,
  changedOnly: boolean,
  hasModifiedRows: boolean,
): boolean {
  if (!changedOnly || !hasModifiedRows) {
    return true;
  }

  return (
    columnStatus === "added" ||
    columnStatus === "removed" ||
    columnStatus === "modified"
  );
}

/**
 * Checks if a column is a primary key
 */
export function isPrimaryKeyColumn(
  columnName: string,
  primaryKeys: string[],
  caseInsensitive = false,
): boolean {
  return caseInsensitive
    ? includesIgnoreCase(primaryKeys, columnName)
    : primaryKeys.includes(columnName);
}

/**
 * Checks if a column is pinned
 */
export function isPinnedColumn(
  columnName: string,
  pinnedColumns: string[],
  caseInsensitive = false,
): boolean {
  return caseInsensitive
    ? includesIgnoreCase(pinnedColumns, columnName)
    : pinnedColumns.includes(columnName);
}

/**
 * Checks if a column should be excluded from display
 */
export function isExcludedColumn(
  columnName: string,
  excludeColumns: string[],
  caseInsensitive = false,
): boolean {
  return caseInsensitive
    ? includesIgnoreCase(excludeColumns, columnName)
    : excludeColumns.includes(columnName);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Finds a column in the columnMap, with optional case-insensitive matching
 */
function findColumn(
  columnMap: GridColumnsConfig["columnMap"],
  name: string,
  caseInsensitive: boolean,
): { key: string; colType: ColumnType; status?: string } | undefined {
  if (caseInsensitive) {
    const entry = Object.entries(columnMap).find(
      ([k]) => k.toLowerCase() === name.toLowerCase(),
    );
    return entry?.[1];
  }
  return columnMap[name];
}

// ============================================================================
// Column Configuration Helpers
// ============================================================================

/**
 * Gets the list of columns to display for a diff grid
 *
 * @description Builds an ordered list of column configurations:
 * 1. Primary key columns (frozen)
 * 2. Pinned columns
 * 3. Remaining columns (filtered by changedOnly if applicable)
 *
 * @throws {Error} When strictMode is true and a primary key or pinned column
 *                 is not found in the columnMap
 *
 * @example
 * ```typescript
 * // Lenient mode (querydiff) - skips missing columns
 * const columns = getDisplayColumns({
 *   columnMap,
 *   primaryKeys: ["id"],
 *   pinnedColumns: ["name"],
 *   columnsRenderMode: {},
 *   strictMode: false, // default
 * });
 *
 * // Strict mode (valuediff) - throws on missing columns
 * const columns = getDisplayColumns({
 *   columnMap,
 *   primaryKeys: ["id"],
 *   pinnedColumns: ["name"],
 *   columnsRenderMode: {},
 *   strictMode: true,
 * });
 * ```
 */
export function getDisplayColumns(config: GridColumnsConfig): ColumnConfig[] {
  const {
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
    changedOnly = false,
    rowStats,
    excludeColumns = [],
    caseInsensitive = false,
    strictMode = false,
  } = config;

  const hasModifiedRows = (rowStats?.modified ?? 0) > 0;
  const columns: ColumnConfig[] = [];

  // Add primary key columns first
  primaryKeys.forEach((name) => {
    const col = findColumn(columnMap, name, caseInsensitive);

    if (!col) {
      if (strictMode) {
        throw new Error(`Primary key column "${name}" not found in columnMap`);
      }
      return;
    }

    columns.push({
      key: name,
      name,
      columnType: col.colType,
      columnStatus: col.status,
      columnRenderMode: columnsRenderMode[name],
      frozen: true,
      isPrimaryKey: true,
    });
  });

  // Add pinned columns
  pinnedColumns.forEach((name) => {
    if (isPrimaryKeyColumn(name, primaryKeys, caseInsensitive)) return;
    if (isExcludedColumn(name, excludeColumns, caseInsensitive)) return;

    const col = findColumn(columnMap, name, caseInsensitive);

    if (!col) {
      if (strictMode) {
        throw new Error(`Pinned column "${name}" not found in columnMap`);
      }
      return;
    }

    columns.push({
      key: name,
      name,
      columnType: col.colType,
      columnStatus: col.status,
      columnRenderMode: columnsRenderMode[name],
    });
  });

  // Add remaining columns
  Object.entries(columnMap).forEach(([name, col]) => {
    if (isPrimaryKeyColumn(name, primaryKeys, caseInsensitive)) return;
    if (isPinnedColumn(name, pinnedColumns, caseInsensitive)) return;
    if (isExcludedColumn(name, excludeColumns, caseInsensitive)) return;

    if (!shouldIncludeColumn(col.status, changedOnly, hasModifiedRows)) {
      return;
    }

    columns.push({
      key: name,
      name,
      columnType: col.colType,
      columnStatus: col.status,
      columnRenderMode: columnsRenderMode[name],
    });
  });

  return columns;
}

/**
 * Gets the list of columns for a simple (non-diff) grid
 */
export function getSimpleDisplayColumns(
  config: Omit<GridColumnsConfig, "changedOnly" | "rowStats">,
): ColumnConfig[] {
  const {
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
    excludeColumns = [],
    strictMode = false,
  } = config;

  const columns: ColumnConfig[] = [];

  // Add primary key columns first
  primaryKeys.forEach((name) => {
    const col = columnMap[name];

    if (!col) {
      if (strictMode) {
        throw new Error(`Primary key column "${name}" not found in columnMap`);
      }
      return;
    }

    columns.push({
      key: name,
      name,
      columnType: col.colType,
      columnRenderMode: columnsRenderMode[name],
      frozen: true,
      isPrimaryKey: true,
    });
  });

  // Add pinned columns
  pinnedColumns.forEach((name) => {
    if (primaryKeys.includes(name)) return;
    if (excludeColumns.includes(name)) return;

    const col = columnMap[name];

    if (!col) {
      if (strictMode) {
        throw new Error(`Pinned column "${name}" not found in columnMap`);
      }
      return;
    }

    columns.push({
      key: col.key,
      name,
      columnType: col.colType,
      columnRenderMode: columnsRenderMode[name],
    });
  });

  // Add remaining columns
  Object.entries(columnMap).forEach(([name, col]) => {
    if (primaryKeys.includes(name)) return;
    if (pinnedColumns.includes(name)) return;
    if (excludeColumns.includes(name)) return;

    columns.push({
      key: col.key,
      name,
      columnType: col.colType,
      columnRenderMode: columnsRenderMode[name],
    });
  });

  return columns;
}
