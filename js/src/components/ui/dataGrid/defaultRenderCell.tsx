/**
 * @file defaultRenderCell.tsx
 * @description Default cell renderer for DataGrid columns
 *
 * Renders a cell value with optional column type formatting and gray-out styling.
 * Used for standard (non-diff) cell rendering in data grids.
 *
 * NOTE: Imports directly from gridUtils.ts to avoid circular dependency
 * with toDiffColumn.tsx which imports this component.
 */

import Typography from "@mui/material/Typography";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
// Import directly from gridUtils to avoid circular dependency
import { toRenderedValue } from "@/lib/dataGrid/shared/gridUtils";

/**
 * Extended column definition with optional type metadata
 */
export type ColDefWithMetadata<TData = RowObjectType> = ColDef<TData> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
};

/**
 * Default cell renderer for data grid columns
 *
 * @description Extracts cell value from the row and renders it with appropriate
 * formatting based on the column type and render mode. Supports numeric
 * formatting (raw, integer, percent) and handles null/empty values with gray styling.
 *
 * @param params - AG Grid cell renderer params containing row data and column definition
 * @returns Rendered cell content as a Text component
 */
export const defaultRenderCell = (
  params: ICellRendererParams<RowObjectType>,
) => {
  const colDef = params.colDef as ColDefWithMetadata;
  const columnType = colDef?.columnType;
  const columnRenderMode = colDef?.columnRenderMode;
  const fieldName = colDef?.field ?? "";

  if (!params.data) {
    return null;
  }

  const [renderedValue, grayOut] = toRenderedValue(
    params.data,
    fieldName,
    columnType,
    columnRenderMode,
  );

  return (
    <Typography
      component="span"
      style={{ color: grayOut ? "gray" : "inherit" }}
    >
      {renderedValue}
    </Typography>
  );
};
