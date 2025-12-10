/**
 * @file toDataDiffGrid.ts
 * @description Query diff grid generation and rendering components
 *
 * REFACTORED: Now uses shared utilities from @/lib/dataGrid/shared
 */

import "src/components/query/styles.css";
import { ColumnRenderMode, DataFrame, RowObjectType } from "@/lib/api/types";
import {
  buildDiffColumnDefinitions,
  buildDiffRows,
  buildMergedColumnMap,
  getDisplayColumns,
  getPrimaryKeyValue,
  validatePrimaryKeys,
  validateToDataDiffGridInputs,
} from "@/lib/dataGrid/shared";
import { dataFrameToRowObjects } from "@/utils/transforms";

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toDataDiffGrid(
  _base?: DataFrame,
  _current?: DataFrame,
  options?: QueryDataDiffGridOptions,
) {
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

  // REFACTORED: Use shared utility
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
    // REFACTORED: Use shared utility
    const basePKKeys = validatePrimaryKeys(base.columns, primaryKeys);
    baseData.forEach((row) => {
      const key = getPrimaryKeyValue(base.columns, basePKKeys, row);
      if (key in baseMap) {
        invalidPKeyBase = true;
      }
      baseMap[key] = row;
    });

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
    caseInsensitive: false,
    strictMode: false, // querydiff is lenient with missing columns
  });

  // Build column definitions with JSX
  const { columns } = buildDiffColumnDefinitions({
    columns: columnConfigs,
    displayMode,
    allowIndexFallback: true, // querydiff adds _index when no PKs
    baseTitle: options?.baseTitle,
    currentTitle: options?.currentTitle,
    headerProps: {
      primaryKeys,
      pinnedColumns,
      onPrimaryKeyChange: options?.onPrimaryKeyChange,
      onPinnedColumnsChange: options?.onPinnedColumnsChange,
      onColumnsRenderModeChanged: options?.onColumnsRenderModeChanged,
      caseInsensitive: false,
    },
  });

  return {
    columns,
    rows,
    invalidPKeyBase,
    invalidPKeyCurrent,
  };
}
