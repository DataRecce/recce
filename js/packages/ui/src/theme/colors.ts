/**
 * Recce brand colors and palette definitions
 *
 * These colors are used to create a consistent visual identity across
 * the Recce UI components. The palette includes brand colors, semantic
 * colors for status indicators, and neutral grays.
 *
 * Color values are aligned with the main Recce theme at
 * ui/src/components/ui/mui-theme.ts for consistency.
 */

export const colors = {
  /** White color */
  white: "#FFFFFF",

  /** Black color */
  black: "#000000",
  /**
   * Primary brand color - Orange/Coral
   * Used for primary actions, branding elements, and highlights
   */
  brand: {
    50: "#FFDED5",
    100: "#FFC1B0",
    200: "#FFA58C",
    300: "#FF8967",
    400: "#FF6E42",
    500: "#FD541E", // Primary brand color
    600: "#F04104",
    700: "#C93A06",
    800: "#A23206",
    900: "#7C2906",
    950: "#571E05",
  },

  /**
   * Secondary color - Blue (Iochmara)
   * Used for secondary actions, links, and information elements
   */
  iochmara: {
    50: "#EAF3FB",
    100: "#C4DDF3",
    200: "#9EC6EB",
    300: "#79B0E2",
    400: "#5599D8",
    500: "#3182CE", // Secondary color
    600: "#2A6CA7",
    700: "#225581",
    800: "#193E5C",
    900: "#102638",
    950: "#060E14",
  },

  /**
   * Neutral grays
   * Used for backgrounds, borders, and text
   */
  neutral: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E5E5E5",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0A0A0A",
  },

  /**
   * Cyan color scale
   * Used for secondary accents
   */
  cyan: {
    50: "#ECFEFF",
    100: "#CFFAFE",
    200: "#A5F3FC",
    300: "#67E8F9",
    400: "#22D3EE",
    500: "#06B6D4",
    600: "#0891B2",
    700: "#0E7490",
    800: "#155E75",
    900: "#164E63",
    950: "#083344",
  },

  /**
   * Amber color scale
   * Used for warnings
   */
  amber: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
    950: "#431407",
  },

  /**
   * Yellow color scale
   * Used for warnings and highlights
   */
  yellow: {
    50: "#FEFCE8",
    100: "#FEF9C3",
    200: "#FEF08A",
    300: "#FDE047",
    400: "#FACC15",
    500: "#EAB308",
    600: "#CA8A04",
    700: "#A16207",
    800: "#854D0E",
    900: "#713F12",
    950: "#422006",
  },

  /**
   * Green color scale
   * Used for success states
   */
  green: {
    50: "#F0FDF4",
    100: "#DCFCE7",
    200: "#BBF7D0",
    300: "#86EFAC",
    400: "#4ADE80",
    500: "#22C55E",
    600: "#16A34A",
    700: "#15803D",
    800: "#166534",
    900: "#14532D",
    950: "#052E16",
  },

  /**
   * Red color scale
   * Used for errors
   */
  red: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    500: "#EF4444",
    600: "#DC2626",
    700: "#B91C1C",
    800: "#991B1B",
    900: "#7F1D1D",
    950: "#450A0A",
  },

  /**
   * Rose color scale
   * Used for accent colors
   */
  rose: {
    50: "#FFF1F2",
    100: "#FFE4E6",
    200: "#FECDD3",
    300: "#FDA4AF",
    400: "#FB7185",
    500: "#F43F5E",
    600: "#E11D48",
    700: "#BE123C",
    800: "#9F1239",
    900: "#881337",
    950: "#4C0519",
  },

  /**
   * Fuchsia color scale
   * Used for accent colors
   */
  fuchsia: {
    50: "#FDF4FF",
    100: "#FAE8FF",
    200: "#F5D0FE",
    300: "#F0ABFC",
    400: "#E879F9",
    500: "#D946EF",
    600: "#C026D3",
    700: "#A21CAF",
    800: "#86198F",
    900: "#701A75",
    950: "#4A044E",
  },

  /**
   * Semantic colors for status indicators
   */
  success: {
    main: "#22C55E", // green[500]
    light: "#4ADE80", // green[400],
    dark: "#16A34A", // green[600],
    contrastText: "#ffffff",
  },

  warning: {
    main: "#EAB308", // amber[500],
    light: "#FACC15", // amber[400],
    dark: "#78350F", // amber[900] - darker for better contrast on light backgrounds
    contrastText: "#000000",
  },

  error: {
    main: "#EF4444", // red[500],
    light: "#F87171", // red[400],
    dark: "#DC2626", // red[600],
    contrastText: "#ffffff",
  },

  info: {
    main: "#3182CE",
    light: "#79B0E2",
    dark: "#225581",
    contrastText: "#ffffff",
  },
} as const;

/**
 * Color aliases for backward compatibility
 * Maps common color names to their Recce palette equivalents
 */
export const colorAliases: Record<string, keyof typeof colors> = {
  orange: "amber",
  gray: "neutral",
};

/**
 * Type for accessing color shades
 */
export type ColorShade =
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 950;

/**
 * Type for semantic color variants
 */
export type SemanticColorVariant = "light" | "main" | "dark" | "contrastText";

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
  light: 300, // Light variant
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

    // Try base colors
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
