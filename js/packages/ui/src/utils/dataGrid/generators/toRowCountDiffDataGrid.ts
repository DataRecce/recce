/**
 * @file toRowCountDiffDataGrid.ts
 * @description Grid generator for Row Count Diff view
 *
 * Generates columns and rows for displaying row count comparisons
 * between base and current environments across multiple models.
 */

import type {
  CellClassParams,
  ColDef,
  ColGroupDef,
  ValueFormatterParams,
} from "ag-grid-community";
import type { RowCountDiffResult, RowObjectType } from "../../../api";
import { dataFrameToRowObjects } from "../../transforms";
import {
  getRowCountChangeDirection,
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
 * Creates a cell class function for the row count Delta cell.
 *
 * Directional classes are deliberately row-count-specific: the generic
 * diff-cell-added/removed classes describe structural diffs and use the
 * app-wide green/red palette.
 */
function createRowCountDeltaCellClass(): (
  params: CellClassParams<RowObjectType>,
) => string | undefined {
  return (params: CellClassParams<RowObjectType>) => {
    const row = params.data;
    if (!row) return undefined;

    const base = typeof row.base === "number" ? row.base : null;
    const current = typeof row.current === "number" ? row.current : null;
    const direction = getRowCountChangeDirection(base, current);

    switch (direction) {
      case "increase":
        return "row-count-delta-increase";
      case "decrease":
        return "row-count-delta-decrease";
      case "unchanged":
        return "row-count-delta-unchanged";
      case "added":
      case "removed":
      case "unavailable":
        return "row-count-delta-structural";
    }
  };
}

function formatRowCountDelta(
  params: ValueFormatterParams<RowObjectType>,
): string {
  const row = params.data;
  if (!row) return String(params.value ?? "");

  const base = typeof row.base === "number" ? row.base : null;
  const current = typeof row.current === "number" ? row.current : null;
  const direction = getRowCountChangeDirection(base, current);
  const value = String(params.value ?? "");

  switch (direction) {
    case "increase":
      return `↑ ${value}`;
    case "decrease":
      return `↓ ${value}`;
    case "unchanged":
      return "= 0%";
    case "added":
      return "Added";
    case "removed":
      return "Removed";
    case "unavailable":
      return "N/A";
  }
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

  // Build columns
  const columns: ColDef<RowObjectType>[] = [
    {
      field: "name",
      headerName: "Name",
      resizable: true,
    },
    {
      field: "base",
      headerName: "Base Rows",
      resizable: true,
    },
    {
      field: "current",
      headerName: "Current Rows",
      resizable: true,
    },
    {
      field: "delta",
      headerName: "Delta",
      resizable: true,
      cellClass: createRowCountDeltaCellClass(),
      valueFormatter: formatRowCountDelta,
    },
  ];

  return { columns, rows };
}
