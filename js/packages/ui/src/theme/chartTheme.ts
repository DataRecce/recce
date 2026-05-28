/**
 * Shared chart theme utilities — single source of truth for both
 * Chart.js-backed charts (`HistogramChart`, `TopKBarChart`) and the
 * SVG-rendered paired histogram cells.
 */

export interface ChartThemeColors {
  gridColor: string;
  textColor: string;
  borderColor: string;
  tooltipBackgroundColor: string;
  tooltipTextColor: string;
  /** Text color for labels drawn inside bars (must contrast with pastel bar fills) */
  barLabelColor: string;
  /** Subdued text color for secondary labels like percentages */
  secondaryTextColor: string;
  /** Semi-transparent background for chips/badges drawn over bars (e.g. trimmed-top-K marker). */
  overlayBackgroundColor: string;
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
    barLabelColor: isDark ? "#ffffff" : "#1f2937",
    secondaryTextColor: isDark ? "#e5e7eb" : "#6b7280",
    // 80% (cc) opacity: legible over a tall bar without reading as a hard block.
    overlayBackgroundColor: isDark ? "#1f2937cc" : "#ffffffcc",
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
export const CURRENT_BAR_COLOR_WITH_ALPHA = `${CURRENT_BAR_COLOR}A5`;
export const BASE_BAR_COLOR_WITH_ALPHA = `${BASE_BAR_COLOR}A5`;

// Bar color constants - Dark mode (slightly brighter for better visibility)
export const CURRENT_BAR_COLOR_DARK = "#90CDF4";
export const BASE_BAR_COLOR_DARK = "#FBD38D";
export const CURRENT_BAR_COLOR_DARK_WITH_ALPHA = `${CURRENT_BAR_COLOR_DARK}A5`;
export const BASE_BAR_COLOR_DARK_WITH_ALPHA = `${BASE_BAR_COLOR_DARK}A5`;

// `info`-style accent color used by some chart legends. Equal to the current
// bar color today but kept as a named export so consumers can pull a stable
// "info" accent without binding to the base/current palette.
export const INFO_VAL_COLOR = CURRENT_BAR_COLOR;
export const INFO_VAL_COLOR_DARK = CURRENT_BAR_COLOR_DARK;

/**
 * Bar colors for base/current comparison.
 */
export interface ChartBarColors {
  current: string;
  base: string;
  currentWithAlpha: string;
  baseWithAlpha: string;
  /** Accent color for `info`-styled legends; matches `current` today. */
  info: string;
}

/**
 * Get theme-aware bar colors for charts.
 * @param isDark - Whether dark mode is active
 */
export function getChartBarColors(isDark: boolean): ChartBarColors {
  return {
    current: isDark ? CURRENT_BAR_COLOR_DARK : CURRENT_BAR_COLOR,
    base: isDark ? BASE_BAR_COLOR_DARK : BASE_BAR_COLOR,
    currentWithAlpha: isDark
      ? CURRENT_BAR_COLOR_DARK_WITH_ALPHA
      : CURRENT_BAR_COLOR_WITH_ALPHA,
    baseWithAlpha: isDark
      ? BASE_BAR_COLOR_DARK_WITH_ALPHA
      : BASE_BAR_COLOR_WITH_ALPHA,
    info: isDark ? INFO_VAL_COLOR_DARK : INFO_VAL_COLOR,
  };
}
