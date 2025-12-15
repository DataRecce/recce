"use client";

import CircularProgress from "@mui/material/CircularProgress";
import type { IconButtonProps as MuiIconButtonProps } from "@mui/material/IconButton";
import MuiIconButton from "@mui/material/IconButton";
import { forwardRef, type ReactNode } from "react";

/**
 * IconButton Component - MUI equivalent of Chakra's IconButton
 *
 * A button component designed to hold only an icon.
 */

export interface IconButtonProps
  extends Omit<MuiIconButtonProps, "ref" | "size"> {
  children?: ReactNode;
  /** Size of the button - Chakra sizes map to MUI */
  size?: "2xs" | "xs" | "sm" | "md" | "lg" | "small" | "medium" | "large";
  /** Chakra colorPalette - maps to MUI color */
  colorPalette?:
    | "iochmara"
    | "blue"
    | "cyan"
    | "green"
    | "amber"
    | "red"
    | "gray"
    | "neutral"
    | "brand";
  /** Loading state */
  loading?: boolean;
  /** Icon element to render */
  icon?: ReactNode;
  /** Accessibility label (required for icon-only buttons) */
  "aria-label": string;
  /** Visual variant */
  variant?: "ghost" | "outline" | "solid" | "plain";
  /** Padding top */
  pt?: string | number;
  /** Padding */
  p?: string | number;
  /** Border radius */
  rounded?: string;
  /** Margin left */
  ml?: string | number;
  /** Width */
  width?: string | number;
  /** Height */
  height?: string | number;
  /** Display */
  display?: string;
}

const colorPaletteToMui: Record<string, MuiIconButtonProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  red: "error",
  gray: "default",
  neutral: "default",
  brand: "primary",
};

const sizeToMui: Record<string, MuiIconButtonProps["size"]> = {
  "2xs": "small",
  xs: "small",
  sm: "small",
  md: "medium",
  lg: "large",
  small: "small",
  medium: "medium",
  large: "large",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      children,
      size = "md",
      colorPalette = "gray",
      loading = false,
      icon,
      disabled,
      pt,
      p,
      rounded,
      ml,
      width,
      height,
      display,
      sx,
      ...props
    },
    ref,
  ) {
    const muiColor = colorPaletteToMui[colorPalette] || "default";
    const muiSize = sizeToMui[size] || "medium";

    return (
      <MuiIconButton
        ref={ref}
        color={muiColor}
        size={muiSize}
        disabled={disabled || loading}
        sx={{
          ...(pt !== undefined && { pt }),
          ...(p !== undefined && { p }),
          ...(rounded && {
            borderRadius: rounded === "full" ? 9999 : rounded,
          }),
          ...(ml !== undefined && { ml }),
          ...(width !== undefined && { width }),
          ...(height !== undefined && { height }),
          ...(display && { display }),
          ...sx,
        }}
        {...props}
      >
        {loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          icon || children
        )}
      </MuiIconButton>
    );
  },
);

export default IconButton;
