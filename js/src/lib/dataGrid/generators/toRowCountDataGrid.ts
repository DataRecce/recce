/**
 * @file toRowCountDataGrid.ts
 * @description Grid generator for Row Count view (single environment)
 *
 * Generates columns and rows for displaying row counts
 * in a single environment context.
 */

import { ColumnOrColumnGroup } from "react-data-grid";
import { RowCountResult } from "@/lib/api/rowcount";
import { RowObjectType } from "@/lib/api/types";
import { dataFrameToRowObjects } from "@/utils/transforms";
import { rowCountResultToDataFrame } from "./rowCountUtils";

// ============================================================================
// Types
// ============================================================================

export interface RowCountDataGridResult {
  columns: ColumnOrColumnGroup<RowObjectType>[];
  rows: RowObjectType[];
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates grid data for Row Count view (single environment)
 *
 * @param result - The RowCountResult from the backend
 * @returns Grid columns and rows ready for ScreenshotDataGrid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toRowCountDataGrid(run.result);
 * return <ScreenshotDataGrid columns={columns} rows={rows} />;
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
  const columns: ColumnOrColumnGroup<RowObjectType>[] = [
    {
      key: "name",
      name: "Name",
      resizable: true,
    },
    {
      key: "current",
      name: "Row Count",
      resizable: true,
    },
  ];

  return { columns, rows };
}
