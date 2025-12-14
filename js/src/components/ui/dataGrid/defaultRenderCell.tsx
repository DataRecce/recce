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

import { CalculatedColumn, RenderCellProps } from "react-data-grid";
import { Text } from "@/components/ui/mui";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
// Import directly from gridUtils to avoid circular dependency
import { toRenderedValue } from "@/lib/dataGrid/shared/gridUtils";

/**
 * Extended column type with optional type metadata
 */
type ColumnWithMetadata = CalculatedColumn<RowObjectType> & {
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
 * @param props - React Data Grid render cell props containing row and column data
 * @returns Rendered cell content as a Text component
 */
export const defaultRenderCell = ({
  row,
  column,
}: RenderCellProps<RowObjectType>) => {
  const { columnType, columnRenderMode } =
    column as unknown as ColumnWithMetadata;

  const [renderedValue, grayOut] = toRenderedValue(
    row,
    column.key,
    columnType,
    columnRenderMode,
  );

  return (
    <Text style={{ color: grayOut ? "gray" : "inherit" }}>{renderedValue}</Text>
  );
};
