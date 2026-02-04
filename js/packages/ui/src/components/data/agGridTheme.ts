"use client";

/**
 * @file agGridTheme.ts
 * @description AG Grid theme configuration for data grids
 *
 * Provides light and dark themes using AG Grid's themeQuartz as a base.
 */

import { themeQuartz } from "ag-grid-community";

// System font stack for headers
const systemFontStack =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/**
 * Light theme for AG Grid data grids
 */
export const dataGridThemeLight = themeQuartz.withParams({
  backgroundColor: "#ffffff",
  headerBackgroundColor: "#f5f5f5",
  rowHoverColor: "#ffffff",
  borderColor: "#e0e0e0",
  foregroundColor: "#1e1e1e",
  fontFamily: "monospace",
  fontSize: 13,
  headerFontFamily: systemFontStack,
  headerFontSize: 13,
  headerFontWeight: 700,
  cellHorizontalPadding: 8,
  wrapperBorderRadius: 0,
});

/**
 * Dark theme for AG Grid data grids
 */
export const dataGridThemeDark = themeQuartz.withParams({
  backgroundColor: "#1e1e1e",
  headerBackgroundColor: "#383838",
  rowHoverColor: "#1e1e1e",
  borderColor: "#4a4a4a",
  foregroundColor: "#e0e0e0",
  fontFamily: "monospace",
  fontSize: 13,
  headerFontFamily: systemFontStack,
  headerFontSize: 13,
  headerFontWeight: 700,
  cellHorizontalPadding: 8,
  wrapperBorderRadius: 0,
});
