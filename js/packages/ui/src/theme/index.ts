/**
 * Theme exports for @datarecce/ui
 *
 * This module exports the MUI theme configured with CSS Variables mode
 * for light/dark theme support, along with the color palette definitions.
 */

// Re-export MUI's Theme type for convenience
export type { Theme } from "@mui/material/styles";
export { type ColorShade, colors, type SemanticColorVariant } from "./colors";
export { type RecceTheme, theme } from "./theme";
