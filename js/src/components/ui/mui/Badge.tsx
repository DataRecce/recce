"use client";

import type { ChipProps as MuiChipProps } from "@mui/material/Chip";
import MuiChip from "@mui/material/Chip";
import { forwardRef, type ReactNode } from "react";

/**
 * Badge/Tag Component - MUI equivalent of Chakra's Badge/Tag
 *
 * Uses MUI Chip component which provides similar functionality.
 */

export interface BadgeProps
  extends Omit<MuiChipProps, "ref" | "children" | "variant"> {
  /** Content to display (used as label) */
  children?: ReactNode;
  /** Chakra colorPalette - maps to MUI color */
  colorPalette?:
    | "iochmara"
    | "blue"
    | "cyan"
    | "green"
    | "amber"
    | "red"
    | "gray"
    | "brand";
  /** Chakra variant - maps to MUI variant */
  variant?: "solid" | "subtle" | "outline" | "filled" | "outlined";
}

const colorPaletteToMui: Record<string, MuiChipProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  red: "error",
  gray: "default",
  brand: "primary",
};

const variantToMui: Record<string, MuiChipProps["variant"]> = {
  solid: "filled",
  subtle: "filled",
  outline: "outlined",
  filled: "filled",
  outlined: "outlined",
};

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(function Badge(
  { children, colorPalette = "gray", variant = "filled", label, ...props },
  ref,
) {
  const muiColor = colorPaletteToMui[colorPalette] || "default";
  const muiVariant = variantToMui[variant] || "filled";

  return (
    <MuiChip
      ref={ref}
      color={muiColor}
      variant={muiVariant}
      label={label || children}
      size="small"
      {...props}
    />
  );
});

// Alias for Tag (same component in Chakra)
export const Tag = Badge;

export default Badge;
