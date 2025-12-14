"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
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
  /** Background color (for Chakra compatibility) */
  backgroundColor?: string;
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
  {
    children,
    colorPalette = "gray",
    variant = "filled",
    label,
    backgroundColor,
    sx,
    ...props
  },
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
      sx={{
        ...(backgroundColor && { bgcolor: backgroundColor }),
        ...sx,
      }}
      {...props}
    />
  );
});

// Tag compound component support
export interface TagRootProps extends Omit<BoxProps, "ref"> {
  children?: ReactNode;
  backgroundColor?: string;
}

const TagRoot = forwardRef<HTMLDivElement, TagRootProps>(function TagRoot(
  { children, backgroundColor, sx, ...props },
  ref,
) {
  return (
    <Box
      ref={ref}
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "16px",
        px: 1,
        py: 0.25,
        fontSize: "0.75rem",
        bgcolor: backgroundColor || "grey.100",
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  );
});

function TagLabel({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

// Compound Tag export
export const Tag = Object.assign(Badge, {
  Root: TagRoot,
  Label: TagLabel,
});

export default Badge;
