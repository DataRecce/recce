/**
 * Type augmentations for MUI components to support custom color palettes
 *
 * These augmentations enable using custom colors (iochmara, cyan, amber, etc.)
 * directly as color props on MUI components, matching the colors defined
 * in mui-theme.ts. The actual color styles are defined via `variants` in
 * the theme's componentOverrides.
 *
 * Usage:
 * ```tsx
 * // Direct MUI usage with custom colors
 * <Button color="iochmara">Primary Action</Button>
 * <CircularProgress color="amber" />
 * <Badge color="green" badgeContent={5}>...</Badge>
 * ```
 */

// Custom color names that match the colors object in mui-theme.ts
type CustomColors =
  | "brand"
  | "iochmara"
  | "cyan"
  | "amber"
  | "green"
  | "red"
  | "rose"
  | "fuchsia"
  | "neutral";

// Helper type to create the color overrides object
type ColorOverrides = { [K in CustomColors]: true };

declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides extends ColorOverrides {}
  interface ButtonPropsSizeOverrides {
    xsmall: true;
  }
}

declare module "@mui/material/ButtonGroup" {
  interface ButtonGroupPropsColorOverrides extends ColorOverrides {}
  interface ButtonGroupPropsSizeOverrides {
    xsmall: true;
  }
}

declare module "@mui/material/IconButton" {
  interface IconButtonPropsColorOverrides extends ColorOverrides {}
  interface IconButtonPropsSizeOverrides {
    xsmall: true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides extends ColorOverrides {}
  interface ChipPropsSizeOverrides {
    xsmall: true;
  }
}

declare module "@mui/material/CircularProgress" {
  interface CircularProgressPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/LinearProgress" {
  interface LinearProgressPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Badge" {
  interface BadgePropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Alert" {
  interface AlertPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Tabs" {
  interface TabsPropsIndicatorColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Switch" {
  interface SwitchPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Checkbox" {
  interface CheckboxPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Radio" {
  interface RadioPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/TextField" {
  interface TextFieldPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Slider" {
  interface SliderPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/ToggleButton" {
  interface ToggleButtonPropsColorOverrides extends ColorOverrides {}
}

declare module "@mui/material/Fab" {
  interface FabPropsColorOverrides extends ColorOverrides {}
  interface FabPropsSizeOverrides {
    xsmall: true;
  }
}

// Empty export to make this file an ES module (required for module augmentations)
export {};
