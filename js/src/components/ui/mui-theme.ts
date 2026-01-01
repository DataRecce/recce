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

// Base colors
const white = "#FFFFFF";
const black = "#000000";

// Custom color palettes matching Chakra theme tokens
const colors = {
  white,
  black,
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

// Custom color names type
type CustomColorName =
  | "brand"
  | "iochmara"
  | "cyan"
  | "amber"
  | "green"
  | "red"
  | "rose"
  | "fuchsia"
  | "neutral";

/**
 * Helper to generate button color variants for a given color
 * Creates contained, outlined, and text variant styles
 */
function createButtonColorVariants<T extends CustomColorName>(
  colorName: T,
  colorScale: (typeof colors)[keyof typeof colors],
) {
  return [
    // Contained variant (solid)
    {
      props: { color: colorName, variant: "contained" as const },
      style: {
        backgroundColor: colorScale[500],
        color: white,
        "&:hover": {
          backgroundColor: colorScale[600],
        },
      },
    },
    // Outlined variant
    {
      props: { color: colorName, variant: "outlined" as const },
      style: {
        borderColor: colorScale[500],
        color: colorScale[600],
        "&:hover": {
          borderColor: colorScale[600],
          backgroundColor: `${colorScale[50]}80`,
        },
      },
    },
    // Text variant (ghost)
    {
      props: { color: colorName, variant: "text" as const },
      style: {
        color: colorScale[600],
        "&:hover": {
          backgroundColor: `${colorScale[50]}80`,
        },
      },
    },
  ];
}

/**
 * Helper to generate CircularProgress color variants
 */
function createProgressColorVariant<T extends CustomColorName>(
  colorName: T,
  colorScale: (typeof colors)[keyof typeof colors],
) {
  return {
    props: { color: colorName },
    style: {
      color: colorScale[500],
    },
  };
}

/**
 * Helper to generate Badge color variants
 */
function createBadgeColorVariant<T extends CustomColorName>(
  colorName: T,
  colorScale: (typeof colors)[keyof typeof colors],
) {
  return {
    props: { color: colorName },
    style: {
      "& .MuiBadge-badge": {
        backgroundColor: colorScale[500],
        color: white,
      },
    },
  };
}

/**
 * Helper to generate Chip color variants
 */
function createChipColorVariants<T extends CustomColorName>(
  colorName: T,
  colorScale: (typeof colors)[keyof typeof colors],
) {
  return [
    // Filled variant
    {
      props: { color: colorName, variant: "filled" as const },
      style: {
        backgroundColor: colorScale[500],
        color: white,
        "&:hover": {
          backgroundColor: colorScale[600],
        },
      },
    },
    // Outlined variant
    {
      props: { color: colorName, variant: "outlined" as const },
      style: {
        borderColor: colorScale[500],
        color: colorScale[600],
      },
    },
  ];
}

// Generate all button color variants
const buttonColorVariants = [
  ...createButtonColorVariants("iochmara", colors.iochmara),
  ...createButtonColorVariants("cyan", colors.cyan),
  ...createButtonColorVariants("amber", colors.amber),
  ...createButtonColorVariants("green", colors.green),
  ...createButtonColorVariants("red", colors.red),
  ...createButtonColorVariants("rose", colors.rose),
  ...createButtonColorVariants("fuchsia", colors.fuchsia),
  ...createButtonColorVariants("brand", colors.brand),
  // Neutral variants are handled via styleOverrides for theme-awareness
];

// Generate all CircularProgress color variants
const progressColorVariants = [
  createProgressColorVariant("iochmara", colors.iochmara),
  createProgressColorVariant("cyan", colors.cyan),
  createProgressColorVariant("amber", colors.amber),
  createProgressColorVariant("green", colors.green),
  createProgressColorVariant("red", colors.red),
  createProgressColorVariant("rose", colors.rose),
  createProgressColorVariant("fuchsia", colors.fuchsia),
  createProgressColorVariant("brand", colors.brand),
  createProgressColorVariant("neutral", colors.neutral),
];

// Generate all Badge color variants
const badgeColorVariants = [
  createBadgeColorVariant("iochmara", colors.iochmara),
  createBadgeColorVariant("cyan", colors.cyan),
  createBadgeColorVariant("amber", colors.amber),
  createBadgeColorVariant("green", colors.green),
  createBadgeColorVariant("red", colors.red),
  createBadgeColorVariant("rose", colors.rose),
  createBadgeColorVariant("fuchsia", colors.fuchsia),
  createBadgeColorVariant("brand", colors.brand),
  createBadgeColorVariant("neutral", colors.neutral),
];

// Generate all Chip color variants
const chipColorVariants = [
  ...createChipColorVariants("iochmara", colors.iochmara),
  ...createChipColorVariants("cyan", colors.cyan),
  ...createChipColorVariants("amber", colors.amber),
  ...createChipColorVariants("green", colors.green),
  ...createChipColorVariants("red", colors.red),
  ...createChipColorVariants("rose", colors.rose),
  ...createChipColorVariants("fuchsia", colors.fuchsia),
  ...createChipColorVariants("brand", colors.brand),
  ...createChipColorVariants("neutral", colors.neutral),
];

// Component overrides to match Chakra UI defaults
const componentOverrides: ThemeOptions["components"] = {
  // Button overrides
  MuiButton: {
    defaultProps: {
      disableElevation: true, // Match Chakra's flat button style
    },
    // Size and color variants
    variants: [
      // Size variant: xsmall
      {
        props: { size: "xsmall" },
        style: {
          padding: "0 0.5rem",
          fontSize: "0.75rem",
          fontWeight: 500,
          borderRadius: 4,
          minHeight: "unset",
          lineHeight: 1.5,
        },
      },
      // Color variants for all custom colors
      ...buttonColorVariants,
    ],
    styleOverrides: {
      root: ({ theme, ownerState }) => ({
        textTransform: "none",
        fontWeight: 500,
        borderRadius: 6,
        // Theme-aware neutral button colors
        ...(ownerState.color === "neutral" &&
          ownerState.variant === "contained" && {
            backgroundColor: colors.neutral[700],
            color: white,
            "&:hover": { backgroundColor: colors.neutral[800] },
          }),
        ...(ownerState.color === "neutral" &&
          ownerState.variant === "outlined" && {
            borderColor:
              theme.palette.mode === "dark"
                ? colors.neutral[500]
                : colors.neutral[300],
            color:
              theme.palette.mode === "dark"
                ? colors.neutral[100]
                : colors.neutral[900],
            "&:hover": {
              borderColor:
                theme.palette.mode === "dark"
                  ? colors.neutral[400]
                  : colors.neutral[400],
              backgroundColor:
                theme.palette.mode === "dark"
                  ? colors.neutral[700]
                  : colors.neutral[100],
            },
          }),
        ...(ownerState.color === "neutral" &&
          ownerState.variant === "text" && {
            color:
              theme.palette.mode === "dark"
                ? colors.neutral[200]
                : colors.neutral[700],
            "&:hover": {
              backgroundColor:
                theme.palette.mode === "dark"
                  ? colors.neutral[700]
                  : colors.neutral[100],
            },
          }),
      }),
      sizeSmall: {
        padding: "0.25rem 0.75rem",
        fontSize: "0.875rem",
      },
      sizeMedium: {
        padding: "0.5rem 1rem",
        fontSize: "1rem",
      },
      sizeLarge: {
        padding: "0.75rem 1.5rem",
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
      text: ({ theme }) => ({
        "&:hover": {
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(255, 255, 255, 0.08)"
              : "rgba(0, 0, 0, 0.04)",
        },
      }),
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
      notchedOutline: ({ theme }) => ({
        borderColor:
          theme.palette.mode === "dark"
            ? colors.neutral[600]
            : colors.neutral[300],
      }),
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
      paper: ({ theme }) => ({
        borderRadius: 8,
        boxShadow: theme.shadows[3],
      }),
    },
  },
  MuiMenuItem: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontSize: "0.875rem",
        padding: "0.5rem 0.75rem",
        "&:hover": {
          backgroundColor:
            theme.palette.mode === "dark"
              ? colors.neutral[600]
              : colors.neutral[100],
        },
        "&.Mui-selected": {
          backgroundColor:
            theme.palette.mode === "dark"
              ? colors.iochmara[900]
              : colors.iochmara[50],
          "&:hover": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? colors.iochmara[800]
                : colors.iochmara[100],
          },
        },
      }),
    },
  },
  // Chip overrides (Tag in Chakra)
  MuiChip: {
    variants: [
      // Size variant: xsmall
      {
        props: { size: "xsmall" },
        style: {
          height: 20,
          fontSize: "0.625rem",
        },
      },
      // Color variants for all custom colors
      ...chipColorVariants,
    ],
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
      tooltip: ({ theme }) => ({
        backgroundColor:
          theme.palette.mode === "dark"
            ? colors.neutral[700]
            : colors.neutral[800],
        fontSize: "0.75rem",
        padding: "0.25rem 0.5rem",
        borderRadius: 4,
      }),
      arrow: ({ theme }) => ({
        color:
          theme.palette.mode === "dark"
            ? colors.neutral[700]
            : colors.neutral[800],
      }),
    },
  },
  // Alert overrides
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 6,
      },
      standardSuccess: ({ theme }) => ({
        backgroundColor:
          theme.palette.mode === "dark" ? colors.green[900] : colors.green[50],
        color:
          theme.palette.mode === "dark" ? colors.green[200] : colors.green[800],
      }),
      standardWarning: ({ theme }) => ({
        backgroundColor:
          theme.palette.mode === "dark" ? colors.amber[900] : colors.amber[50],
        color:
          theme.palette.mode === "dark" ? colors.amber[200] : colors.amber[800],
      }),
      standardError: ({ theme }) => ({
        backgroundColor:
          theme.palette.mode === "dark" ? colors.red[900] : colors.red[50],
        color:
          theme.palette.mode === "dark" ? colors.red[200] : colors.red[800],
      }),
      standardInfo: ({ theme }) => ({
        backgroundColor:
          theme.palette.mode === "dark"
            ? colors.iochmara[900]
            : colors.iochmara[50],
        color:
          theme.palette.mode === "dark"
            ? colors.iochmara[200]
            : colors.iochmara[800],
      }),
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
    variants: badgeColorVariants,
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
    variants: progressColorVariants,
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
      paper: ({ theme }) => ({
        borderRadius: 8,
        boxShadow: theme.shadows[3],
      }),
    },
  },
  // Divider overrides
  MuiDivider: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderColor:
          theme.palette.mode === "dark"
            ? colors.neutral[700]
            : colors.neutral[200],
      }),
    },
  },
  // Breadcrumbs overrides
  MuiBreadcrumbs: {
    styleOverrides: {
      separator: ({ theme }) => ({
        color:
          theme.palette.mode === "dark"
            ? colors.neutral[500]
            : colors.neutral[400],
      }),
    },
  },
};

// Base theme options
const baseThemeOptions: ThemeOptions = {
  palette: {
    primary: {
      main: colors.iochmara[500],
      light: colors.iochmara[300],
      dark: colors.iochmara[600],
      contrastText: white,
    },
    secondary: {
      main: colors.cyan[500],
      light: colors.cyan[400],
      dark: colors.cyan[600],
      contrastText: white,
    },
    success: {
      main: colors.green[500],
      light: colors.green[400],
      dark: colors.green[600],
      contrastText: white,
    },
    warning: {
      main: colors.amber[500],
      light: colors.amber[400],
      dark: colors.amber[600],
      contrastText: white,
    },
    error: {
      main: colors.red[500],
      light: colors.red[400],
      dark: colors.red[600],
      contrastText: white,
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
      fontSize: "0.875rem",
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.75rem",
      lineHeight: 1.5,
    },
    button: {
      textTransform: "none", // Match Chakra's default (no uppercase)
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 6, // Base border radius value (used by MUI's spacing multiplier)
  },
  spacing: 4, // Base spacing unit (used by MUI's spacing multiplier)
  components: componentOverrides,
};

// Light theme
const lightThemeOptions: ThemeOptions = {
  ...baseThemeOptions,
  palette: {
    ...baseThemeOptions.palette,
    mode: "light",
    background: {
      default: white,
      paper: white,
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

// Helper to create palette color from color scale
function createPaletteColor(colorScale: (typeof colors)[keyof typeof colors]) {
  return {
    main: colorScale[500],
    light: colorScale[300],
    dark: colorScale[600],
    contrastText: white,
  };
}

// Add custom colors to the theme palettes
const customPaletteAdditions = {
  brand: createPaletteColor(colors.brand),
  iochmara: {
    main: colors.iochmara[500],
    light: colors.iochmara[50],
    dark: colors.iochmara[700],
    contrastText: white,
  },
  cyan: createPaletteColor(colors.cyan),
  amber: createPaletteColor(colors.amber),
  green: createPaletteColor(colors.green),
  red: createPaletteColor(colors.red),
  rose: createPaletteColor(colors.rose),
  fuchsia: createPaletteColor(colors.fuchsia),
  neutral: {
    main: colors.neutral[500],
    light: colors.neutral[300], // Lighter shade for borders
    dark: colors.neutral[600],
    contrastText: white,
  },
  envBase: semanticColors.envBase,
  envCurrent: semanticColors.envCurrent,
};

// Apply custom palette to both themes
Object.assign(lightTheme.palette, customPaletteAdditions);
Object.assign(darkTheme.palette, customPaletteAdditions);

/**
 * Semantic variant mappings from Chakra-style tokens to scale values
 * These map semantic names to numeric scale values in the color palette
 */
const semanticVariantMap: Record<string, number> = {
  solid: 600, // Dark, for text/icons
  subtle: 50, // Light, for backgrounds
  muted: 200, // Slightly muted
  emphasized: 500, // Standard emphasis
  focusRing: 400, // Focus ring color
  light: 300, // Light variant (for neutral.light borders)
};

/**
 * Color aliases - map Chakra color names to our color palette
 */
const colorAliases: Record<string, keyof typeof colors> = {
  orange: "amber", // Chakra's orange maps to our amber
  gray: "neutral", // Gray is an alias for neutral
};

/**
 * Token lookup function to mimic Chakra UI's token API
 * Usage: token("colors.green.solid") => "#16A34A"
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
    if (colorName === "white") return white;
    if (colorName === "black") return black;

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
