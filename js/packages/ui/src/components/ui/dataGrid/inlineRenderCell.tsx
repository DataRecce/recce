/**
 * @file inlineRenderCell.tsx
 * @description Inline diff cell renderer for DataGrid columns
 *
 * Renders base and current values side-by-side when they differ,
 * or a single value when unchanged. Used for inline diff display mode.
 */

import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import type { ComponentType } from "react";
import type {
  ColumnRenderMode,
  ColumnType,
  RowDataTypes,
  RowObjectType,
} from "../../../api";
import {
  formatSmartDecimal,
  toRenderedValue,
} from "../../../utils/dataGrid/gridUtils";
import { DiffText, type DiffTextProps } from "../DiffText";
import { DiffTextWithToast } from "../DiffTextWithToast";

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
 * Props for DiffText component used in inline rendering
 * This allows platforms to inject their own DiffText with custom behavior
 */
export type InlineDiffTextProps = DiffTextProps;

/**
 * Configuration for creating an inline cell renderer
 */
export interface InlineRenderCellConfig {
  /**
   * Custom DiffText component to use for rendering diff values.
   * If not provided, uses the default DiffText from @datarecce/ui.
   * Platforms can inject their own DiffText with additional features
   * (e.g., toast notifications on copy).
   */
  DiffTextComponent?: ComponentType<InlineDiffTextProps>;
}

/**
 * Creates an inline diff cell renderer with configurable DiffText component
 *
 * @description Factory function that creates a cell renderer with an optional
 * custom DiffText component. This allows platforms to inject their own DiffText
 * implementation (e.g., with toast notifications).
 *
 * @param config - Configuration options for the renderer
 * @returns AG Grid cell renderer function
 *
 * @example
 * ```tsx
 * // Use default DiffText
 * const renderer = createInlineRenderCell();
 *
 * // Use custom DiffText with toast
 * const renderer = createInlineRenderCell({
 *   DiffTextComponent: DiffTextWithToast,
 * });
 * ```
 */
export function createInlineRenderCell(config: InlineRenderCellConfig = {}) {
  const DiffTextComp = config.DiffTextComponent ?? DiffText;

  return (params: ICellRendererParams<RowObjectType>) => {
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
              <DiffTextComp
                value={formattedCurrent}
                colorPalette="iochmara"
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

    // Values differ - render inline diff with base (orange) and current (blue)
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
          <DiffTextComp
            value={baseValue}
            colorPalette="orange"
            grayOut={baseGrayOut}
          />
        )}
        {hasCurrent && (
          <DiffTextComp
            value={currentValue}
            colorPalette="iochmara"
            grayOut={currentGrayOut}
          />
        )}
      </Box>
    );
  };
}

/**
 * Default inline diff cell renderer using DiffTextWithToast
 *
 * @description Pre-configured inline cell renderer that uses DiffTextWithToast
 * for copy-to-clipboard toast notifications. For custom DiffText behavior,
 * use createInlineRenderCell() with a custom DiffTextComponent.
 */
export const inlineRenderCell = createInlineRenderCell({
  DiffTextComponent: DiffTextWithToast,
});

/**
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
