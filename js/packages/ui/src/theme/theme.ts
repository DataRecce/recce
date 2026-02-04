/**
 * MUI Theme configuration with CSS Variables mode
 *
 * This theme uses MUI 7's CSS Variables mode with `colorSchemeSelector: 'class'`
 * to toggle between light and dark modes using the `.dark` class on the document.
 * This integrates with the ThemeContext which manages the class toggle.
 *
 * Color values and component variants are aligned with the main Recce theme at
 * ui/src/components/ui/mui-theme.ts for consistency.
 */

import { createTheme, type ThemeOptions } from "@mui/material/styles";

import { colors } from "./colors";

// Custom color names type for variant generation
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

// Type for color scales with numeric keys (50, 100, 200, etc.)
interface ColorScale {
  readonly [key: number]: string;
  readonly 50: string;
  readonly 100: string;
  readonly 200: string;
  readonly 300: string;
  readonly 400: string;
  readonly 500: string;
  readonly 600: string;
  readonly 700: string;
  readonly 800: string;
  readonly 900: string;
  readonly 950: string;
}

/**
 * Helper to generate button color variants for a given color
 * Creates contained, outlined, and text variant styles
 *
 * Uses the `&&` selector pattern to increase CSS specificity, ensuring our
 * custom color variant styles override MUI's default outlined/text button styles.
 * MUI's default styles have high specificity that would otherwise win the cascade.
 *
 * @see https://mui.com/material-ui/customization/theme-components/#specificity
 */
function createButtonColorVariants<T extends CustomColorName>(
  colorName: T,
  colorScale: ColorScale,
) {
  return [
    // Contained variant (solid) - uses CSS variables for light/dark mode
    {
      props: { color: colorName, variant: "contained" as const },
      style: {
        backgroundColor: `var(--mui-palette-${colorName}-main, ${colorScale[500]})`,
        color: `var(--mui-palette-${colorName}-contrastText, #ffffff)`,
        "&:hover": {
          backgroundColor: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
        },
      },
    },
    // Outlined variant - uses && for higher specificity over MUI defaults
    {
      props: { color: colorName, variant: "outlined" as const },
      style: {
        // && increases specificity to override MUI's default outlined styles
        "&&": {
          borderColor: `var(--mui-palette-${colorName}-main, ${colorScale[500]})`,
          color: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
        },
        "&:hover": {
          borderColor: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
          backgroundColor: `color-mix(in srgb, var(--mui-palette-${colorName}-light, ${colorScale[50]}) 30%, transparent)`,
        },
      },
    },
    // Text variant (ghost) - uses && for higher specificity over MUI defaults
    {
      props: { color: colorName, variant: "text" as const },
      style: {
        // && increases specificity to override MUI's default text styles
        "&&": {
          color: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
        },
        "&:hover": {
          backgroundColor: `color-mix(in srgb, var(--mui-palette-${colorName}-light, ${colorScale[50]}) 30%, transparent)`,
        },
      },
    },
  ];
}

/**
 * Helper to generate Chip color variants
 * Uses CSS variables for automatic light/dark mode support
 *
 * Uses the `&&` selector pattern for outlined variant to ensure our custom
 * color styles override MUI's default chip outlined styles.
 */
function createChipColorVariants<T extends CustomColorName>(
  colorName: T,
  colorScale: ColorScale,
) {
  return [
    // Filled variant - uses CSS variables for light/dark mode
    {
      props: { color: colorName, variant: "filled" as const },
      style: {
        backgroundColor: `var(--mui-palette-${colorName}-main, ${colorScale[500]})`,
        color: `var(--mui-palette-${colorName}-contrastText, #ffffff)`,
        "&:hover": {
          backgroundColor: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
        },
        "&.MuiChip-clickable:hover": {
          backgroundColor: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
        },
      },
    },
    // Outlined variant - uses && for higher specificity over MUI defaults
    {
      props: { color: colorName, variant: "outlined" as const },
      style: {
        // && increases specificity to override MUI's default outlined styles
        "&&": {
          borderColor: `var(--mui-palette-${colorName}-main, ${colorScale[500]})`,
          color: `var(--mui-palette-${colorName}-dark, ${colorScale[600]})`,
        },
        "&:hover": {
          backgroundColor: `color-mix(in srgb, var(--mui-palette-${colorName}-light, ${colorScale[50]}) 25%, transparent)`,
        },
      },
    },
  ];
}

/**
 * Helper to generate Badge color variants
 * Uses CSS variables for automatic light/dark mode support
 */
function createBadgeColorVariant<T extends CustomColorName>(
  colorName: T,
  colorScale: ColorScale,
) {
  return [
    {
      props: { color: colorName },
      style: {
        "& .MuiBadge-badge": {
          backgroundColor: `var(--mui-palette-${colorName}-main, ${colorScale[500]})`,
          color: `var(--mui-palette-${colorName}-contrastText, #ffffff)`,
        },
      },
    },
  ];
}

/**
 * Helper to generate CircularProgress color variants
 * Uses CSS variables for automatic light/dark mode support
 */
function createProgressColorVariant<T extends CustomColorName>(
  colorName: T,
  colorScale: ColorScale,
) {
  return [
    {
      props: { color: colorName },
      style: {
        color: `var(--mui-palette-${colorName}-main, ${colorScale[500]})`,
      },
    },
  ];
}

// Generate all button color variants
const buttonColorVariants = [
  ...createButtonColorVariants("brand", colors.brand),
  ...createButtonColorVariants("iochmara", colors.iochmara),
  ...createButtonColorVariants("cyan", colors.cyan),
  ...createButtonColorVariants("amber", colors.amber),
  ...createButtonColorVariants("green", colors.green),
  ...createButtonColorVariants("red", colors.red),
  ...createButtonColorVariants("rose", colors.rose),
  ...createButtonColorVariants("fuchsia", colors.fuchsia),
  ...createButtonColorVariants("neutral", colors.neutral),
];

// Generate all chip color variants
const chipColorVariants = [
  ...createChipColorVariants("brand", colors.brand),
  ...createChipColorVariants("iochmara", colors.iochmara),
  ...createChipColorVariants("cyan", colors.cyan),
  ...createChipColorVariants("amber", colors.amber),
  ...createChipColorVariants("green", colors.green),
  ...createChipColorVariants("red", colors.red),
  ...createChipColorVariants("rose", colors.rose),
  ...createChipColorVariants("fuchsia", colors.fuchsia),
  ...createChipColorVariants("neutral", colors.neutral),
];

// Generate all badge color variants
const badgeColorVariants = [
  ...createBadgeColorVariant("brand", colors.brand),
  ...createBadgeColorVariant("iochmara", colors.iochmara),
];

// Generate all progress color variants
const progressColorVariants = [
  ...createProgressColorVariant("brand", colors.brand),
  ...createProgressColorVariant("iochmara", colors.iochmara),
];

// Module augmentations are in js/mui-augmentations.d.ts (included via tsconfig)

/**
 * System font stack for optimal cross-platform rendering
 */
const systemFontStack = [
  "-apple-system",
  "BlinkMacSystemFont",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
].join(",");

/**
 * Shared theme options for both light and dark modes
 */
const sharedThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: systemFontStack,
    // Slightly smaller default sizes for data-dense UIs
    fontSize: 14,
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: {
      textTransform: "none", // No uppercase for buttons
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 8, // Rounded corners
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true, // Match Chakra's flat button style
      },
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: "none",
          textTransform: "none",
          fontWeight: 500,
          "&:hover": {
            boxShadow: "none",
          },
        },
        sizeSmall: {
          fontSize: "0.8125rem",
          padding: "4px 10px",
        },
        sizeMedium: {
          padding: "0.5rem 1rem",
          fontSize: "1rem",
        },
        sizeLarge: {
          padding: "0.75rem 1.5rem",
          fontSize: "1.125rem",
        },
        contained: {
          "&:hover": {
            boxShadow: "none",
          },
        },
        outlined: {
          borderWidth: "1px",
          "&:hover": {
            borderWidth: "1px",
          },
        },
      },
      variants: [
        // Size variant: xsmall
        {
          props: { size: "xsmall" },
          style: {
            fontSize: "0.75rem",
            padding: "2px 8px",
            minHeight: 24,
          },
        },
        // Color variants for brand and iochmara
        ...buttonColorVariants,
      ],
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
        },
        sizeSmall: {
          fontSize: "0.75rem",
          height: 24,
        },
        sizeMedium: {
          height: 32,
          fontSize: "0.875rem",
        },
      },
      variants: [
        // Size variant: xsmall
        {
          props: { size: "xsmall" },
          style: {
            fontSize: "0.6875rem",
            height: 20,
            "& .MuiChip-label": {
              padding: "0 6px",
            },
          },
        },
        // Color variants for brand and iochmara
        ...chipColorVariants,
      ],
    },
    MuiBadge: {
      variants: [
        // Color variants for brand and iochmara
        ...badgeColorVariants,
      ],
      styleOverrides: {
        badge: {
          fontWeight: 500,
          fontSize: "0.75rem",
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
          backgroundColor: "var(--mui-palette-success-light)",
          color: "var(--mui-palette-success-dark)",
          "& .MuiAlert-icon": {
            color: "var(--mui-palette-success-dark)",
          },
        },
        standardWarning: {
          backgroundColor: "var(--mui-palette-warning-light)",
          color: "var(--mui-palette-warning-dark)",
          "& .MuiAlert-icon": {
            color: "var(--mui-palette-warning-dark)",
          },
        },
        standardError: {
          backgroundColor: "var(--mui-palette-error-light)",
          color: "var(--mui-palette-error-dark)",
          "& .MuiAlert-icon": {
            color: "var(--mui-palette-error-dark)",
          },
        },
        standardInfo: {
          backgroundColor: "var(--mui-palette-info-light)",
          color: "var(--mui-palette-info-dark)",
          "& .MuiAlert-icon": {
            color: "var(--mui-palette-info-dark)",
          },
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
    MuiCircularProgress: {
      defaultProps: {
        color: "primary",
      },
      variants: [
        // Color variants for brand and iochmara
        ...progressColorVariants,
      ],
    },
    // Link overrides
    MuiLink: {
      defaultProps: {
        underline: "hover",
      },
      styleOverrides: {
        root: {
          fontWeight: 500,
          color: "var(--mui-palette-secondary-main)",
          textDecorationColor: "var(--mui-palette-secondary-light)",
          "&:hover": {
            color: "var(--mui-palette-secondary-dark)",
          },
        },
      },
    },
    // Popover overrides
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 8,
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        },
      },
    },
    // Divider overrides
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: "var(--mui-palette-divider)",
        },
      },
    },
    // Breadcrumbs overrides
    MuiBreadcrumbs: {
      styleOverrides: {
        separator: {
          color: "var(--mui-palette-text-secondary)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow:
            "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none", // Remove default gradient
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: "0.75rem",
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
    // OutlinedInput overrides
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-secondary-light)",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "var(--mui-palette-secondary-main)",
            borderWidth: 2,
          },
        },
        notchedOutline: {
          borderColor: "var(--mui-palette-divider)",
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
            "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: "0.875rem",
          padding: "0.5rem 0.75rem",
          "&:hover": {
            backgroundColor: "var(--mui-palette-action-hover)",
          },
          "&.Mui-selected": {
            backgroundColor: "var(--mui-palette-action-selected)",
            "&:hover": {
              backgroundColor: "var(--mui-palette-action-selected)",
            },
          },
        },
      },
    },
    // Autocomplete overrides
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 6,
          boxShadow:
            "0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
          backgroundColor: colors.neutral[200],
          ".dark &": {
            backgroundColor: colors.neutral[700],
          },
        },
        listbox: {
          padding: "4px 0",
        },
        option: {
          fontSize: "0.875rem",
          padding: "0.5rem 0.75rem",
          '&[aria-selected="true"]': {
            backgroundColor: "var(--mui-palette-action-selected)",
          },
          "&.Mui-focused": {
            backgroundColor: "var(--mui-palette-action-hover)",
          },
        },
      },
    },
  },
};

/**
 * MUI Theme with CSS Variables mode enabled
 *
 * Uses `colorSchemeSelector: 'class'` to switch themes via `.dark` class,
 * which is toggled by the ThemeContext provider.
 *
 * Usage:
 * ```tsx
 * import { ThemeProvider } from '@mui/material/styles';
 * import { theme } from '@datarecce/ui/theme';
 *
 * <ThemeProvider theme={theme}>
 *   <App />
 * </ThemeProvider>
 * ```
 */
export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class", // Use .dark class for dark mode
  },
  colorSchemes: {
    light: {
      palette: {
        mode: "light",
        primary: {
          main: colors.iochmara[500],
          light: colors.iochmara[300],
          dark: colors.iochmara[600],
          contrastText: "#ffffff",
        },
        secondary: {
          main: colors.cyan[500],
          light: colors.cyan[400],
          dark: colors.cyan[600],
          contrastText: "#ffffff",
        },
        brand: {
          light: colors.brand[400],
          main: colors.brand[500],
          dark: colors.brand[600],
          contrastText: "#ffffff",
        },
        iochmara: {
          light: colors.iochmara[400],
          main: colors.iochmara[500],
          dark: colors.iochmara[600],
          contrastText: "#ffffff",
        },
        cyan: {
          main: colors.cyan[500],
          light: colors.cyan[300],
          dark: colors.cyan[600],
          contrastText: "#ffffff",
        },
        amber: {
          main: colors.amber[500],
          light: colors.amber[300],
          dark: colors.amber[600],
          contrastText: "#ffffff",
        },
        green: {
          main: colors.green[500],
          light: colors.green[300],
          dark: colors.green[600],
          contrastText: "#ffffff",
        },
        red: {
          main: colors.red[500],
          light: colors.red[300],
          dark: colors.red[600],
          contrastText: "#ffffff",
        },
        rose: {
          main: colors.rose[500],
          light: colors.rose[300],
          dark: colors.rose[600],
          contrastText: "#ffffff",
        },
        fuchsia: {
          main: colors.fuchsia[500],
          light: colors.fuchsia[300],
          dark: colors.fuchsia[600],
          contrastText: "#ffffff",
        },
        neutral: {
          main: colors.neutral[600],
          light: colors.neutral[300],
          dark: colors.neutral[700],
          contrastText: "#ffffff",
        },
        grey: colors.neutral, // Color scale (50, 100, etc.) - MUI's built-in grey
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
        info: colors.info,
        background: {
          default: "#ffffff",
          paper: colors.neutral[50],
        },
        text: {
          primary: colors.neutral[900],
          secondary: colors.neutral[600],
          disabled: colors.neutral[400],
        },
        divider: colors.neutral[200],
      },
    },
    dark: {
      palette: {
        mode: "dark",
        primary: {
          main: colors.iochmara[500],
          light: colors.iochmara[300],
          dark: colors.iochmara[600],
          contrastText: "#ffffff",
        },
        secondary: {
          main: colors.cyan[500],
          light: colors.cyan[400],
          dark: colors.cyan[600],
          contrastText: "#ffffff",
        },
        brand: {
          light: colors.brand[300],
          main: colors.brand[400],
          dark: colors.brand[600],
          contrastText: "#ffffff",
        },
        iochmara: {
          light: colors.iochmara[300],
          main: colors.iochmara[400],
          dark: colors.iochmara[600],
          contrastText: "#ffffff",
        },
        cyan: {
          main: colors.cyan[400],
          light: colors.cyan[300],
          dark: colors.cyan[600],
          contrastText: "#ffffff",
        },
        amber: {
          main: colors.amber[400],
          light: colors.amber[300],
          dark: colors.amber[600],
          contrastText: "#000000",
        },
        green: {
          main: colors.green[400],
          light: colors.green[300],
          dark: colors.green[600],
          contrastText: "#ffffff",
        },
        red: {
          main: colors.red[400],
          light: colors.red[300],
          dark: colors.red[600],
          contrastText: "#ffffff",
        },
        rose: {
          main: colors.rose[400],
          light: colors.rose[300],
          dark: colors.rose[600],
          contrastText: "#ffffff",
        },
        fuchsia: {
          main: colors.fuchsia[400],
          light: colors.fuchsia[300],
          dark: colors.fuchsia[600],
          contrastText: "#ffffff",
        },
        neutral: {
          main: colors.neutral[400],
          light: colors.neutral[300],
          dark: colors.neutral[200],
          contrastText: colors.neutral[900],
        },
        grey: colors.neutral, // Color scale (50, 100, etc.) - MUI's built-in grey
        success: {
          light: colors.success.light,
          main: colors.success.main,
          dark: colors.success.dark,
          contrastText: "#000000",
        },
        warning: {
          light: colors.warning.light,
          main: colors.warning.main,
          dark: colors.warning.dark,
          contrastText: "#000000",
        },
        error: {
          light: colors.error.light,
          main: colors.error.main,
          dark: colors.error.dark,
          contrastText: "#ffffff",
        },
        info: {
          light: colors.info.light,
          main: colors.info.main,
          dark: colors.info.dark,
          contrastText: "#ffffff",
        },
        background: {
          default: colors.neutral[900],
          paper: colors.neutral[800],
        },
        text: {
          primary: colors.neutral[50],
          secondary: colors.neutral[400],
          disabled: colors.neutral[600],
        },
        divider: colors.neutral[700],
      },
    },
  },
  ...sharedThemeOptions,
});

/**
 * Theme type export for consumers who need to type their theme
 */
export type RecceTheme = typeof theme;
