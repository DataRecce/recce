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
 */

import { ColumnOrColumnGroup } from "react-data-grid";
// Import directly from file, not barrel, to avoid pulling in heavy hook dependencies
// that would break tests (toaster.tsx chain through RecceActionContext)
import {
  MatchedPercentCell,
  PrimaryKeyIndicatorCell,
  ValueDiffColumnNameCell,
  type ValueDiffColumnNameCellProps,
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
  /** Callback props for the column name cell context menu */
  columnNameCellProps?: Omit<ValueDiffColumnNameCellProps, "column" | "params">;
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
 * Creates cell class function for matched percentage column
 * Applies "diff-cell-modified" class when value is less than 100%
 */
function createMatchedPercentCellClass(row: RowObjectType): string | undefined {
  const value = row["2"] as unknown as number | undefined;
  return value != null && value < 1 ? "diff-cell-modified" : undefined;
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
 * @param options - Configuration options including params and callbacks
 * @returns Grid columns and rows ready for ScreenshotDataGrid
 *
 * @example
 * const { columns, rows } = toValueDataGrid(result, {
 *   params: run.params,
 *   columnNameCellProps: {
 *     onValueDiffDetail: handleValueDiffDetail,
 *   },
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

  // Build columns
  const columns: ColumnOrColumnGroup<RowObjectType>[] = [
    createPrimaryKeyIndicatorColumn(primaryKeys),
    createColumnNameColumn(params),
    createMatchedCountColumn(),
    createMatchedPercentColumn(),
  ];

  // Convert DataFrame to row objects
  const rows = dataFrameToRowObjects(dataFrameWithSchema);

  return { columns, rows };
}

// ============================================================================
// Column Factory Functions
// ============================================================================

/**
 * Creates the primary key indicator column
 */
function createPrimaryKeyIndicatorColumn(
  primaryKeys: string[],
): ColumnOrColumnGroup<RowObjectType> {
  return {
    key: "__is_pk__",
    name: "",
    width: 30,
    maxWidth: 30,
    renderCell: ({ row }) => (
      <PrimaryKeyIndicatorCell
        columnName={String(row["0"])}
        primaryKeys={primaryKeys}
      />
    ),
  };
}

/**
 * Creates the column name column with context menu
 */
function createColumnNameColumn(
  params: ValueDiffParams,
): ColumnOrColumnGroup<RowObjectType> {
  return {
    key: "0",
    name: "Column",
    resizable: true,
    renderCell: ({ row, column }) => (
      <ValueDiffColumnNameCell
        column={String(row[column.key])}
        params={params}
      />
    ),
    cellClass: "cell-show-context-menu",
  };
}

/**
 * Creates the matched count column
 */
function createMatchedCountColumn(): ColumnOrColumnGroup<RowObjectType> {
  return {
    key: "1",
    name: "Matched",
    resizable: true,
    cellClass: createMatchedPercentCellClass,
  };
}

/**
 * Creates the matched percentage column
 */
function createMatchedPercentColumn(): ColumnOrColumnGroup<RowObjectType> {
  return {
    key: "2",
    name: "Matched %",
    resizable: true,
    renderCell: ({ column, row }) => (
      <MatchedPercentCell value={row[column.key] as unknown as number} />
    ),
    cellClass: createMatchedPercentCellClass,
  };
}
