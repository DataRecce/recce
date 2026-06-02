// js/packages/ui/src/utils/grid/buildSelectedRowsTSV.ts
import type { GridApi } from "ag-grid-community";
import { toTSV } from "../csv/format";

/** colId AG Grid assigns to the auto-generated row-selection checkbox column. */
const SELECTION_COLUMN_ID = "ag-Grid-SelectionColumn";

/**
 * Serialize the grid's currently selected rows to a TSV string (header row +
 * one row per selected node), suitable for pasting into a spreadsheet.
 *
 * Returns null when there is no selection or no data columns. Works for both
 * plain query grids and diff grids — values come from `getCellValue` with the
 * column's formatter applied, so no per-shape logic is needed. The auto-added
 * selection checkbox column is excluded.
 */
export function buildSelectedRowsTSV(api: GridApi): string | null {
  const nodes = api.getSelectedNodes();
  if (nodes.length === 0) return null;

  const columns = api
    .getAllDisplayedColumns()
    .filter((col) => col.getColId() !== SELECTION_COLUMN_ID);
  if (columns.length === 0) return null;

  const headers = columns.map((col) => {
    const def = col.getColDef();
    return String(def.headerName ?? def.field ?? col.getColId());
  });

  const rows = nodes.map((node) =>
    columns.map(
      (col) =>
        api.getCellValue({ rowNode: node, colKey: col, useFormatter: true }) ??
        "",
    ),
  );

  return toTSV(headers, rows);
}
