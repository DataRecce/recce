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
