/**
 * @file columnBuilders.ts
 * @description Column configuration utilities for data grids
 *
 * Provides helper functions for building column configurations.
 * Note: React components for headers are kept in diffColumnBuilder.tsx
 * to maintain separation between pure logic and React components.
 */

import { type ColumnRenderMode, type ColumnType } from "../../api";

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
  } = config;

  const order: string[] = [];
  const added = new Set<string>();

  const isExcluded = (key: string) => excludeColumns.includes(key);

  // Add primary keys first
  primaryKeys.forEach((key) => {
    if (!added.has(key) && !isExcluded(key)) {
      order.push(key);
      added.add(key);
    }
  });

  // Add pinned columns
  pinnedColumns.forEach((key) => {
    if (!added.has(key) && !isExcluded(key)) {
      order.push(key);
      added.add(key);
    }
  });

  // Add remaining columns
  allColumns.forEach((key) => {
    if (!added.has(key) && !isExcluded(key)) {
      order.push(key);
      added.add(key);
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
 * Checks if a column is a primary key (exact matching)
 */
export function isPrimaryKeyColumn(
  columnName: string,
  primaryKeys: string[],
): boolean {
  return primaryKeys.includes(columnName);
}

/**
 * Checks if a column is pinned (exact matching)
 */
export function isPinnedColumn(
  columnName: string,
  pinnedColumns: string[],
): boolean {
  return pinnedColumns.includes(columnName);
}

/**
 * Checks if a column should be excluded from display (exact matching)
 */
export function isExcludedColumn(
  columnName: string,
  excludeColumns: string[],
): boolean {
  return excludeColumns.includes(columnName);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Finds a column in the columnMap (exact matching)
 */
function findColumn(
  columnMap: GridColumnsConfig["columnMap"],
  name: string,
): { key: string; colType: ColumnType; status?: string } | undefined {
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
    strictMode = false,
  } = config;

  const hasModifiedRows = (rowStats?.modified ?? 0) > 0;
  const columns: ColumnConfig[] = [];

  // Add primary key columns first
  primaryKeys.forEach((name) => {
    const col = findColumn(columnMap, name);

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
    if (isPrimaryKeyColumn(name, primaryKeys)) return;
    if (isExcludedColumn(name, excludeColumns)) return;

    const col = findColumn(columnMap, name);

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
      frozen: true,
    });
  });

  // Add remaining columns
  Object.entries(columnMap).forEach(([name, col]) => {
    if (isPrimaryKeyColumn(name, primaryKeys)) return;
    if (isPinnedColumn(name, pinnedColumns)) return;
    if (isExcludedColumn(name, excludeColumns)) return;

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
      frozen: true,
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
