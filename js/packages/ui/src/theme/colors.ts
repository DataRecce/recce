/**
 * Recce brand colors and palette definitions
 *
 * These colors are used to create a consistent visual identity across
 * the Recce UI components. The palette includes brand colors, semantic
 * colors for status indicators, and neutral grays.
 */

export const colors = {
  /**
   * Primary brand color - Orange/Coral
   * Used for primary actions, branding elements, and highlights
   */
  brand: {
    50: "#fff7ed",
    100: "#ffedd5",
    200: "#fed7aa",
    300: "#fdba74",
    400: "#fb923c",
    500: "#fd683e", // Primary brand color
    600: "#ea580c",
    700: "#c2410c",
    800: "#9a3412",
    900: "#7c2d12",
    950: "#431407",
  },

  /**
   * Secondary color - Blue (Iochmara)
   * Used for secondary actions, links, and information elements
   */
  iochmara: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3182ce", // Secondary color
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },

  /**
   * Neutral grays
   * Used for backgrounds, borders, and text
   */
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  },

  /**
   * Semantic colors for status indicators
   */
  success: {
    light: "#86efac",
    main: "#22c55e",
    dark: "#15803d",
    contrastText: "#ffffff",
  },

  warning: {
    light: "#fde047",
    main: "#f59e0b",
    dark: "#b45309",
    contrastText: "#000000",
  },

  error: {
    light: "#fca5a5",
    main: "#ef4444",
    dark: "#b91c1c",
    contrastText: "#ffffff",
  },

  info: {
    light: "#93c5fd",
    main: "#3b82f6",
    dark: "#1d4ed8",
    contrastText: "#ffffff",
  },
} as const;

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
