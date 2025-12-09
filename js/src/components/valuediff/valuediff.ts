/**
 * @file valuediff.ts
 * @description Value diff grid generation for joined data (with IN_A/IN_B columns)
 *
 * REFACTORED: Now uses shared utilities from @/lib/dataGrid/shared
 */

import "../query/styles.css";
import { QueryDataDiffGridOptions } from "src/components/query/querydiff";
import { DataFrame, RowObjectType } from "@/lib/api/types";
import {
  buildDiffColumnDefinitions,
  buildDiffRows,
  buildJoinedColumnMap,
  getDisplayColumns,
  getPrimaryKeyValue,
  validatePrimaryKeys,
  validateToValueDiffGridInputs,
} from "@/lib/dataGrid/shared";
import { dataFrameToRowObjects, getCaseInsensitive } from "@/utils/transforms";

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toValueDiffGrid(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
) {
  // Add validation at entry point
  validateToValueDiffGridInputs(df, primaryKeys);
  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "inline";
  const columnsRenderMode = options?.columnsRenderMode ?? {};
  const transformedData = dataFrameToRowObjects(df);

  // REFACTORED: Use shared utility for column map
  const columnMap = buildJoinedColumnMap(df);

  // Build row maps based on IN_A/IN_B columns
  const baseMap: Record<string, RowObjectType | undefined> = {};
  const currentMap: Record<string, RowObjectType | undefined> = {};

  // REFACTORED: Use shared utility for PK validation
  const primaryKeyKeys = validatePrimaryKeys(df.columns, primaryKeys, true);
  const inBaseIndex = columnMap.IN_A.key;
  const inCurrentIndex = columnMap.IN_B.key;

  transformedData.forEach((row) => {
    // REFACTORED: Use shared utility for PK value generation
    const key = getPrimaryKeyValue(df.columns, primaryKeyKeys, row, true);

    if (getCaseInsensitive(row, inBaseIndex)) {
      baseMap[key.toLowerCase()] = row;
    }

    if (getCaseInsensitive(row, inCurrentIndex)) {
      currentMap[key.toLowerCase()] = row;
    }
  });

  const { rows, rowStats } = buildDiffRows({
    baseMap,
    currentMap,
    baseColumns: df.columns,
    currentColumns: df.columns, // Same columns for joined data
    columnMap,
    primaryKeys,
    caseInsensitive: true, // valuediff uses case-insensitive
    changedOnly,
  });

  // REFACTORED: Use getDisplayColumns for column selection
  const columnConfigs = getDisplayColumns({
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
    changedOnly,
    rowStats,
    excludeColumns: ["IN_A", "IN_B", "in_a", "in_b"],
    caseInsensitive: true,
    strictMode: true, // valuediff requires columns to exist
  });

  // REFACTORED: Use buildDiffColumnDefinitions for JSX generation
  const { columns } = buildDiffColumnDefinitions({
    columns: columnConfigs,
    displayMode,
    allowIndexFallback: false, // valuediff requires PKs
    baseTitle: options?.baseTitle,
    currentTitle: options?.currentTitle,
    headerProps: {
      primaryKeys: primaryKeys.map((k) => k.toLowerCase()),
      pinnedColumns,
      onPinnedColumnsChange: options?.onPinnedColumnsChange,
      onColumnsRenderModeChanged: options?.onColumnsRenderModeChanged,
      caseInsensitive: true,
    },
  });

  return {
    columns,
    rows,
  };
}
