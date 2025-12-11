/**
 * @file diffColumnBuilder.tsx
 * @description Builds react-data-grid column definitions from ColumnConfig[]
 *
 * This module transforms the pure data structures from columnBuilders.ts
 * into actual column definitions with React components for headers.
 */

import React from "react";
import { ColumnOrColumnGroup } from "react-data-grid";
import {
  DataFrameColumnGroupHeader,
  DataFrameColumnGroupHeaderProps,
  defaultRenderCell,
} from "@/components/ui/dataGrid";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import { ColumnConfig } from "./columnBuilders";
import { toDiffColumn } from "./toDiffColumn";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended column type with metadata (matches existing pattern)
 */
export type DiffColumnDefinition = ColumnOrColumnGroup<RowObjectType> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
};

/**
 * Configuration for building diff column definitions
 */
export interface BuildDiffColumnDefinitionsConfig {
  /**
   * Column configurations from getDisplayColumns()
   */
  columns: ColumnConfig[];

  /**
   * Display mode for diff columns
   * - "inline": Single column with inline diff rendering
   * - "side_by_side": Column group with base/current sub-columns
   */
  displayMode: "inline" | "side_by_side";

  /**
   * Props to pass to DataFrameColumnGroupHeader for all columns
   */
  headerProps: Partial<DataFrameColumnGroupHeaderProps>;

  /**
   * Title for base column in side_by_side mode
   */
  baseTitle?: string;

  /**
   * Title for current column in side_by_side mode
   */
  currentTitle?: string;

  /**
   * Whether to add index column when no primary keys exist
   * Only applies when columns array has no isPrimaryKey entries
   * @default false
   */
  allowIndexFallback?: boolean;
}

/**
 * Result from building diff column definitions
 */
export interface BuildDiffColumnDefinitionsResult {
  /**
   * The generated column definitions ready for react-data-grid
   */
  columns: DiffColumnDefinition[];

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
function createIndexColumn(): DiffColumnDefinition {
  return {
    key: "_index",
    name: "",
    width: 50,
    maxWidth: 100,
    cellClass: "index-column",
  };
}

/**
 * Creates a primary key column definition
 *
 * Primary key columns are:
 * - Frozen (sticky left)
 * - Have a special cellClass based on row status
 * - Use defaultRenderCell (no base__/current__ prefixing)
 */
function createPrimaryKeyColumn(
  config: ColumnConfig,
  headerProps: Partial<DataFrameColumnGroupHeaderProps>,
): DiffColumnDefinition {
  const { key, name, columnType, columnStatus, columnRenderMode } = config;

  return {
    key,
    name: (
      <DataFrameColumnGroupHeader
        name={name}
        columnStatus={columnStatus ?? ""}
        columnType={columnType}
        {...headerProps}
      />
    ),
    frozen: true,
    cellClass: (row: RowObjectType) => {
      if (row.__status) {
        return `diff-header-${row.__status}`;
      }
      return undefined;
    },
    renderCell: defaultRenderCell,
    columnType,
    columnRenderMode,
  };
}

/**
 * Creates a diff column definition (non-PK column)
 *
 * Uses toDiffColumn() to handle inline vs side_by_side modes
 */
function createDiffColumn(
  config: ColumnConfig,
  displayMode: "inline" | "side_by_side",
  headerProps: Partial<DataFrameColumnGroupHeaderProps>,
  baseTitle?: string,
  currentTitle?: string,
): DiffColumnDefinition {
  const { name, columnType, columnStatus, columnRenderMode } = config;

  return toDiffColumn({
    name,
    columnStatus: columnStatus ?? "",
    columnType,
    columnRenderMode,
    displayMode,
    baseTitle,
    currentTitle,
    headerProps,
  });
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
 * - Primary key columns (frozen, special cellClass)
 * - Diff columns (via toDiffColumn for inline/side_by_side modes)
 * - Index fallback (when no PKs and allowIndexFallback is true)
 *
 * @example
 * ```tsx
 * // Get column configs from shared utility
 * const columnConfigs = getDisplayColumns({
 *   columnMap,
 *   primaryKeys,
 *   pinnedColumns,
 *   columnsRenderMode,
 *   changedOnly,
 *   rowStats,
 *   excludeColumns: ["in_a", "in_b"],
 * });
 *
 * // Build actual column definitions
 * const { columns } = buildDiffColumnDefinitions({
 *   columns: columnConfigs,
 *   displayMode: "inline",
 *   headerProps: {
 *     primaryKeys,
 *     pinnedColumns,
 *     onPinnedColumnsChange,
 *   },
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With index fallback for querydiff when no PKs
 * const { columns, usedIndexFallback } = buildDiffColumnDefinitions({
 *   columns: columnConfigs,
 *   displayMode: "side_by_side",
 *   allowIndexFallback: true,
 *   headerProps: {
 *     primaryKeys: [],
 *     pinnedColumns,
 *     onPrimaryKeyChange,
 *     onPinnedColumnsChange,
 *   },
 * });
 *
 * if (usedIndexFallback) {
 *   // Index-based matching was used
 * }
 * ```
 */
export function buildDiffColumnDefinitions(
  config: BuildDiffColumnDefinitionsConfig,
): BuildDiffColumnDefinitionsResult {
  const {
    columns: columnConfigs,
    displayMode,
    headerProps,
    baseTitle,
    currentTitle,
    allowIndexFallback = false,
  } = config;

  const columns: DiffColumnDefinition[] = [];
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
      // Primary key column - frozen with special cellClass
      columns.push(createPrimaryKeyColumn(colConfig, headerProps));
    } else {
      // Regular diff column - uses toDiffColumn for inline/side_by_side
      columns.push(
        createDiffColumn(
          colConfig,
          displayMode,
          headerProps,
          baseTitle,
          currentTitle,
        ),
      );
    }
  });

  return { columns, usedIndexFallback };
}
