/**
 * @file toValueDiffGrid.ts
 * @description Value diff grid generation for joined data (with in_a/in_b columns)
 *
 * This module provides the core grid generation logic with render component injection.
 * OSS provides wrapped versions that inject OSS-specific components.
 *
 * NOTE: Backend guarantees:
 * - in_a/in_b columns are always lowercase
 * - primary_keys match actual column casing
 * Therefore, exact string matching is used everywhere.
 */

import type { DataFrame, RowObjectType } from "../../../api";
import { dataFrameToRowObjects } from "../../transforms";
import { getDisplayColumns } from "../columnBuilders";
import {
  buildDiffColumnDefinitions,
  type DiffColumnDefinition,
} from "../diffColumnBuilder";
import {
  buildJoinedColumnMap,
  getPrimaryKeyValue,
  validatePrimaryKeys,
} from "../gridUtils";
import type { DiffColumnRenderComponents } from "../renderTypes";
import { buildDiffRows } from "../rowBuilders";
import { validateToValueDiffGridInputs } from "../validation";
import type { QueryDataDiffGridOptions } from "./toDataDiffGrid";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for building the value diff grid
 */
export interface ToValueDiffGridConfig {
  /**
   * Render components for column headers and cells
   */
  renderComponents: DiffColumnRenderComponents;
}

/**
 * Result of generating a value diff grid
 */
export interface ValueDiffGridResult {
  columns: DiffColumnDefinition[];
  rows: RowObjectType[];
}

// ============================================================================
// Main Grid Generation Function
// ============================================================================

/**
 * Generates grid configuration for value diff (joined data with in_a/in_b)
 *
 * @param df - The joined DataFrame with in_a/in_b columns
 * @param primaryKeys - Array of primary key column names
 * @param options - Grid options
 * @param config - Configuration with render components
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toValueDiffGrid(
 *   joinedDataFrame,
 *   ['id'],
 *   { displayMode: 'inline' },
 *   { renderComponents }
 * );
 * ```
 */
export function toValueDiffGrid(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
  config?: ToValueDiffGridConfig,
): ValueDiffGridResult {
  validateToValueDiffGridInputs(df, primaryKeys);

  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "inline";
  const columnsRenderMode = options?.columnsRenderMode ?? {};
  const transformedData = dataFrameToRowObjects(df);

  // Build column map (expects lowercase in_a/in_b from backend)
  const columnMap = buildJoinedColumnMap(df);

  // Build row maps based on in_a/in_b columns
  const baseMap: Record<string, RowObjectType | undefined> = {};
  const currentMap: Record<string, RowObjectType | undefined> = {};

  // Validate primary keys exist (exact matching - backend provides correct casing)
  const primaryKeyKeys = validatePrimaryKeys(df.columns, primaryKeys);

  // in_a/in_b are guaranteed lowercase from backend
  const inBaseKey = columnMap.in_a.key;
  const inCurrentKey = columnMap.in_b.key;

  transformedData.forEach((row) => {
    // Generate primary key value (exact matching)
    const key = getPrimaryKeyValue(df.columns, primaryKeyKeys, row);

    // Access in_a/in_b directly (guaranteed lowercase from backend)
    if (row[inBaseKey]) {
      // Store with lowercase key for internal indexing
      baseMap[key.toLowerCase()] = row;
    }

    if (row[inCurrentKey]) {
      currentMap[key.toLowerCase()] = row;
    }
  });

  const { rows, rowStats } = buildDiffRows({
    baseMap,
    currentMap,
    baseColumns: df.columns,
    currentColumns: df.columns,
    columnMap,
    primaryKeys,
    changedOnly,
  });

  // Get column configurations for display
  const columnConfigs = getDisplayColumns({
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
    changedOnly,
    rowStats,
    excludeColumns: ["in_a", "in_b"], // Only lowercase needed
    strictMode: true,
  });

  // Build column definitions with React components
  const { columns } = buildDiffColumnDefinitions({
    columns: columnConfigs,
    displayMode,
    allowIndexFallback: false,
    baseTitle: options?.baseTitle,
    currentTitle: options?.currentTitle,
    headerProps: {
      primaryKeys,
      pinnedColumns,
      onPinnedColumnsChange: options?.onPinnedColumnsChange,
      onColumnsRenderModeChanged: options?.onColumnsRenderModeChanged,
    },
    renderComponents: config?.renderComponents ?? {
      // Default render components (for testing or when not specified)
      DataFrameColumnGroupHeader: () => null,
      defaultRenderCell: () => null,
      inlineRenderCell: () => null,
    },
  });

  return {
    columns,
    rows,
  };
}
