/**
 * Theme exports for @datarecce/ui
 *
 * This module exports the MUI theme configured with CSS Variables mode
 * for light/dark theme support, along with the color palette definitions.
 */

// Re-export MUI's Theme type for convenience
export type { Theme } from "@mui/material/styles";
export {
  type ColorShade,
  colorAliases,
  colors,
  type SemanticColorVariant,
} from "./colors";
export { type RecceTheme, theme } from "./theme";
export {
  // Chart theme utilities
  type ChartThemeColors,
  getBarColors,
  getChartThemeColors,
  getThemedPluginOptions,
  getThemedScaleOptions,
  // Bar color constants
  BASE_BAR_COLOR,
  BASE_BAR_COLOR_DARK,
  BASE_BAR_COLOR_DARK_WITH_ALPHA,
  BASE_BAR_COLOR_WITH_ALPHA,
  CURRENT_BAR_COLOR,
  CURRENT_BAR_COLOR_DARK,
  CURRENT_BAR_COLOR_DARK_WITH_ALPHA,
  CURRENT_BAR_COLOR_WITH_ALPHA,
  INFO_VAL_COLOR,
  INFO_VAL_COLOR_DARK,
} from "./chartTheme";
