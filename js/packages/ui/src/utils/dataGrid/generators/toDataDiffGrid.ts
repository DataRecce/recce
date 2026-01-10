/**
 * @file toDataDiffGrid.ts
 * @description Query diff grid generation for comparing base and current DataFrames
 *
 * This module provides the core grid generation logic with render component injection.
 * OSS provides wrapped versions that inject OSS-specific components.
 */

import type { ColumnRenderMode, DataFrame, RowObjectType } from "../../../api";
import { dataFrameToRowObjects } from "../../transforms";
import { getDisplayColumns } from "../columnBuilders";
import {
  buildDiffColumnDefinitions,
  type DiffColumnDefinition,
} from "../diffColumnBuilder";
import {
  buildMergedColumnMap,
  getPrimaryKeyValue,
  validatePrimaryKeys,
} from "../gridUtils";
import type { DiffColumnRenderComponents } from "../renderTypes";
import { buildDiffRows, type RowStats } from "../rowBuilders";
import { validateToDataDiffGridInputs } from "../validation";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for generating a data diff grid
 */
export interface QueryDataDiffGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
  changedOnly?: boolean;
  baseTitle?: string;
  currentTitle?: string;
  displayMode?: "side_by_side" | "inline";
}

/**
 * Configuration for building the data diff grid
 */
export interface ToDataDiffGridConfig {
  /**
   * Render components for column headers and cells
   */
  renderComponents: DiffColumnRenderComponents;
}

/**
 * Result of generating a data diff grid
 */
export interface DataDiffGridResult {
  columns: DiffColumnDefinition[];
  rows: RowObjectType[];
  invalidPKeyBase: boolean;
  invalidPKeyCurrent: boolean;
}

// ============================================================================
// Main Grid Generation Function
// ============================================================================

/**
 * Generates grid configuration for comparing base and current DataFrames
 *
 * @param base - The base DataFrame (optional)
 * @param current - The current DataFrame (optional)
 * @param options - Grid options (primary keys, display mode, etc.)
 * @param config - Configuration with render components
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toDataDiffGrid(
 *   baseDataFrame,
 *   currentDataFrame,
 *   { primaryKeys: ['id'], displayMode: 'inline' },
 *   { renderComponents }
 * );
 * ```
 */
export function toDataDiffGrid(
  _base?: DataFrame,
  _current?: DataFrame,
  options?: QueryDataDiffGridOptions,
  config?: ToDataDiffGridConfig,
): DataDiffGridResult {
  validateToDataDiffGridInputs(_base, _current, options);

  const base = _base ?? { columns: [], data: [] };
  const current = _current ?? { columns: [], data: [] };
  const primaryKeys = options?.primaryKeys ?? [];
  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "side_by_side";
  const columnsRenderMode = options?.columnsRenderMode ?? {};

  const baseData = dataFrameToRowObjects(base);
  const currentData = dataFrameToRowObjects(current);

  // Build merged column map
  const columnMap = buildMergedColumnMap(base, current);

  // Build row maps indexed by primary key
  const baseMap: Record<string, RowObjectType> = {};
  const currentMap: Record<string, RowObjectType> = {};
  let invalidPKeyBase = false;
  let invalidPKeyCurrent = false;

  if (primaryKeys.length === 0) {
    baseData.forEach((row) => {
      baseMap[String(row._index)] = row;
    });
    currentData.forEach((row) => {
      currentMap[String(row._index)] = row;
    });
  } else {
    // Validate and build base map
    const basePKKeys = validatePrimaryKeys(base.columns, primaryKeys);
    baseData.forEach((row) => {
      const key = getPrimaryKeyValue(base.columns, basePKKeys, row);
      if (key in baseMap) {
        invalidPKeyBase = true;
      }
      baseMap[key] = row;
    });

    // Validate and build current map
    const currentPKKeys = validatePrimaryKeys(current.columns, primaryKeys);
    currentData.forEach((row) => {
      const key = getPrimaryKeyValue(current.columns, currentPKKeys, row);
      if (key in currentMap) {
        invalidPKeyCurrent = true;
      }
      currentMap[key] = row;
    });
  }

  const { rows, rowStats } = buildDiffRows({
    baseMap,
    currentMap,
    baseColumns: base.columns,
    currentColumns: current.columns,
    columnMap,
    primaryKeys,
    changedOnly,
  });

  // Get column configurations (pure data)
  const columnConfigs = getDisplayColumns({
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
    changedOnly,
    rowStats,
    excludeColumns: ["index"],
    strictMode: false, // querydiff is lenient with missing columns
  });

  // Build column definitions with React components
  const { columns } = buildDiffColumnDefinitions({
    columns: columnConfigs,
    displayMode,
    allowIndexFallback: true,
    baseTitle: options?.baseTitle,
    currentTitle: options?.currentTitle,
    headerProps: {
      primaryKeys,
      pinnedColumns,
      onPrimaryKeyChange: options?.onPrimaryKeyChange,
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
    invalidPKeyBase,
    invalidPKeyCurrent,
  };
}
