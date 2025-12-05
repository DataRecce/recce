/**
 * @file columnBuilders.ts
 * @description Column configuration utilities for data grids
 *
 * Provides helper functions for building column configurations.
 * Note: React components for headers are kept in the original files
 * (querydiff.tsx, valuediff.tsx) to avoid circular dependencies.
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
// Column Configuration Helpers
// ============================================================================

/**
 * Gets the list of columns to display for a diff grid
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
  } = config;

  const hasModifiedRows = (rowStats?.modified ?? 0) > 0;
  const columns: ColumnConfig[] = [];

  // Add primary key columns first
  primaryKeys.forEach((name) => {
    const col = caseInsensitive
      ? Object.entries(columnMap).find(
          ([k]) => k.toLowerCase() === name.toLowerCase(),
        )?.[1]
      : columnMap[name];

    if (!col) return;

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

    const col = caseInsensitive
      ? Object.entries(columnMap).find(
          ([k]) => k.toLowerCase() === name.toLowerCase(),
        )?.[1]
      : columnMap[name];

    if (!col) return;

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
  } = config;

  const columns: ColumnConfig[] = [];

  // Add primary key columns first
  primaryKeys.forEach((name) => {
    const col = columnMap[name];
    if (!col) return;

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
    if (!col) return;

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
