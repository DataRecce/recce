/**
 * @file toValueDiffGrid.ts
 * @description Value diff grid generation for joined data (with in_a/in_b columns)
 *
 * REFACTORED: Uses shared utilities from @/lib/dataGrid/shared
 *
 * NOTE: Backend guarantees:
 * - in_a/in_b columns are always lowercase
 * - primary_keys match actual column casing
 * Therefore, exact string matching is used everywhere.
 */

import "src/components/query/styles.css";
import { type DataFrame, type RowObjectType } from "@datarecce/ui/api";
import { QueryDataDiffGridOptions } from "@/lib/dataGrid/generators/toDataDiffGrid";
import {
  buildDiffColumnDefinitions,
  buildDiffRows,
  buildJoinedColumnMap,
  getDisplayColumns,
  getPrimaryKeyValue,
  validatePrimaryKeys,
  validateToValueDiffGridInputs,
} from "@/lib/dataGrid/shared";
import { dataFrameToRowObjects } from "@/utils/transforms";

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toValueDiffGrid(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
) {
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

  // Build column definitions with JSX
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
  });

  return {
    columns,
    rows,
  };
}
