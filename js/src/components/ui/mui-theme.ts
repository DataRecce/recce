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

// Import shared theme from @datarecce/ui (single source of truth)
import { colors, theme } from "@datarecce/ui";

// Re-export colors for backward compatibility
export { colors };

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

/**
 * Color aliases for backward compatibility
 * Maps common color names to their Recce palette equivalents
 */
const colorAliases: Record<string, keyof typeof colors> = {
  orange: "amber", // Chakra's orange maps to our amber
  gray: "neutral", // Gray is an alias for neutral
};

/**
 * Semantic variant mappings from Chakra-style tokens to scale values
 * These map semantic names to numeric scale values in the color palette
 *
 * Used during Chakra UI -> MUI migration to translate Chakra token paths
 * like "colors.green.solid" to actual color values
 */
export const semanticVariantMap: Record<string, number> = {
  solid: 600, // Dark, for text/icons
  subtle: 50, // Light, for backgrounds
  muted: 200, // Slightly muted
  emphasized: 500, // Standard emphasis
  focusRing: 400, // Focus ring color
  light: 300, // Light variant (for neutral.light borders)
};

/**
 * Token lookup function to mimic Chakra UI's token API
 *
 * This utility function translates Chakra-style token paths to actual
 * color values from the color palette. Used during migration from
 * Chakra UI to MUI.
 *
 * @param path - Token path like "colors.green.solid" or "colors.neutral.500"
 * @returns The hex color value, or undefined if not found
 *
 * @example
 * token("colors.green.solid") // => "#16A34A"
 * token("colors.neutral.500") // => "#737373"
 * token("colors.orange.400")  // => "#FBBF24" (maps orange to amber)
 */
export function token(path: string): string | undefined {
  const parts = path.split(".");

  // Handle "colors.X.Y" paths
  if (parts[0] === "colors" && parts.length >= 3) {
    let colorName = parts[1];
    const variant = parts[2];

    // Apply color aliases (e.g., orange -> amber, gray -> neutral)
    if (colorName in colorAliases) {
      colorName = colorAliases[colorName];
    }

    // Handle "colors.white" and other special cases
    if (colorName === "white") return colors.white;
    if (colorName === "black") return colors.black;

    // Try semantic colors first
    if (colorName in semanticColors) {
      const semantic = semanticColors[colorName as keyof typeof semanticColors];
      if (typeof semantic === "object" && variant in semantic) {
        return (semantic as Record<string, string>)[variant];
      }
    }

    // Then try base colors
    if (colorName in colors) {
      const color = colors[colorName as keyof typeof colors];

      // First check for numeric scale (e.g., "500")
      if (typeof color === "object" && variant in color) {
        return (color as Record<string, string>)[variant];
      }

      // Then check for semantic variant mapping (e.g., "solid" -> 600)
      if (variant in semanticVariantMap) {
        const scaleValue = semanticVariantMap[variant];
        if (typeof color === "object" && scaleValue in color) {
          return (color as Record<string, string>)[scaleValue];
        }
      }
    }
  }

  return undefined;
}

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
