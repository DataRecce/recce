/**
 * @file toRowCountDiffDataGrid.ts
 * @description Grid generator for Row Count Diff view
 *
 * Generates columns and rows for displaying row count comparisons
 * between base and current environments across multiple models.
 */

import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import type { RowCountDiffResult, RowObjectType } from "../../../api";
import { dataFrameToRowObjects } from "../../transforms";
import {
  getRowCountDiffStatus,
  rowCountDiffResultToDataFrame,
} from "../rowCountUtils";

// ============================================================================
// Types
// ============================================================================

export interface RowCountDiffDataGridResult {
  columns: (ColDef<RowObjectType> | ColGroupDef<RowObjectType>)[];
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
  params: CellClassParams<RowObjectType>,
) => string | undefined {
  return (params: CellClassParams<RowObjectType>) => {
    const row = params.data;
    if (!row) return undefined;

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
 * @returns Grid columns and rows ready for RecceDataGrid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toRowCountDiffDataGrid(run.result);
 * return <RecceDataGrid columnDefs={columns} rowData={rows} />;
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
  const columns: ColDef<RowObjectType>[] = [
    {
      field: "name",
      headerName: "Name",
      resizable: true,
      cellClass,
    },
    {
      field: "base",
      headerName: "Base Rows",
      resizable: true,
      cellClass,
    },
    {
      field: "current",
      headerName: "Current Rows",
      resizable: true,
      cellClass,
    },
    {
      field: "delta",
      headerName: "Delta",
      resizable: true,
      cellClass,
    },
  ];

  return { columns, rows };
}
