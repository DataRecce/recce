/**
 * @file toDataGrid.tsx
 * @description Simple data grid generation for single DataFrame display
 *
 * Unlike toDataDiffGrid and toValueDiffGrid, this handles non-diff scenarios
 * where we just display a single DataFrame without base/current comparison.
 *
 * REFACTORED: Now uses shared utilities from @/lib/dataGrid/shared
 */

import { type ColumnRenderMode, type DataFrame } from "@datarecce/ui/api";
import { dataFrameToRowObjects } from "@datarecce/ui/utils";
import {
  buildColumnMap,
  buildSimpleColumnDefinitions,
  getSimpleDisplayColumns,
  validateToDataGridInputs,
} from "@/lib/dataGrid/shared";

// ============================================================================
// Types
// ============================================================================

export interface QueryDataGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toDataGrid(result: DataFrame, options: QueryDataGridOptions) {
  validateToDataGridInputs(result, options);

  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];
  const columnsRenderMode = options.columnsRenderMode ?? {};

  // REFACTORED: Use shared utility for column map
  const columnMap = buildColumnMap(result);

  // REFACTORED: Use shared utility for column configuration
  const columnConfigs = getSimpleDisplayColumns({
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
  });

  // REFACTORED: Use shared utility for column definitions with JSX
  const { columns } = buildSimpleColumnDefinitions({
    columns: columnConfigs,
    headerProps: {
      pinnedColumns,
      onPinnedColumnsChange: options.onPinnedColumnsChange,
      onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
    },
    allowIndexFallback: true,
  });

  return { columns, rows: dataFrameToRowObjects(result) };
}
