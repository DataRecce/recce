"use client";

import type { SxProps, Theme } from "@mui/material/styles";
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
  setOpen: (open: boolean) => void;
}

export function useDisclosure(defaultOpen = false): UseDisclosureReturn {
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
 * Maps Chakra colorPalette prop values to MUI color prop values
 *
 * @example
 * ```tsx
 * // Chakra
 * <Button colorPalette="iochmara">Submit</Button>
 *
 * // MUI
 * <Button color={chakraColorToMui("iochmara")}>Submit</Button>
 * ```
 */
export function chakraColorToMui(
  chakraColor: string,
): "primary" | "secondary" | "success" | "warning" | "error" | "inherit" {
  const colorMap: Record<
    string,
    "primary" | "secondary" | "success" | "warning" | "error" | "inherit"
  > = {
    iochmara: "primary",
    blue: "primary",
    cyan: "secondary",
    green: "success",
    amber: "warning",
    red: "error",
    gray: "inherit",
    neutral: "inherit",
  };
  return colorMap[chakraColor] || "primary";
}

/**
 * Maps Chakra button variant to MUI button variant
 *
 * @example
 * ```tsx
 * // Chakra
 * <Button variant="solid">Submit</Button>
 *
 * // MUI
 * <Button variant={chakraVariantToMui("solid")}>Submit</Button>
 * ```
 */
export function chakraButtonVariantToMui(
  chakraVariant: string,
): "contained" | "outlined" | "text" {
  const variantMap: Record<string, "contained" | "outlined" | "text"> = {
    solid: "contained",
    outline: "outlined",
    ghost: "text",
    link: "text",
  };
  return variantMap[chakraVariant] || "contained";
}

/**
 * Maps Chakra size prop to MUI size prop
 *
 * @example
 * ```tsx
 * // Chakra
 * <Button size="md">Submit</Button>
 *
 * // MUI
 * <Button size={chakraSizeToMui("md")}>Submit</Button>
 * ```
 */
export function chakraSizeToMui(
  chakraSize: string,
): "small" | "medium" | "large" {
  const sizeMap: Record<string, "small" | "medium" | "large"> = {
    xs: "small",
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "large",
  };
  return sizeMap[chakraSize] || "medium";
}

/**
 * Converts Chakra spacing value to MUI spacing
 *
 * Chakra uses a scale where 1 = 0.25rem = 4px
 * MUI's default spacing is 8px, so we need to convert
 *
 * @example
 * ```tsx
 * // Chakra: p="4" = 1rem = 16px
 * // MUI: sx={{ p: 2 }} = 16px (with spacing(8))
 * ```
 */
export function chakraSpacingToMui(chakraSpacing: number | string): number {
  if (typeof chakraSpacing === "string") {
    const num = Number.parseFloat(chakraSpacing);
    if (Number.isNaN(num)) return 0;
    // Chakra spacing unit is 4px, MUI default is 4px
    return num;
  }
  return chakraSpacing;
}

/**
 * Common sx prop patterns for layout components
 */
export const layoutSx = {
  /**
   * Center content (replacement for Chakra's Center component)
   */
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  } as SxProps<Theme>,

  /**
   * Flex row with gap (replacement for HStack)
   */
  hStack: (gap = 2): SxProps<Theme> => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap,
  }),

  /**
   * Flex column with gap (replacement for VStack)
   */
  vStack: (gap = 2): SxProps<Theme> => ({
    display: "flex",
    flexDirection: "column",
    gap,
  }),

  /**
   * Spacer (replacement for Chakra's Spacer component)
   */
  spacer: {
    flexGrow: 1,
  } as SxProps<Theme>,

  /**
   * Wrap container (replacement for Chakra's Wrap)
   */
  wrap: (gap = 2): SxProps<Theme> => ({
    display: "flex",
    flexWrap: "wrap",
    gap,
  }),
};

/**
 * Type augmentation for Button color prop to include 'brand'
 */
declare module "@mui/material/Button" {
  interface ButtonPropsColorOverrides {
    brand: true;
  }
}

declare module "@mui/material/IconButton" {
  interface IconButtonPropsColorOverrides {
    brand: true;
  }
}

declare module "@mui/material/Chip" {
  interface ChipPropsColorOverrides {
    brand: true;
  }
}
