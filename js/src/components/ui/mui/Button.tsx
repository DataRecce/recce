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

export interface ButtonProps
  extends Omit<MuiButtonProps, "ref" | "size" | "variant" | "color"> {
  children?: ReactNode;
  /** Size of the button - Chakra sizes map to MUI */
  size?:
    | "xs"
    | "2xs"
    | "sm"
    | "md"
    | "lg"
    | "xl"
    | "small"
    | "medium"
    | "large";
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
  /** Margin right */
  mr?: number | string;
  /** Margin left */
  ml?: number | string;
  /** Margin top */
  mt?: number | string;
  /** Margin bottom */
  mb?: number | string;
  /** Margin end (logical margin-right in LTR) */
  me?: number | string;
  /** Background color */
  bgColor?: string;
  /** Background color (alias) */
  backgroundColor?: string;
  /** Text/icon color */
  color?: string;
  /** Width */
  width?: string | number;
  /** Padding */
  padding?: string | number;
  /** Padding top */
  paddingTop?: string | number;
  /** Font size */
  fontSize?: string | number;
  /** Justify content */
  justifyContent?: string;
  /** Visual variant - supports both Chakra and MUI names */
  variant?:
    | "solid"
    | "outline"
    | "ghost"
    | "link"
    | "subtle"
    | "contained"
    | "outlined"
    | "text";
  /** Flex shorthand */
  flex?: string | number;
  /** White space */
  whiteSpace?: string;
  /** Display */
  display?: string;
  /** Min width */
  minWidth?: string | number;
  /** Margin top (long form) */
  marginTop?: string | number;
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
  subtle: "text",
};

const sizeToMui: Record<string, MuiButtonProps["size"]> = {
  "2xs": "small",
  xs: "small",
  sm: "small",
  md: "medium",
  lg: "large",
  xl: "large",
  small: "small",
  medium: "medium",
  large: "large",
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
      size = "md",
      disabled,
      mr,
      ml,
      mt,
      mb,
      me,
      bgColor,
      backgroundColor,
      color,
      width,
      padding,
      paddingTop,
      fontSize,
      justifyContent,
      flex,
      whiteSpace,
      display,
      minWidth,
      marginTop,
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
    const muiSize = sizeToMui[size] || "medium";

    return (
      <MuiButton
        ref={ref}
        variant={muiVariant as MuiButtonProps["variant"]}
        color={muiColor}
        size={muiSize}
        disabled={disabled || loading}
        startIcon={
          loading ? <CircularProgress size={16} color="inherit" /> : leftIcon
        }
        endIcon={!loading ? rightIcon : undefined}
        sx={{
          ...(mr !== undefined && { mr }),
          ...(ml !== undefined && { ml }),
          ...(mt !== undefined && { mt }),
          ...(mb !== undefined && { mb }),
          ...(me !== undefined && { marginInlineEnd: me }),
          ...(bgColor !== undefined && { backgroundColor: bgColor }),
          ...(backgroundColor !== undefined && { backgroundColor }),
          ...(color !== undefined && { color }),
          ...(width !== undefined && { width }),
          ...(padding !== undefined && { padding }),
          ...(paddingTop !== undefined && { paddingTop }),
          ...(fontSize !== undefined && { fontSize }),
          ...(justifyContent !== undefined && { justifyContent }),
          ...(flex !== undefined && { flex }),
          ...(whiteSpace !== undefined && { whiteSpace }),
          ...(display !== undefined && { display }),
          ...(minWidth !== undefined && { minWidth }),
          ...(marginTop !== undefined && { marginTop }),
          ...sx,
        }}
        {...props}
      >
        {loading && loadingText ? loadingText : children}
      </MuiButton>
    );
  },
);

export default Button;
