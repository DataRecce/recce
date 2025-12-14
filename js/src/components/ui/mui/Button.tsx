"use client";

import type { ButtonProps as MuiButtonProps } from "@mui/material/Button";
import MuiButton from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import { forwardRef, type ReactNode } from "react";

/**
 * Button Component - MUI equivalent of Chakra's Button
 *
 * A button component with Chakra-compatible props.
 */

export interface ButtonProps extends Omit<MuiButtonProps, "ref"> {
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
    | "neutral"
    | "brand";
  /** Loading state */
  loading?: boolean;
  /** Loading text shown while loading */
  loadingText?: string;
  /** Icon displayed before button text */
  leftIcon?: ReactNode;
  /** Icon displayed after button text */
  rightIcon?: ReactNode;
}

const colorPaletteToMui: Record<string, MuiButtonProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  red: "error",
  gray: "inherit",
  neutral: "inherit",
  brand: "primary", // Will use brand color from theme
};

const chakraVariantToMui: Record<string, MuiButtonProps["variant"]> = {
  solid: "contained",
  outline: "outlined",
  ghost: "text",
  link: "text",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      colorPalette = "gray",
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      variant = "contained",
      disabled,
      sx,
      ...props
    },
    ref,
  ) {
    const muiColor = colorPaletteToMui[colorPalette] || "inherit";
    // Map Chakra variant names if provided as strings
    const muiVariant =
      typeof variant === "string"
        ? chakraVariantToMui[variant] || variant
        : variant;

    return (
      <MuiButton
        ref={ref}
        variant={muiVariant as MuiButtonProps["variant"]}
        color={muiColor}
        disabled={disabled || loading}
        startIcon={
          loading ? <CircularProgress size={16} color="inherit" /> : leftIcon
        }
        endIcon={!loading ? rightIcon : undefined}
        sx={sx}
        {...props}
      >
        {loading && loadingText ? loadingText : children}
      </MuiButton>
    );
  },
);

export default Button;
