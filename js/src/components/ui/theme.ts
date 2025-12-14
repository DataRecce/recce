"use client";

import { createTheme, type Theme } from "@mui/material/styles";

/**
 * Custom color palette for Recce
 * Converted from Chakra UI tokens to MUI theme format
 */
export const colors = {
  iochmara: {
    50: "#EAF3FB",
    100: "#C4DDF3",
    200: "#9EC6EB",
    300: "#79B0E2",
    400: "#5599D8",
    500: "#3182CE",
    600: "#2A6CA7",
    700: "#225581",
    800: "#193E5C",
    900: "#102638",
    950: "#060E14",
  },
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
  orange: {
    50: "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    400: "#FB923C",
    500: "#F97316",
    600: "#EA580C",
    700: "#C2410C",
    800: "#9A3412",
    900: "#7C2D12",
    950: "#431407",
  },
  brand: {
    50: "#FFDED5",
    100: "#FFC1B0",
    200: "#FFA58C",
    300: "#FF8967",
    400: "#FF6E42",
    500: "#FD541E",
    600: "#F04104",
    700: "#C93A06",
    800: "#A23206",
    900: "#7C2906",
    950: "#571E05",
  },
} as const;

/**
 * Semantic color tokens
 */
export const semanticColors = {
  iochmara: {
    solid: colors.iochmara[500],
    contrast: "#FFFFFF",
    fg: colors.iochmara[700],
    subtle: colors.iochmara[100],
    muted: colors.iochmara[200],
    emphasized: colors.iochmara[300],
    focusRing: colors.iochmara[400],
  },
  cyan: {
    solid: colors.cyan[600],
    contrast: "#FFFFFF",
    fg: colors.cyan[700],
    subtle: colors.cyan[100],
    muted: colors.cyan[200],
    emphasized: colors.cyan[300],
    focusRing: colors.cyan[500],
  },
  neutral: {
    solid: colors.neutral[900],
    contrast: "#FFFFFF",
    fg: colors.neutral[800],
    subtle: colors.neutral[100],
    muted: colors.neutral[200],
    emphasized: colors.neutral[300],
    focusRing: colors.neutral[400],
  },
  green: {
    solid: colors.green[600],
    contrast: "#FFFFFF",
    fg: colors.green[700],
    subtle: colors.green[100],
    muted: colors.green[200],
    emphasized: colors.green[300],
    focusRing: colors.green[500],
  },
  amber: {
    solid: colors.amber[500],
    contrast: "#FFFFFF",
    fg: colors.amber[700],
    subtle: colors.amber[100],
    muted: colors.amber[200],
    emphasized: colors.amber[300],
    focusRing: colors.amber[400],
  },
  red: {
    solid: colors.red[600],
    contrast: "#FFFFFF",
    fg: colors.red[700],
    subtle: colors.red[100],
    muted: colors.red[200],
    emphasized: colors.red[300],
    focusRing: colors.red[500],
  },
  rose: {
    solid: colors.rose[500],
    contrast: "#FFFFFF",
    fg: colors.rose[700],
    subtle: colors.rose[100],
    muted: colors.rose[200],
    emphasized: colors.rose[300],
    focusRing: colors.rose[400],
  },
  brand: {
    solid: colors.brand[500],
    contrast: "#FFFFFF",
    fg: colors.brand[700],
    subtle: colors.brand[100],
    muted: colors.brand[200],
    emphasized: colors.brand[300],
    focusRing: colors.brand[500],
  },
  orange: {
    solid: colors.orange[500],
    contrast: "#FFFFFF",
    fg: colors.orange[700],
    subtle: colors.orange[100],
    muted: colors.orange[200],
    emphasized: colors.orange[300],
    focusRing: colors.orange[400],
  },
  // Aliases
  blue: {
    solid: colors.iochmara[500],
    contrast: "#FFFFFF",
    fg: colors.iochmara[700],
    subtle: colors.iochmara[100],
    muted: colors.iochmara[200],
    emphasized: colors.iochmara[300],
    focusRing: colors.iochmara[400],
  },
  gray: {
    solid: colors.neutral[900],
    contrast: "#FFFFFF",
    fg: colors.neutral[800],
    subtle: colors.neutral[100],
    muted: colors.neutral[200],
    emphasized: colors.neutral[300],
    focusRing: colors.neutral[400],
  },
  // Semantic
  success: colors.green,
  warning: colors.amber,
  danger: colors.red,
  envBase: colors.amber[500],
  envCurrent: colors.iochmara[500],
} as const;

/**
 * MUI Theme
 */
export const theme: Theme = createTheme({
  palette: {
    primary: {
      main: colors.iochmara[500],
      light: colors.iochmara[300],
      dark: colors.iochmara[700],
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: colors.cyan[500],
      light: colors.cyan[300],
      dark: colors.cyan[700],
      contrastText: "#FFFFFF",
    },
    success: {
      main: colors.green[500],
      light: colors.green[300],
      dark: colors.green[700],
    },
    warning: {
      main: colors.amber[500],
      light: colors.amber[300],
      dark: colors.amber[700],
    },
    error: {
      main: colors.red[500],
      light: colors.red[300],
      dark: colors.red[700],
    },
    grey: {
      50: colors.neutral[50],
      100: colors.neutral[100],
      200: colors.neutral[200],
      300: colors.neutral[300],
      400: colors.neutral[400],
      500: colors.neutral[500],
      600: colors.neutral[600],
      700: colors.neutral[700],
      800: colors.neutral[800],
      900: colors.neutral[900],
    },
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
        },
      },
    },
  },
});

/**
 * Token lookup function to mimic Chakra UI's token API
 * Usage: token("colors.green.solid") => "#16A34A"
 */
export function token(path: string): string | undefined {
  const parts = path.split(".");

  // Handle "colors.X.Y" paths
  if (parts[0] === "colors" && parts.length >= 3) {
    const colorName = parts[1];
    const variant = parts[2];

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
      if (typeof color === "object" && variant in color) {
        return (color as Record<string, string>)[variant];
      }
    }

    // Handle "colors.white" and other special cases
    if (colorName === "white") return "#FFFFFF";
    if (colorName === "black") return "#000000";
  }

  return undefined;
}

// Export system object with token method for backward compatibility
export const system = {
  ...theme,
  token,
};

export default theme;
