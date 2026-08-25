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
  isCellChanged,
  toRenderedValue,
} from "../../../utils/dataGrid/gridUtils";
import { hasOwn } from "../../../utils/hasOwn";
import { DiffText, type DiffTextProps } from "../DiffText";
import { DiffTextWithToast } from "../DiffTextWithToast";

/**
 * Custom context data for Recce columns
 * Stored in colDef.context to avoid AG Grid validation warnings
 */
interface RecceColumnContext {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
  showStructuralIndicator?: boolean;
  profileDiffPercentMode?: "percent_delta" | "percent_change";
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

/** Parses only finite numbers and complete numeric strings for explicit modes. */
export function parseFiniteNumeric(value: RowDataTypes): number | undefined {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedChange(value: number, suffix: string): string {
  return `${value >= 0 ? "+" : ""}${formatSmartDecimal(value)}${suffix}`;
}

function formatUnroundedChange(value: number, suffix: string): string {
  return `${value >= 0 ? "+" : ""}${value}${suffix}`;
}

function renderUndefinedRelativeChange(base: number, current: number) {
  const tooltipText = `Base: ${base}\nCurrent: ${current}\nChange: N/A`;

  return (
    <Tooltip
      title={tooltipText}
      slotProps={{
        tooltip: { sx: { whiteSpace: "pre-line" } },
      }}
      enterDelay={300}
      placement="top"
    >
      <Typography
        data-direction="equal"
        sx={{ color: "text.secondary", fontSize: "0.75rem" }}
      >
        N/A
      </Typography>
    </Tooltip>
  );
}

function renderZeroRelativeChange() {
  return (
    <Tooltip
      title="Base: 0\nCurrent: 0\nChange: 0"
      slotProps={{
        tooltip: { sx: { whiteSpace: "pre-line" } },
      }}
      enterDelay={300}
      placement="top"
    >
      <Typography
        data-direction="equal"
        sx={{ color: "text.secondary", fontSize: "0.75rem" }}
      >
        0%
      </Typography>
    </Tooltip>
  );
}

function renderInlineValues(
  DiffTextComp: ComponentType<InlineDiffTextProps>,
  hasBase: boolean,
  hasCurrent: boolean,
  baseValue: string,
  currentValue: string,
  baseGrayOut: boolean,
  currentGrayOut: boolean,
) {
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
          comparisonRole="base"
          grayOut={baseGrayOut}
        />
      )}
      {hasCurrent && (
        <DiffTextComp
          value={currentValue}
          comparisonRole="current"
          grayOut={currentGrayOut}
        />
      )}
    </Box>
  );
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
    const profileDiffPercentMode = colDef?.context?.profileDiffPercentMode;
    const columnKey = colDef?.field ?? "";

    if (!params.data) {
      return null;
    }

    const row = params.data;
    const baseKey = `base__${columnKey}`.toLowerCase();
    const currentKey = `current__${columnKey}`.toLowerCase();

    // Handle case where neither base nor current values exist
    if (!hasOwn(row, baseKey) && !hasOwn(row, currentKey)) {
      return "-";
    }

    const hasBase = hasOwn(row, baseKey);
    const hasCurrent = hasOwn(row, currentKey);

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

    const isExplicitPercentMode =
      (columnRenderMode === "percent_delta" ||
        columnRenderMode === "percent_change") &&
      columnRenderMode === profileDiffPercentMode;
    const baseNumericValue = parseFiniteNumeric(row[baseKey]);
    const currentNumericValue = parseFiniteNumeric(row[currentKey]);

    // No change - render single value.
    // Must use the same type-dispatched comparison the row status and the
    // side-by-side cell classes use: a raw `===` here would render a
    // "base → current" diff for a FLOAT column whose two values differ only by
    // IEEE-754 noise, while determineRowStatus called the row unmodified.
    // Inline is the default display mode for the profile, value-diff-detail and
    // query-diff views, so that mismatch was the whole reported symptom of
    // DRC-3025.
    if (!isCellChanged(row[baseKey], row[currentKey], columnType)) {
      if (
        isExplicitPercentMode &&
        columnRenderMode === "percent_change" &&
        row.__status !== "added" &&
        row.__status !== "removed" &&
        baseNumericValue === 0 &&
        currentNumericValue === 0
      ) {
        return renderZeroRelativeChange();
      }

      if (
        isExplicitPercentMode &&
        columnRenderMode === "percent_change" &&
        row.__status !== "added" &&
        row.__status !== "removed" &&
        baseNumericValue !== undefined &&
        currentNumericValue !== undefined &&
        baseNumericValue < 0
      ) {
        return renderUndefinedRelativeChange(
          baseNumericValue,
          currentNumericValue,
        );
      }

      return (
        <Typography
          component="span"
          style={{ color: currentGrayOut ? "gray" : "inherit" }}
        >
          {isExplicitPercentMode && currentNumericValue !== undefined
            ? columnRenderMode === "percent_delta"
              ? formatPercent(currentNumericValue)
              : currentValue
            : currentValue}
        </Typography>
      );
    }

    // Check if we're using delta display mode
    const isDeltaMode = columnRenderMode === "delta";

    // For delta modes, calculate the change for numeric columns
    if (
      isDeltaMode &&
      (columnType === "number" ||
        columnType === "float" ||
        columnType === "integer") &&
      hasBase &&
      hasCurrent
    ) {
      // Parse values to numbers (they may be strings from the API)
      const baseNum = asNumber(row[baseKey]);
      const currentNum = asNumber(row[currentKey]);

      // Only show delta if both values are valid numbers
      if (Number.isFinite(baseNum) && Number.isFinite(currentNum)) {
        const netChange = currentNum - baseNum;
        const direction =
          netChange > 0 ? "increase" : netChange < 0 ? "decrease" : "equal";
        const symbol =
          direction === "increase" ? "↑" : direction === "decrease" ? "↓" : "=";
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
              sx={{
                gap: "5px",
                display: "flex",
                alignItems: "center",
                lineHeight: "normal",
                height: "100%",
              }}
            >
              <DiffTextComp
                value={formattedCurrent}
                comparisonRole="current"
                grayOut={currentGrayOut}
              />
              <Typography
                data-direction={direction}
                sx={{
                  color: "text.secondary",
                  fontSize: "0.75rem",
                }}
              >
                <span aria-hidden="true">{symbol}</span> {deltaText}
              </Typography>
            </Box>
          </Tooltip>
        );
      }
    }

    if (
      isExplicitPercentMode &&
      (columnType === "number" ||
        columnType === "float" ||
        columnType === "integer") &&
      hasBase &&
      hasCurrent &&
      row.__status !== "added" &&
      row.__status !== "removed"
    ) {
      const baseNum = parseFiniteNumeric(row[baseKey]);
      const currentNum = parseFiniteNumeric(row[currentKey]);

      if (baseNum !== undefined && currentNum !== undefined) {
        const isRelativeChange = columnRenderMode === "percent_change";
        const relativeChangeIsUndefined = isRelativeChange && baseNum <= 0;

        if (relativeChangeIsUndefined) {
          return renderUndefinedRelativeChange(baseNum, currentNum);
        }

        const change = isRelativeChange
          ? ((currentNum - baseNum) / baseNum) * 100
          : currentNum * 100 - baseNum * 100;

        if (!Number.isFinite(change)) {
          return renderInlineValues(
            DiffTextComp,
            hasBase,
            hasCurrent,
            baseValue,
            currentValue,
            baseGrayOut,
            currentGrayOut,
          );
        }

        const direction =
          change > 0 ? "increase" : change < 0 ? "decrease" : "equal";
        const suffix = isRelativeChange ? "%" : "pp";
        const changeText = `(${formatSignedChange(change, suffix)})`;
        const tooltipText = `Base: ${baseNum}\nCurrent: ${currentNum}\nChange: ${formatUnroundedChange(
          change,
          suffix,
        )}`;

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
              sx={{
                gap: "5px",
                display: "flex",
                alignItems: "center",
                lineHeight: "normal",
                height: "100%",
              }}
            >
              <DiffTextComp
                value={
                  columnRenderMode === "percent_delta"
                    ? formatPercent(currentNum)
                    : currentValue
                }
                comparisonRole="current"
                grayOut={currentGrayOut}
              />
              <Typography
                data-direction={direction}
                sx={{ color: "text.secondary", fontSize: "0.75rem" }}
              >
                {changeText}
              </Typography>
            </Box>
          </Tooltip>
        );
      }
    }

    // Values differ - render inline diff with base (red) and current (green)
    return renderInlineValues(
      DiffTextComp,
      hasBase,
      hasCurrent,
      baseValue,
      currentValue,
      baseGrayOut,
      currentGrayOut,
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
