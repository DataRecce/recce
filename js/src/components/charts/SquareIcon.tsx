import Box from "@mui/material/Box";

// Light mode colors
export const CURRENT_BAR_COLOR = "#63B3ED";
export const BASE_BAR_COLOR = "#F6AD55";
export const CURRENT_BAR_COLOR_WITH_ALPHA = `${CURRENT_BAR_COLOR}A5`;
export const BASE_BAR_COLOR_WITH_ALPHA = `${BASE_BAR_COLOR}A5`;

// Dark mode colors - slightly brighter for better visibility
export const CURRENT_BAR_COLOR_DARK = "#90CDF4";
export const BASE_BAR_COLOR_DARK = "#FBD38D";
export const CURRENT_BAR_COLOR_DARK_WITH_ALPHA = `${CURRENT_BAR_COLOR_DARK}A5`;
export const BASE_BAR_COLOR_DARK_WITH_ALPHA = `${BASE_BAR_COLOR_DARK}A5`;

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
    currentWithAlpha: isDark
      ? CURRENT_BAR_COLOR_DARK_WITH_ALPHA
      : CURRENT_BAR_COLOR_WITH_ALPHA,
    baseWithAlpha: isDark
      ? BASE_BAR_COLOR_DARK_WITH_ALPHA
      : BASE_BAR_COLOR_WITH_ALPHA,
    info: isDark ? INFO_VAL_COLOR_DARK : INFO_VAL_COLOR,
  };
}

export function SquareIcon({ color }: { color: string }) {
  return (
    <Box
      sx={{
        display: "inline-block",
        width: "10px",
        height: "10px",
        bgcolor: color,
        mr: 1,
        borderRadius: "4px",
      }}
    />
  );
}
