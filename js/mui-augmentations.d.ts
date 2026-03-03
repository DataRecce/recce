/**
 * MUI Module Augmentations for custom palette colors and component variants
 *
 * This declaration file extends MUI's type system with custom colors:
 * - brand, iochmara, cyan, amber, green, red, rose, fuchsia, neutral
 *
 * The `import type {}` statements establish the connection to the existing
 * MUI modules so TypeScript knows we're augmenting rather than replacing them.
 */

import type {} from "@mui/material/styles";
import type {} from "@mui/material/Button";
import type {} from "@mui/material/Chip";
import type {} from "@mui/material/Badge";
import type {} from "@mui/material/CircularProgress";

// Palette augmentations
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
    neutral: Palette["primary"];
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
    neutral?: PaletteOptions["primary"];
  }
}

// Button augmentations
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    brand: true;
    iochmara: true;
    cyan: true;
    amber: true;
    green: true;
    red: true;
    rose: true;
    fuchsia: true;
    neutral: true;
  }

  interface ButtonPropsSizeOverrides {
    xsmall: true;
  }
}

// Chip augmentations
declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    brand: true;
    iochmara: true;
    cyan: true;
    amber: true;
    green: true;
    red: true;
    rose: true;
    fuchsia: true;
    neutral: true;
  }

  interface ChipPropsSizeOverrides {
    xsmall: true;
  }
}

// Badge augmentations
declare module "@mui/material/Badge" {
  interface BadgePropsColorOverrides {
    brand: true;
    iochmara: true;
    cyan: true;
    amber: true;
    green: true;
    red: true;
    rose: true;
    fuchsia: true;
    neutral: true;
  }
}

// CircularProgress augmentations
declare module "@mui/material/CircularProgress" {
  interface CircularProgressPropsColorOverrides {
    brand: true;
    iochmara: true;
    cyan: true;
    amber: true;
    green: true;
    red: true;
    rose: true;
    fuchsia: true;
    neutral: true;
  }
}
