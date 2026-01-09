/**
 * @file toRowCountDataGrid.ts
 * @description Grid generator for Row Count view (single environment)
 *
 * Generates columns and rows for displaying row counts
 * in a single environment context.
 */

import type { ColDef, ColGroupDef } from "ag-grid-community";
import type { RowCountResult, RowObjectType } from "../../../api";
import { dataFrameToRowObjects } from "../../transforms";
import { rowCountResultToDataFrame } from "../rowCountUtils";

// ============================================================================
// Types
// ============================================================================

export interface RowCountDataGridResult {
  columns: (ColDef<RowObjectType> | ColGroupDef<RowObjectType>)[];
  rows: RowObjectType[];
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates grid data for Row Count view (single environment)
 *
 * @param result - The RowCountResult from the backend
 * @returns Grid columns and rows ready for RecceDataGrid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toRowCountDataGrid(run.result);
 * return <RecceDataGrid columnDefs={columns} rowData={rows} />;
 * ```
 */
export function toRowCountDataGrid(
  result: RowCountResult,
): RowCountDataGridResult {
  // Convert to DataFrame format
  const dataFrame = rowCountResultToDataFrame(result);

  // Convert DataFrame to row objects
  const rawRows = dataFrameToRowObjects(dataFrame);

  // Transform rows (display "N/A" for null values)
  const rows: RowObjectType[] = rawRows.map((row) => ({
    ...row,
    current: row.current ?? "N/A",
    __status: undefined,
  }));

  // Build columns (simple, no diff styling)
  const columns: ColDef<RowObjectType>[] = [
    {
      field: "name",
      headerName: "Name",
      resizable: true,
    },
    {
      field: "current",
      headerName: "Row Count",
      resizable: true,
    },
  ];

  return { columns, rows };
}
