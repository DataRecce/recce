/**
 * @file inlineRenderCell.tsx
 * @description Inline diff cell renderer for DataGrid columns
 *
 * Renders base and current values side-by-side when they differ,
 * or a single value when unchanged. Used for inline diff display mode.
 *
 * NOTE: Imports directly from gridUtils.ts to avoid circular dependency
 * with toDiffColumn.tsx which imports this component.
 */

import {
  type ColumnRenderMode,
  type ColumnType,
  type RowDataTypes,
  type RowObjectType,
} from "@datarecce/ui/api";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { DiffText } from "@/components/query/DiffText";
// Import directly from gridUtils to avoid circular dependency
import {
  formatSmartDecimal,
  toRenderedValue,
} from "@/lib/dataGrid/shared/gridUtils";

/**
 * Custom context data for Recce columns
 * Stored in colDef.context to avoid AG Grid validation warnings
 */
interface RecceColumnContext {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

/**
 * Extended column definition with context metadata
 * Uses context property for custom data per AG Grid best practices
 */
type ColDefWithMetadata = ColDef<RowObjectType> & {
  context?: RecceColumnContext;
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
 * @param params - AG Grid cell renderer params containing row data and column definition
 * @returns Rendered cell content showing diff or single value
 */
export const inlineRenderCell = (
  params: ICellRendererParams<RowObjectType>,
) => {
  const colDef = params.colDef as ColDefWithMetadata;
  const columnType = colDef?.context?.columnType;
  const columnRenderMode = colDef?.context?.columnRenderMode;
  const columnKey = colDef?.field ?? "";

  if (!params.data) {
    return null;
  }

  const row = params.data;
  const baseKey = `base__${columnKey}`.toLowerCase();
  const currentKey = `current__${columnKey}`.toLowerCase();

  // Handle case where neither base nor current values exist
  if (!Object.hasOwn(row, baseKey) && !Object.hasOwn(row, currentKey)) {
    return "-";
  }

  const hasBase = Object.hasOwn(row, baseKey);
  const hasCurrent = Object.hasOwn(row, currentKey);

  const [baseValue, baseGrayOut] = toRenderedValue(
    row,
    `base__${columnKey}`.toLowerCase(),
    columnType,
    columnRenderMode,
  );

  const [currentValue, currentGrayOut] = toRenderedValue(
    row,
    `current__${columnKey}`.toLowerCase(),
    columnType,
    columnRenderMode,
  );

  // No change - render single value
  if (row[baseKey] === row[currentKey]) {
    return (
      <Typography
        component="span"
        style={{ color: currentGrayOut ? "gray" : "inherit" }}
      >
        {currentValue}
      </Typography>
    );
  }

  // Check if we're using delta display mode
  const isDeltaMode = columnRenderMode === "delta";

  // For delta modes, calculate the change for numeric columns
  if (
    isDeltaMode &&
    (columnType === "number" || columnType === "integer") &&
    hasBase &&
    hasCurrent
  ) {
    // Parse values to numbers (they may be strings from the API)
    const baseNum = asNumber(row[baseKey]);
    const currentNum = asNumber(row[currentKey]);

    // Only show delta if both values are valid numbers
    if (Number.isFinite(baseNum) && Number.isFinite(currentNum)) {
      const netChange = currentNum - baseNum;
      const changePercent = baseNum !== 0 ? (netChange / baseNum) * 100 : 0;

      // Format current value and delta with smart decimals (up to 2, no trailing zeros)
      const formattedCurrent = formatSmartDecimal(currentNum);
      const formattedDelta = formatSmartDecimal(netChange);
      const deltaText = `(${netChange >= 0 ? "+" : ""}${formattedDelta})`;

      // Build tooltip text showing full precision
      const tooltipText = `Base: ${baseNum}\nCurrent: ${currentNum}\nChange: ${
        netChange >= 0 ? "+" : ""
      }${netChange} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(
        2,
      )}%)`;

      return (
        <Tooltip
          title={tooltipText}
          slotProps={{
            tooltip: { sx: { whiteSpace: "pre-line" } },
          }}
          enterDelay={300}
          placement="top"
        >
          <Box
            gap="5px"
            display="flex"
            alignItems="center"
            lineHeight="normal"
            height="100%"
          >
            <DiffText
              value={formattedCurrent}
              colorPalette="green"
              grayOut={currentGrayOut}
            />
            <Typography
              fontSize="0.75rem"
              color={netChange >= 0 ? "green.600" : "red.600"}
            >
              {deltaText}
            </Typography>
          </Box>
        </Tooltip>
      );
    }
  }

  // Values differ - render inline diff with base (red) and current (green)
  return (
    <Box
      sx={{
        display: "flex",
        gap: "5px",
        alignItems: "center",
        lineHeight: "normal",
        height: "100%",
      }}
    >
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
    </Box>
  );
};

/*
 * Converts row data values to a number
 *
 * @param data - The row data value (number, string, or other type)
 * @returns The numeric value, or 0 if conversion fails or value is not numeric
 */
export function asNumber(data: RowDataTypes): number {
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    const n = Number.parseFloat(data);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}
