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
    | "orange"
    | "red"
    | "gray"
    | "brand";
  /** Chakra variant - maps to MUI variant */
  variant?: "solid" | "subtle" | "outline" | "filled" | "outlined";
  /** Background color (for Chakra compatibility) */
  backgroundColor?: string;
  /** Display */
  display?: string;
  /** Align items */
  alignItems?: string;
  /** Gap */
  gap?: number | string;
  /** Font size */
  fontSize?: string;
  /** Margin right */
  mr?: number | string;
}

const colorPaletteToMui: Record<string, MuiChipProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  orange: "warning",
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
    display,
    alignItems,
    gap,
    fontSize,
    mr,
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
        ...(display && { display }),
        ...(alignItems && { alignItems }),
        ...(gap !== undefined && { gap }),
        ...(fontSize && { fontSize }),
        ...(mr !== undefined && { mr }),
        ...sx,
      }}
      {...props}
    />
  );
});

// Tag compound component support
export interface TagRootProps extends Omit<BoxProps, "ref" | "size"> {
  children?: ReactNode;
  backgroundColor?: string;
  /** Render as child component (Chakra compatibility - prop is accepted but ignored) */
  asChild?: boolean;
  /** Padding X */
  paddingX?: string;
  /** Size */
  size?: "sm" | "md" | "lg";
  /** Color palette - maps to background color */
  colorPalette?: "gray" | "green" | "red" | "blue" | "orange" | "amber" | "cyan";
  /** Border radius */
  borderRadius?: string;
  /** Font size override */
  fontSize?: string;
}

const sizeToFontSize: Record<string, string> = {
  sm: "0.65rem",
  md: "0.75rem",
  lg: "0.875rem",
};

const colorPaletteToTagBg: Record<string, string> = {
  gray: "grey.100",
  green: "success.light",
  red: "error.light",
  blue: "primary.light",
  orange: "warning.light",
  amber: "warning.light",
  cyan: "secondary.light",
};

const TagRoot = forwardRef<HTMLDivElement, TagRootProps>(function TagRoot(
  { children, backgroundColor, asChild, paddingX, size = "md", colorPalette, borderRadius, fontSize, sx, ...props },
  ref,
) {
  // asChild is accepted for API compatibility but not implemented
  // MUI doesn't have the same polymorphic pattern as Chakra
  const bgColor = backgroundColor || (colorPalette ? colorPaletteToTagBg[colorPalette] : "grey.100");

  return (
    <Box
      ref={ref}
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: borderRadius === "full" ? "9999px" : borderRadius || "16px",
        px: paddingX || 1,
        py: 0.25,
        fontSize: fontSize || sizeToFontSize[size] || "0.75rem",
        bgcolor: bgColor,
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

function TagStartElement({ children }: { children?: ReactNode }) {
  return (
    <Box component="span" sx={{ mr: 0.5, display: "flex", alignItems: "center" }}>
      {children}
    </Box>
  );
}

function TagEndElement({ children }: { children?: ReactNode }) {
  return (
    <Box component="span" sx={{ ml: 0.5, display: "flex", alignItems: "center" }}>
      {children}
    </Box>
  );
}

interface TagCloseTriggerProps {
  onClick?: () => void;
}

function TagCloseTrigger({ onClick }: TagCloseTriggerProps) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ml: 0.5,
        p: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: "0.75rem",
        lineHeight: 1,
        "&:hover": {
          opacity: 0.7,
        },
      }}
    >
      &times;
    </Box>
  );
}

// Compound Tag export
export const Tag = Object.assign(Badge, {
  Root: TagRoot,
  Label: TagLabel,
  StartElement: TagStartElement,
  EndElement: TagEndElement,
  CloseTrigger: TagCloseTrigger,
});

export default Badge;
