/**
 * MUI Theme configuration with CSS Variables mode
 *
 * This theme uses MUI 7's CSS Variables mode with `colorSchemeSelector: 'class'`
 * to toggle between light and dark modes using the `.dark` class on the document.
 * This integrates with the ThemeContext which manages the class toggle.
 */

import { createTheme, type ThemeOptions } from "@mui/material/styles";

import { colors } from "./colors";

/**
 * Module augmentation for custom palette colors
 * Extends MUI's palette with brand and iochmara colors
 */
declare module "@mui/material/styles" {
  interface Palette {
    brand: Palette["primary"];
    iochmara: Palette["primary"];
    neutral: Palette["grey"];
  }

  interface PaletteOptions {
    brand?: PaletteOptions["primary"];
    iochmara?: PaletteOptions["primary"];
    neutral?: PaletteOptions["grey"];
  }
}

/**
 * Module augmentation for Button color prop
 * Allows using brand and iochmara as Button colors
 */
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    brand: true;
    iochmara: true;
  }
}

/**
 * Module augmentation for Chip color prop
 * Allows using brand and iochmara as Chip colors
 */
declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    brand: true;
    iochmara: true;
  }
}

/**
 * Module augmentation for Button size prop
 * Adds "xsmall" size variant
 */
declare module "@mui/material/Button" {
  interface ButtonPropsSizeOverrides {
    xsmall: true;
  }
}

/**
 * Module augmentation for Chip size prop
 * Adds "xsmall" size variant
 */
declare module "@mui/material/Chip" {
  interface ChipPropsSizeOverrides {
    xsmall: true;
  }
}

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
      styleOverrides: {
        root: {
          borderRadius: 6,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
        sizeSmall: {
          fontSize: "0.8125rem",
          padding: "4px 10px",
        },
      },
      variants: [
        {
          props: { size: "xsmall" },
          style: {
            fontSize: "0.75rem",
            padding: "2px 8px",
            minHeight: 24,
          },
        },
      ],
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
        sizeSmall: {
          fontSize: "0.75rem",
          height: 24,
        },
      },
      variants: [
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
      ],
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
          light: colors.brand[400],
          main: colors.brand[500],
          dark: colors.brand[700],
          contrastText: "#ffffff",
        },
        secondary: {
          light: colors.iochmara[400],
          main: colors.iochmara[500],
          dark: colors.iochmara[700],
          contrastText: "#ffffff",
        },
        brand: {
          light: colors.brand[400],
          main: colors.brand[500],
          dark: colors.brand[700],
          contrastText: "#ffffff",
        },
        iochmara: {
          light: colors.iochmara[400],
          main: colors.iochmara[500],
          dark: colors.iochmara[700],
          contrastText: "#ffffff",
        },
        neutral: colors.neutral,
        grey: colors.neutral,
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
          light: colors.brand[300],
          main: colors.brand[400],
          dark: colors.brand[600],
          contrastText: "#ffffff",
        },
        secondary: {
          light: colors.iochmara[300],
          main: colors.iochmara[400],
          dark: colors.iochmara[600],
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
        neutral: colors.neutral,
        grey: colors.neutral,
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
          default: colors.neutral[950],
          paper: colors.neutral[900],
        },
        text: {
          primary: colors.neutral[50],
          secondary: colors.neutral[400],
          disabled: colors.neutral[600],
        },
        divider: colors.neutral[800],
      },
    },
  },
  ...sharedThemeOptions,
});

/**
 * Theme type export for consumers who need to type their theme
 */
export type RecceTheme = typeof theme;
