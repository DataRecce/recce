/**
 * @file defaultRenderCell.tsx
 * @description Default cell renderer for DataGrid columns
 *
 * Renders a cell value with optional column type formatting and gray-out styling.
 * Used for standard (non-diff) cell rendering in data grids.
 */

import Typography from "@mui/material/Typography";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { ColumnRenderMode, ColumnType, RowObjectType } from "../../../api";
import { toRenderedValue } from "../../../utils/dataGrid/gridUtils";

/**
 * Custom context data for Recce columns
 * Stored in colDef.context to avoid AG Grid validation warnings
 */
export interface RecceColumnContext {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

/**
 * Extended column definition with context metadata
 * Uses context property for custom data per AG Grid best practices
 */
export type ColDefWithMetadata<TData = RowObjectType> = ColDef<TData> & {
  context?: RecceColumnContext;
};

/**
 * Default cell renderer for data grid columns
 *
 * @description Extracts cell value from the row and renders it with appropriate
 * formatting based on the column type and render mode. Supports numeric
 * formatting (raw, integer, percent) and handles null/empty values with gray styling.
 *
 * @param params - AG Grid cell renderer params containing row data and column definition
 * @returns Rendered cell content as a Typography component
 *
 * @example
 * ```tsx
 * const colDef: ColDefWithMetadata = {
 *   field: 'price',
 *   cellRenderer: defaultRenderCell,
 *   context: {
 *     columnType: 'number',
 *     columnRenderMode: 2, // 2 decimal places
 *   },
 * };
 * ```
 */
export const defaultRenderCell = (
  params: ICellRendererParams<RowObjectType>,
) => {
  const colDef = params.colDef as ColDefWithMetadata;
  const columnType = colDef?.context?.columnType;
  const columnRenderMode = colDef?.context?.columnRenderMode;
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
