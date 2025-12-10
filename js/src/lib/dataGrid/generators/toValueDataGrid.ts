/**
 * @file toValueDataGrid.ts
 * @description Grid generator for Value Diff summary view
 *
 * Generates columns and rows for displaying column-level match statistics
 * from a value_diff run. This shows a summary table where each row
 * represents a column's match count and percentage.
 *
 * NOTE: This is different from toValueDiffGrid which handles row-level diffs.
 * This generator is for the summary view showing column match statistics.
 *
 * This file is intentionally .ts (not .tsx) - all JSX rendering is delegated
 * to valueDiffCells.tsx via render functions.
 */

import { ColumnOrColumnGroup } from "react-data-grid";
import {
  createColumnNameRenderer,
  createPrimaryKeyIndicatorRenderer,
  renderMatchedPercentCell,
} from "@/components/ui/dataGrid/valueDiffCells";
import { DataFrame, RowObjectType } from "@/lib/api/types";
import { ValueDiffParams, ValueDiffResult } from "@/lib/api/valuediff";
import { dataFrameToRowObjects } from "@/utils/transforms";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for generating the value data grid
 */
export interface ValueDataGridOptions {
  /** Parameters from the value_diff run */
  params: ValueDiffParams;
}

/**
 * Result structure for the value data grid
 */
export interface ValueDataGridResult {
  columns: ColumnOrColumnGroup<RowObjectType>[];
  rows: RowObjectType[];
}

// ============================================================================
// Column Schema Definition
// ============================================================================

/**
 * Schema definition for the value diff summary DataFrame
 *
 * This defines the expected structure of the data from the backend.
 * Using explicit schema avoids the "basicColumns" type fix pattern.
 */
const VALUE_DIFF_SUMMARY_SCHEMA: DataFrame["columns"] = [
  { key: "0", name: "Column", type: "text" },
  { key: "1", name: "Matched", type: "number" },
  { key: "2", name: "Matched %", type: "number" },
];

// ============================================================================
// Cell Class Functions
// ============================================================================

/**
 * Cell class function for matched columns
 * Applies "diff-cell-modified" class when match percentage is less than 100%
 */
function getMatchedCellClass(row: RowObjectType): string | undefined {
  const value = row["2"] as unknown as number | undefined;
  return value != null && value < 1 ? "diff-cell-modified" : undefined;
}

// ============================================================================
// Column Definitions
// ============================================================================

/**
 * Column keys used in the value diff summary grid
 */
const COLUMN_KEYS = {
  PRIMARY_KEY_INDICATOR: "__is_pk__",
  COLUMN_NAME: "0",
  MATCHED_COUNT: "1",
  MATCHED_PERCENT: "2",
} as const;

/**
 * Creates column definitions for the value diff summary grid
 *
 * @param primaryKeys - Array of primary key column names
 * @param params - ValueDiffParams from the run
 * @returns Array of column definitions
 */
function createColumnDefinitions(
  primaryKeys: string[],
  params: ValueDiffParams,
): ColumnOrColumnGroup<RowObjectType>[] {
  return [
    // Primary key indicator column
    {
      key: COLUMN_KEYS.PRIMARY_KEY_INDICATOR,
      name: "",
      width: 30,
      maxWidth: 30,
      renderCell: createPrimaryKeyIndicatorRenderer(primaryKeys),
    },
    // Column name column with context menu
    {
      key: COLUMN_KEYS.COLUMN_NAME,
      name: "Column",
      resizable: true,
      renderCell: createColumnNameRenderer(params),
      cellClass: "cell-show-context-menu",
    },
    // Matched count column
    {
      key: COLUMN_KEYS.MATCHED_COUNT,
      name: "Matched",
      resizable: true,
      cellClass: getMatchedCellClass,
    },
    // Matched percentage column
    {
      key: COLUMN_KEYS.MATCHED_PERCENT,
      name: "Matched %",
      resizable: true,
      renderCell: renderMatchedPercentCell,
      cellClass: getMatchedCellClass,
    },
  ];
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates grid configuration for value diff summary view
 *
 * @description Creates columns and rows for displaying column-level match
 * statistics. Each row represents a column from the compared data with
 * its match count and percentage.
 *
 * @param result - The value diff result containing summary data
 * @param options - Configuration options including params
 * @returns Grid columns and rows ready for ScreenshotDataGrid
 *
 * @example
 * const { columns, rows } = toValueDataGrid(result, {
 *   params: run.params,
 * });
 */
export function toValueDataGrid(
  result: ValueDiffResult,
  options: ValueDataGridOptions,
): ValueDataGridResult {
  const { params } = options;

  // Extract primary keys as array
  const primaryKeys = Array.isArray(params.primary_key)
    ? params.primary_key
    : [params.primary_key];

  // Apply schema to DataFrame for proper type handling
  // This ensures dataFrameToRowObjects has type information available
  const dataFrameWithSchema: DataFrame = {
    ...result.data,
    columns: VALUE_DIFF_SUMMARY_SCHEMA,
  };

  // Build columns using render functions from valueDiffCells
  const columns = createColumnDefinitions(primaryKeys, params);

  // Convert DataFrame to row objects
  const rows = dataFrameToRowObjects(dataFrameWithSchema);

  return { columns, rows };
}
