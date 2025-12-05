/**
 * @file inlineRenderCell.tsx
 * @description Inline diff cell renderer for DataGrid columns
 *
 * Renders base and current values side-by-side when they differ,
 * or a single value when unchanged. Used for inline diff display mode.
 */

import { Flex, Text } from "@chakra-ui/react";
import { CalculatedColumn, RenderCellProps } from "react-data-grid";
import { DiffText } from "@/components/query/DiffText";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import { toRenderedValue } from "@/lib/dataGrid/shared";

/**
 * Extended column type with optional type metadata
 */
type ColumnWithMetadata = CalculatedColumn<RowObjectType> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
};

/**
 * Inline diff cell renderer for comparing base and current values
 *
 * @description Renders cell values in inline diff mode:
 * - If base and current values are equal, shows single value
 * - If values differ, shows both with red (base/removed) and green (current/added) styling
 * - Handles missing values gracefully
 *
 * The component uses DiffText for styled diff display with copy functionality.
 *
 * @param props - React Data Grid render cell props containing row and column data
 * @returns Rendered cell content showing diff or single value
 *
 * @example
 * // Used in column definition for inline diff mode
 * const column = {
 *   key: 'price',
 *   name: 'Price',
 *   renderCell: inlineRenderCell,
 *   columnType: 'number',
 *   columnRenderMode: 'raw'
 * };
 */
export const inlineRenderCell = ({
  row,
  column,
}: RenderCellProps<RowObjectType>) => {
  const { columnType, columnRenderMode } =
    column as unknown as ColumnWithMetadata;

  const baseKey = `base__${column.key}`.toLowerCase();
  const currentKey = `current__${column.key}`.toLowerCase();

  // Handle case where neither base nor current values exist
  if (!Object.hasOwn(row, baseKey) && !Object.hasOwn(row, currentKey)) {
    return "-";
  }

  const hasBase = Object.hasOwn(row, baseKey);
  const hasCurrent = Object.hasOwn(row, currentKey);

  const [baseValue, baseGrayOut] = toRenderedValue(
    row,
    `base__${column.key}`.toLowerCase(),
    columnType,
    columnRenderMode,
  );

  const [currentValue, currentGrayOut] = toRenderedValue(
    row,
    `current__${column.key}`.toLowerCase(),
    columnType,
    columnRenderMode,
  );

  // No change - render single value
  if (row[baseKey] === row[currentKey]) {
    return (
      <Text style={{ color: currentGrayOut ? "gray" : "inherit" }}>
        {currentValue}
      </Text>
    );
  }

  // Values differ - render inline diff with base (red) and current (green)
  return (
    <Flex gap="5px" alignItems="center" lineHeight="normal" height="100%">
      {hasBase && (
        <DiffText value={baseValue} colorPalette="red" grayOut={baseGrayOut} />
      )}
      {hasCurrent && (
        <DiffText
          value={currentValue}
          colorPalette="green"
          grayOut={currentGrayOut}
        />
      )}
    </Flex>
  );
};
