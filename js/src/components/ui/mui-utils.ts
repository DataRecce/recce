"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback, useState } from "react";

/**
 * Migration Utilities for Chakra UI to MUI
 *
 * This file contains utility functions and hooks to assist with
 * the migration from Chakra UI to MUI.
 */

/**
 * useDisclosure - Hook to manage boolean state for disclosure components
 *
 * Replaces Chakra's useDisclosure hook with identical API.
 *
 * @example
 * ```tsx
 * // Chakra
 * const { open, onOpen, onClose, onToggle } = useDisclosure();
 *
 * // MUI (using this hook)
 * const { open, onOpen, onClose, onToggle } = useDisclosure();
 * ```
 */
export interface UseDisclosureReturn {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onToggle: () => void;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

export function useDisclosure(
  options: boolean | { defaultOpen?: boolean } = false,
): UseDisclosureReturn {
  const defaultOpen =
    typeof options === "boolean" ? options : (options.defaultOpen ?? false);
  const [open, setOpen] = useState(defaultOpen);

  const onOpen = useCallback(() => setOpen(true), []);
  const onClose = useCallback(() => setOpen(false), []);
  const onToggle = useCallback(() => setOpen((prev) => !prev), []);

  return {
    open,
    onOpen,
    onClose,
    onToggle,
    setOpen,
  };
}

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
