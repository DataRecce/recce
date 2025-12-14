"use client";

import { createTheme, type ThemeOptions } from "@mui/material/styles";

/**
 * MUI Theme Configuration for Recce
 *
 * This theme mirrors the existing Chakra UI theme tokens from theme.ts
 * to ensure visual consistency during the migration period.
 *
 * Color palette mappings:
 * - iochmara (custom blue) -> primary
 * - cyan -> secondary
 * - brand (orange) -> custom palette
 * - green -> success
 * - amber -> warning
 * - red -> error
 * - neutral -> grey
 */

// Custom color palettes matching Chakra theme tokens
const colors = {
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
};

// Semantic color tokens matching Chakra's semantic tokens
const semanticColors = {
  envBase: colors.amber[500],
  envCurrent: colors.iochmara[500],
};

// Component overrides to match Chakra UI defaults
const componentOverrides: ThemeOptions["components"] = {
  // Button overrides
  MuiButton: {
    defaultProps: {
      disableElevation: true, // Match Chakra's flat button style
    },
    // Size variants to match Chakra's sizes
    variants: [
      {
        props: { size: "xsmall" },
        style: {
          padding: "0 0.5rem",
          fontSize: "0.75rem",
          fontWeight: 500,
          borderRadius: "0.25rem",
          minHeight: "unset", // Remove default minHeight constraint
          lineHeight: 1.5, // Ensure proper text alignment
        },
      },
    ],
    styleOverrides: {
      root: {
        textTransform: "none",
        fontWeight: 500,
        borderRadius: 6,
      },
      sizeSmall: {
        padding: "4px 12px",
        fontSize: "0.875rem",
      },
      sizeMedium: {
        padding: "8px 16px",
        fontSize: "1rem",
      },
      sizeLarge: {
        padding: "12px 24px",
        fontSize: "1.125rem",
      },
      // Contained variant (solid in Chakra)
      contained: {
        "&:hover": {
          boxShadow: "none",
        },
      },
      // Outlined variant (outline in Chakra)
      outlined: {
        borderWidth: "1px",
        "&:hover": {
          borderWidth: "1px",
        },
      },
      // Text variant (ghost in Chakra)
      text: {
        "&:hover": {
          backgroundColor: "rgba(0, 0, 0, 0.04)",
        },
      },
    },
  },
  // IconButton overrides
  MuiIconButton: {
    styleOverrides: {
      root: {
        borderRadius: 6,
      },
      sizeSmall: {
        padding: 4,
      },
      sizeMedium: {
        padding: 8,
      },
      sizeLarge: {
        padding: 12,
      },
    },
  },
  // TextField overrides
  MuiTextField: {
    defaultProps: {
      variant: "outlined",
      size: "small",
    },
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          borderRadius: 6,
        },
      },
    },
  },
  // Input overrides
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: colors.iochmara[400],
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: colors.iochmara[500],
          borderWidth: 2,
        },
      },
      notchedOutline: {
        borderColor: colors.neutral[300],
      },
    },
  },
  // Checkbox overrides
  MuiCheckbox: {
    defaultProps: {
      color: "primary",
    },
    styleOverrides: {
      root: {
        borderRadius: 4,
      },
    },
  },
  // Switch overrides
  MuiSwitch: {
    defaultProps: {
      color: "primary",
    },
  },
  // Dialog overrides
  MuiDialog: {
    styleOverrides: {
      paper: {
        borderRadius: 8,
      },
    },
  },
  MuiDialogTitle: {
    styleOverrides: {
      root: {
        fontWeight: 600,
        fontSize: "1.125rem",
      },
    },
  },
  // Menu overrides
  MuiMenu: {
    styleOverrides: {
      paper: {
        borderRadius: 8,
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: {
        fontSize: "0.875rem",
        padding: "8px 12px",
        "&:hover": {
          backgroundColor: colors.neutral[100],
        },
        "&.Mui-selected": {
          backgroundColor: colors.iochmara[50],
          "&:hover": {
            backgroundColor: colors.iochmara[100],
          },
        },
      },
    },
  },
  // Chip overrides (Tag in Chakra)
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
      sizeSmall: {
        height: 24,
        fontSize: "0.75rem",
      },
      sizeMedium: {
        height: 32,
        fontSize: "0.875rem",
      },
    },
  },
  // Tooltip overrides
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        backgroundColor: colors.neutral[800],
        fontSize: "0.75rem",
        padding: "4px 8px",
        borderRadius: 4,
      },
      arrow: {
        color: colors.neutral[800],
      },
    },
  },
  // Alert overrides
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 6,
      },
      standardSuccess: {
        backgroundColor: colors.green[50],
        color: colors.green[800],
      },
      standardWarning: {
        backgroundColor: colors.amber[50],
        color: colors.amber[800],
      },
      standardError: {
        backgroundColor: colors.red[50],
        color: colors.red[800],
      },
      standardInfo: {
        backgroundColor: colors.iochmara[50],
        color: colors.iochmara[800],
      },
    },
  },
  // Tabs overrides
  MuiTabs: {
    styleOverrides: {
      indicator: {
        height: 2,
      },
    },
  },
  MuiTab: {
    styleOverrides: {
      root: {
        textTransform: "none",
        fontWeight: 500,
        minHeight: 48,
      },
    },
  },
  // Avatar overrides
  MuiAvatar: {
    styleOverrides: {
      root: {
        fontWeight: 500,
      },
    },
  },
  // Badge overrides
  MuiBadge: {
    styleOverrides: {
      badge: {
        fontWeight: 500,
        fontSize: "0.75rem",
      },
    },
  },
  // CircularProgress (Spinner in Chakra)
  MuiCircularProgress: {
    defaultProps: {
      color: "primary",
    },
  },
  // Link overrides
  MuiLink: {
    defaultProps: {
      underline: "hover",
      fontWeight: 500,
    },
    styleOverrides: {
      root: {
        color: colors.iochmara[600],
        textDecorationColor: colors.iochmara[300],
        "&:hover": {
          color: colors.iochmara[700],
        },
      },
    },
  },
  // Paper overrides
  MuiPaper: {
    styleOverrides: {
      rounded: {
        borderRadius: 8,
      },
    },
  },
  // Popover overrides
  MuiPopover: {
    styleOverrides: {
      paper: {
        borderRadius: 8,
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      },
    },
  },
  // Divider overrides
  MuiDivider: {
    styleOverrides: {
      root: {
        borderColor: colors.neutral[200],
      },
    },
  },
  // Breadcrumbs overrides
  MuiBreadcrumbs: {
    styleOverrides: {
      separator: {
        color: colors.neutral[400],
      },
    },
  },
};

// Base theme options
const baseThemeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: colors.iochmara[500],
      light: colors.iochmara[400],
      dark: colors.iochmara[600],
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: colors.cyan[500],
      light: colors.cyan[400],
      dark: colors.cyan[600],
      contrastText: "#FFFFFF",
    },
    success: {
      main: colors.green[500],
      light: colors.green[400],
      dark: colors.green[600],
      contrastText: "#FFFFFF",
    },
    warning: {
      main: colors.amber[500],
      light: colors.amber[400],
      dark: colors.amber[600],
      contrastText: "#FFFFFF",
    },
    error: {
      main: colors.red[500],
      light: colors.red[400],
      dark: colors.red[600],
      contrastText: "#FFFFFF",
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
    fontFamily:
      'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    // Match Chakra's default font weights
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    // Typography variants
    h1: {
      fontWeight: 700,
      fontSize: "2.25rem",
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 700,
      fontSize: "1.875rem",
      lineHeight: 1.2,
    },
    h3: {
      fontWeight: 600,
      fontSize: "1.5rem",
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: "1.25rem",
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: "1.125rem",
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: "1rem",
      lineHeight: 1.5,
    },
    body1: {
      fontSize: "1rem",
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.875rem",
      lineHeight: 1.5,
    },
    button: {
      textTransform: "none", // Match Chakra's default (no uppercase)
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 6, // Match Chakra's default border radius
  },
  spacing: 4, // Base spacing unit (4px), similar to Chakra
  components: componentOverrides,
};

// Light theme
const lightThemeOptions: ThemeOptions = {
  ...baseThemeOptions,
  palette: {
    ...baseThemeOptions.palette,
    mode: "light",
    background: {
      default: "#FFFFFF",
      paper: "#FFFFFF",
    },
    text: {
      primary: colors.neutral[900],
      secondary: colors.neutral[600],
    },
  },
};

// Dark theme
const darkThemeOptions: ThemeOptions = {
  ...baseThemeOptions,
  palette: {
    ...baseThemeOptions.palette,
    mode: "dark",
    background: {
      default: colors.neutral[900],
      paper: colors.neutral[800],
    },
    text: {
      primary: colors.neutral[50],
      secondary: colors.neutral[400],
    },
  },
};

// Create themes
export const lightTheme = createTheme(lightThemeOptions);
export const darkTheme = createTheme(darkThemeOptions);

// Default export (light theme)
export const muiTheme = lightTheme;

// Export color palette for use in custom components
export { colors, semanticColors };

// Augment MUI theme to include custom palette colors
declare module "@mui/material/styles" {
  interface Palette {
    brand: Palette["primary"];
    envBase: string;
    envCurrent: string;
  }

  interface PaletteOptions {
    brand?: PaletteOptions["primary"];
    envBase?: string;
    envCurrent?: string;
  }
}

// Add custom colors to the theme
const customPaletteAdditions = {
  brand: {
    main: colors.brand[500],
    light: colors.brand[400],
    dark: colors.brand[600],
    contrastText: "#FFFFFF",
  },
  envBase: semanticColors.envBase,
  envCurrent: semanticColors.envCurrent,
};

// Apply custom palette to both themes
lightTheme.palette.brand = customPaletteAdditions.brand;
lightTheme.palette.envBase = customPaletteAdditions.envBase;
lightTheme.palette.envCurrent = customPaletteAdditions.envCurrent;

darkTheme.palette.brand = customPaletteAdditions.brand;
darkTheme.palette.envBase = customPaletteAdditions.envBase;
darkTheme.palette.envCurrent = customPaletteAdditions.envCurrent;

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
