/**
 * @file simpleColumnBuilder.tsx
 * @description Builds react-data-grid column definitions for simple (non-diff) grids
 *
 * This module transforms the pure data structures from columnBuilders.ts
 * into actual column definitions with React components for headers.
 *
 * Unlike diffColumnBuilder.tsx, this handles simple grids without:
 * - Base/current value comparison
 * - Inline vs side-by-side display modes
 * - Column status (added/removed/modified)
 */

import React from "react";
import { ColumnOrColumnGroup } from "react-data-grid";
import {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
} from "@/components/ui/dataGrid";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import { ColumnConfig } from "./columnBuilders";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended column type with metadata (matches existing pattern)
 */
export type SimpleColumnDefinition = ColumnOrColumnGroup<RowObjectType> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
};

/**
 * Configuration for building simple column definitions
 */
export interface BuildSimpleColumnDefinitionsConfig {
  /**
   * Column configurations from getSimpleDisplayColumns()
   */
  columns: ColumnConfig[];

  /**
   * Props to pass to column headers
   */
  headerProps: {
    pinnedColumns?: string[];
    onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
    onColumnsRenderModeChanged?: (
      cols: Record<string, ColumnRenderMode>,
    ) => void;
  };

  /**
   * Whether to add index column when no primary keys exist
   * Only applies when columns array has no isPrimaryKey entries
   * @default true
   */
  allowIndexFallback?: boolean;
}

/**
 * Result from building simple column definitions
 */
export interface BuildSimpleColumnDefinitionsResult {
  /**
   * The generated column definitions ready for react-data-grid
   */
  columns: SimpleColumnDefinition[];

  /**
   * Whether an index fallback column was added
   */
  usedIndexFallback: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates the index fallback column used when no primary keys are specified
 */
function createIndexColumn(): SimpleColumnDefinition {
  return {
    key: "_index",
    name: "",
    width: 50,
    cellClass: "index-column",
  };
}

/**
 * Creates a primary key column definition
 *
 * Primary key columns are:
 * - Frozen (sticky left)
 * - Use DataFrameColumnGroupHeader (with columnStatus="")
 * - Use defaultRenderCell
 */
function createPrimaryKeyColumn(
  config: ColumnConfig,
  headerProps: BuildSimpleColumnDefinitionsConfig["headerProps"],
): SimpleColumnDefinition {
  const { key, name, columnType, columnRenderMode } = config;

  return {
    key,
    name: (
      <DataFrameColumnGroupHeader
        name={name}
        columnStatus=""
        columnType={columnType}
        pinnedColumns={headerProps.pinnedColumns}
        onPinnedColumnsChange={headerProps.onPinnedColumnsChange}
        onColumnsRenderModeChanged={headerProps.onColumnsRenderModeChanged}
      />
    ),
    width: "auto",
    frozen: true,
    renderCell: defaultRenderCell,
    columnType,
    columnRenderMode,
  };
}

/**
 * Creates a regular (non-PK) column definition
 *
 * Regular columns use DataFrameColumnHeader (simpler, no PK toggle)
 */
function createRegularColumn(
  config: ColumnConfig,
  headerProps: BuildSimpleColumnDefinitionsConfig["headerProps"],
): SimpleColumnDefinition {
  const { key, name, columnType, columnRenderMode } = config;

  return {
    key,
    name: (
      <DataFrameColumnHeader
        name={name}
        columnType={columnType}
        pinnedColumns={headerProps.pinnedColumns}
        onPinnedColumnsChange={headerProps.onPinnedColumnsChange}
        onColumnsRenderModeChanged={headerProps.onColumnsRenderModeChanged}
      />
    ),
    width: "auto",
    renderCell: defaultRenderCell,
    columnType,
    columnRenderMode,
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Builds react-data-grid column definitions from ColumnConfig array
 *
 * @description Transforms pure column configuration objects into actual
 * column definitions with React JSX headers. Handles:
 *
 * - Primary key columns (frozen, use DataFrameColumnGroupHeader)
 * - Regular columns (use DataFrameColumnHeader)
 * - Index fallback (when no PKs and allowIndexFallback is true)
 *
 * @example
 * ```tsx
 * // Get column configs from shared utility
 * const columnConfigs = getSimpleDisplayColumns({
 *   columnMap,
 *   primaryKeys,
 *   pinnedColumns,
 *   columnsRenderMode,
 * });
 *
 * // Build actual column definitions
 * const { columns } = buildSimpleColumnDefinitions({
 *   columns: columnConfigs,
 *   headerProps: {
 *     pinnedColumns,
 *     onPinnedColumnsChange,
 *     onColumnsRenderModeChanged,
 *   },
 * });
 * ```
 */
export function buildSimpleColumnDefinitions(
  config: BuildSimpleColumnDefinitionsConfig,
): BuildSimpleColumnDefinitionsResult {
  const {
    columns: columnConfigs,
    headerProps,
    allowIndexFallback = true,
  } = config;

  const columns: SimpleColumnDefinition[] = [];
  let usedIndexFallback = false;

  // Check if we have any primary key columns
  const hasPrimaryKeys = columnConfigs.some((col) => col.isPrimaryKey);

  // Add index fallback if no PKs and allowed
  if (!hasPrimaryKeys && allowIndexFallback) {
    columns.push(createIndexColumn());
    usedIndexFallback = true;
  }

  // Build column definitions
  columnConfigs.forEach((colConfig) => {
    if (colConfig.isPrimaryKey) {
      columns.push(createPrimaryKeyColumn(colConfig, headerProps));
    } else {
      columns.push(createRegularColumn(colConfig, headerProps));
    }
  });

  return { columns, usedIndexFallback };
}
