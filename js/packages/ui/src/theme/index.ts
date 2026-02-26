/**
 * Theme exports for @datarecce/ui
 *
 * This module exports the MUI theme configured with CSS Variables mode
 * for light/dark theme support, along with the color palette definitions.
 */

// Re-export MUI's Theme type for convenience
export type { Theme } from "@mui/material/styles";
// AG Grid theme
export {
  dataGridThemeDark,
  dataGridThemeLight,
} from "../components/data/agGridTheme";
export {
  // Bar color constants
  BASE_BAR_COLOR,
  BASE_BAR_COLOR_DARK,
  BASE_BAR_COLOR_DARK_WITH_ALPHA,
  BASE_BAR_COLOR_WITH_ALPHA,
  // Chart theme utilities
  type ChartThemeColors,
  CURRENT_BAR_COLOR,
  CURRENT_BAR_COLOR_DARK,
  CURRENT_BAR_COLOR_DARK_WITH_ALPHA,
  CURRENT_BAR_COLOR_WITH_ALPHA,
  getBarColors,
  getChartThemeColors,
  getThemedPluginOptions,
  getThemedScaleOptions,
  INFO_VAL_COLOR,
  INFO_VAL_COLOR_DARK,
  OVERLAP_BAR_COLOR,
  OVERLAP_BAR_COLOR_DARK,
  OVERLAP_BAR_COLOR_DARK_WITH_ALPHA,
  OVERLAP_BAR_COLOR_WITH_ALPHA,
} from "./chartTheme";
export {
  type ColorShade,
  colorAliases,
  colors,
  type SemanticColorVariant,
  semanticVariantMap,
  token,
} from "./colors";
export { type RecceTheme, theme } from "./theme";
