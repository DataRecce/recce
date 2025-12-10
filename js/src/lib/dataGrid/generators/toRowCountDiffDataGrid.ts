/**
 * @file toRowCountDiffDataGrid.ts
 * @description Grid generator for Row Count Diff view
 *
 * Generates columns and rows for displaying row count comparisons
 * between base and current environments across multiple models.
 */

import { ColumnOrColumnGroup } from "react-data-grid";
import { RowCountDiffResult } from "@/lib/api/rowcount";
import { RowObjectType } from "@/lib/api/types";
import { dataFrameToRowObjects } from "@/utils/transforms";
import {
  getRowCountDiffStatus,
  rowCountDiffResultToDataFrame,
} from "./rowCountUtils";

// ============================================================================
// Types
// ============================================================================

export interface RowCountDiffDataGridResult {
  columns: ColumnOrColumnGroup<RowObjectType>[];
  rows: RowObjectType[];
}

// ============================================================================
// Cell Class Function
// ============================================================================

/**
 * Creates a cell class function for row count diff cells
 *
 * Returns appropriate diff-cell-* class based on row status
 */
function createRowCountDiffCellClass(): (
  row: RowObjectType,
) => string | undefined {
  return (row: RowObjectType) => {
    const base = row.base as number | string | null;
    const current = row.current as number | string | null;

    // Handle "N/A" string values
    const baseValue = base === "N/A" ? null : base;
    const currentValue = current === "N/A" ? null : current;

    // Both null or equal - no styling
    if (baseValue === currentValue) {
      return undefined;
    }

    // Current increased or newly added
    if (
      baseValue === null ||
      (typeof baseValue === "number" &&
        typeof currentValue === "number" &&
        baseValue < currentValue)
    ) {
      return "diff-cell-added";
    }

    // Current decreased or removed
    if (
      currentValue === null ||
      (typeof baseValue === "number" &&
        typeof currentValue === "number" &&
        baseValue > currentValue)
    ) {
      return "diff-cell-removed";
    }

    return undefined;
  };
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates grid data for Row Count Diff view
 *
 * @param result - The RowCountDiffResult from the backend
 * @returns Grid columns and rows ready for ScreenshotDataGrid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toRowCountDiffDataGrid(run.result);
 * return <ScreenshotDataGrid columns={columns} rows={rows} />;
 * ```
 */
export function toRowCountDiffDataGrid(
  result: RowCountDiffResult,
): RowCountDiffDataGridResult {
  // Convert to DataFrame format
  const dataFrame = rowCountDiffResultToDataFrame(result);

  // Convert DataFrame to row objects
  const rawRows = dataFrameToRowObjects(dataFrame);

  // Add __status to each row based on base/current comparison
  const rows: RowObjectType[] = rawRows.map((row) => {
    const base = row.base as number | null;
    const current = row.current as number | null;

    return {
      ...row,
      // Display "N/A" for null values
      base: base ?? "N/A",
      current: current ?? "N/A",
      __status: getRowCountDiffStatus(
        typeof base === "number" ? base : null,
        typeof current === "number" ? current : null,
      ),
    };
  });

  // Create cell class function
  const cellClass = createRowCountDiffCellClass();

  // Build columns
  const columns: ColumnOrColumnGroup<RowObjectType>[] = [
    {
      key: "name",
      name: "Name",
      resizable: true,
      cellClass,
    },
    {
      key: "base",
      name: "Base Rows",
      resizable: true,
      cellClass,
    },
    {
      key: "current",
      name: "Current Rows",
      resizable: true,
      cellClass,
    },
    {
      key: "delta",
      name: "Delta",
      resizable: true,
      cellClass,
    },
  ];

  return { columns, rows };
}
