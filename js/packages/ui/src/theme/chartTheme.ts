/**
 * Shared Chart.js theme utilities for dark mode support
 */

export interface ChartThemeColors {
  gridColor: string;
  textColor: string;
  borderColor: string;
  tooltipBackgroundColor: string;
  tooltipTextColor: string;
}

/**
 * Get theme-aware colors for Chart.js charts
 * @param isDark - Whether dark mode is active
 * @returns Theme colors for Chart.js configuration
 */
export function getChartThemeColors(isDark: boolean): ChartThemeColors {
  return {
    gridColor: isDark ? "#4b5563" : "#d1d5db",
    textColor: isDark ? "#e5e7eb" : "#374151",
    borderColor: isDark ? "#6b7280" : "#9ca3af",
    tooltipBackgroundColor: isDark ? "#1f2937" : "#ffffff",
    tooltipTextColor: isDark ? "#e5e7eb" : "#111827",
  };
}

/**
 * Get Chart.js scale options with theme-aware colors
 * @param isDark - Whether dark mode is active
 * @param showGrid - Whether to show grid lines
 * @returns Partial scale options for Chart.js
 */
export function getThemedScaleOptions(isDark: boolean, showGrid = true) {
  const colors = getChartThemeColors(isDark);
  return {
    grid: {
      color: showGrid ? colors.gridColor : undefined,
      display: showGrid,
    },
    ticks: {
      color: colors.textColor,
    },
    border: {
      color: colors.borderColor,
    },
  };
}

/**
 * Get Chart.js plugin options with theme-aware colors
 * @param isDark - Whether dark mode is active
 * @returns Plugin options for Chart.js (legend, title, tooltip)
 */
export function getThemedPluginOptions(isDark: boolean) {
  const colors = getChartThemeColors(isDark);
  return {
    legend: {
      labels: {
        color: colors.textColor,
      },
    },
    title: {
      color: colors.textColor,
    },
    tooltip: {
      backgroundColor: colors.tooltipBackgroundColor,
      titleColor: colors.tooltipTextColor,
      bodyColor: colors.tooltipTextColor,
      borderColor: colors.borderColor,
      borderWidth: 1,
    },
  };
}

// Bar color constants - Light mode
export const CURRENT_BAR_COLOR = "#63B3ED";
export const BASE_BAR_COLOR = "#F6AD55";
export const OVERLAP_BAR_COLOR = "#9F7AEA";
export const CURRENT_BAR_COLOR_WITH_ALPHA = `${CURRENT_BAR_COLOR}A5`;
export const BASE_BAR_COLOR_WITH_ALPHA = `${BASE_BAR_COLOR}A5`;
export const OVERLAP_BAR_COLOR_WITH_ALPHA = `${OVERLAP_BAR_COLOR}A5`;

// Bar color constants - Dark mode (slightly brighter for better visibility)
export const CURRENT_BAR_COLOR_DARK = "#90CDF4";
export const BASE_BAR_COLOR_DARK = "#FBD38D";
export const OVERLAP_BAR_COLOR_DARK = "#B794F4";
export const CURRENT_BAR_COLOR_DARK_WITH_ALPHA = `${CURRENT_BAR_COLOR_DARK}A5`;
export const BASE_BAR_COLOR_DARK_WITH_ALPHA = `${BASE_BAR_COLOR_DARK}A5`;
export const OVERLAP_BAR_COLOR_DARK_WITH_ALPHA = `${OVERLAP_BAR_COLOR_DARK}A5`;

// Info color
export const INFO_VAL_COLOR = "#63B3ED";
export const INFO_VAL_COLOR_DARK = "#90CDF4";

/**
 * Get theme-aware bar colors for charts
 * @param isDark - Whether dark mode is active
 * @returns Object with current and base bar colors
 */
export function getBarColors(isDark: boolean) {
  return {
    current: isDark ? CURRENT_BAR_COLOR_DARK : CURRENT_BAR_COLOR,
    base: isDark ? BASE_BAR_COLOR_DARK : BASE_BAR_COLOR,
    overlap: isDark ? OVERLAP_BAR_COLOR_DARK : OVERLAP_BAR_COLOR,
    currentWithAlpha: isDark
      ? CURRENT_BAR_COLOR_DARK_WITH_ALPHA
      : CURRENT_BAR_COLOR_WITH_ALPHA,
    baseWithAlpha: isDark
      ? BASE_BAR_COLOR_DARK_WITH_ALPHA
      : BASE_BAR_COLOR_WITH_ALPHA,
    overlapWithAlpha: isDark
      ? OVERLAP_BAR_COLOR_DARK_WITH_ALPHA
      : OVERLAP_BAR_COLOR_WITH_ALPHA,
    info: isDark ? INFO_VAL_COLOR_DARK : INFO_VAL_COLOR,
  };
}
