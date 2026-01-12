"use client";

/**
 * MUI Theme for Recce OSS Application
 *
 * This module imports the shared theme from @datarecce/ui and provides
 * backward-compatible exports plus Chakra migration utilities.
 *
 * The core theme (colors, component overrides, palette definitions)
 * is maintained in @datarecce/ui as the single source of truth.
 */

// Import shared theme from @datarecce/ui/theme (direct import avoids barrel)
// Using direct path prevents loading AG Grid components during tests
import { colors, semanticVariantMap, theme, token } from "@datarecce/ui/theme";

// Re-export token function from @datarecce/ui for backward compatibility
export { token };

// Re-export semanticVariantMap for backward compatibility
export { semanticVariantMap };

// Export theme aliases for backward compatibility
// @datarecce/ui uses CSS Variables mode, so light/dark are the same theme instance
export const lightTheme = theme;
export const darkTheme = theme;

// Default export for convenience
export const muiTheme = theme;

/**
 * Semantic color tokens for environment identification
 * These are specific to Recce OSS for the base/current environment comparison UI
 */
export const semanticColors = {
  envBase: colors.amber[500],
  envCurrent: colors.iochmara[500],
};

// Augment MUI theme to include custom palette colors
// Note: 'neutral' is not added here as MUI's built-in 'grey' serves as the neutral color scale
declare module "@mui/material/styles" {
  interface Palette {
    brand: Palette["primary"];
    iochmara: Palette["primary"];
    cyan: Palette["primary"];
    amber: Palette["primary"];
    green: Palette["primary"];
    red: Palette["primary"];
    rose: Palette["primary"];
    fuchsia: Palette["primary"];
    envBase: string;
    envCurrent: string;
  }

  interface PaletteOptions {
    brand?: PaletteOptions["primary"];
    iochmara?: PaletteOptions["primary"];
    cyan?: PaletteOptions["primary"];
    amber?: PaletteOptions["primary"];
    green?: PaletteOptions["primary"];
    red?: PaletteOptions["primary"];
    rose?: PaletteOptions["primary"];
    fuchsia?: PaletteOptions["primary"];
    envBase?: string;
    envCurrent?: string;
  }
}
