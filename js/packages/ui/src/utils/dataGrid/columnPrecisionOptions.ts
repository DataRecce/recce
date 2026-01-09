/**
 * @file columnPrecisionOptions.ts
 * @description Column precision select options for number columns
 *
 * Provides menu options for changing how numeric columns are rendered:
 * - Raw value (no formatting)
 * - 2 decimal points
 * - Percentage format
 * - Net change (delta) display
 */

import type { ColumnRenderMode } from "../../api";

/**
 * Option for column precision menu
 */
export interface ColumnPrecisionOption {
  /** Display text for the menu item */
  value: string;
  /** Callback when option is selected */
  onClick: () => void;
}

/**
 * Generates precision select options for a numeric column
 *
 * @description Returns an array of options that can be used to build
 * a menu for changing how a numeric column is rendered. Each option
 * calls the provided callback with the appropriate render mode.
 *
 * @param colName - The column name to apply the render mode to
 * @param onColumnsRenderModeChanged - Callback to update column render modes
 * @returns Array of menu options with value and onClick handler
 *
 * @example
 * ```tsx
 * const options = columnPrecisionSelectOptions(
 *   "price",
 *   (modes) => setRenderModes(prev => ({ ...prev, ...modes }))
 * );
 *
 * // Use in a menu
 * options.map(opt => (
 *   <MenuItem key={opt.value} onClick={opt.onClick}>
 *     {opt.value}
 *   </MenuItem>
 * ));
 * ```
 */
export function columnPrecisionSelectOptions(
  colName: string,
  onColumnsRenderModeChanged: (col: Record<string, ColumnRenderMode>) => void,
): ColumnPrecisionOption[] {
  return [
    {
      value: "Show raw value",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: "raw" });
      },
    },
    {
      value: "Show 2 decimal points",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: 2 });
      },
    },
    {
      value: "Show as percentage",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: "percent" });
      },
    },
    {
      value: "Show with net change",
      onClick: () => {
        onColumnsRenderModeChanged({ [colName]: "delta" });
      },
    },
  ];
}
