"use client";

import type { TextFieldProps as MuiTextFieldProps } from "@mui/material/TextField";
import MuiTextField from "@mui/material/TextField";
import { forwardRef } from "react";

/**
 * Input Component - MUI equivalent of Chakra's Input
 *
 * A text input field component.
 */

export interface InputProps
  extends Omit<MuiTextFieldProps, "ref" | "variant" | "size"> {
  /** Size of the input */
  size?: "2xs" | "xs" | "sm" | "md" | "lg";
  /** Chakra variant - maps to MUI variant */
  variant?: "outline" | "filled" | "flushed" | "unstyled" | "subtle";
  /** Whether the input is invalid */
  isInvalid?: boolean;
  /** Whether the input is disabled */
  isDisabled?: boolean;
  /** Whether the input is read-only */
  isReadOnly?: boolean;
  /** Whether the input is required */
  isRequired?: boolean;
  /** Width of the input */
  width?: string | number;
  /** Height of the input */
  height?: string | number;
  /** Font size */
  fontSize?: string | number;
}

const sizeToMui: Record<string, "small" | "medium"> = {
  "2xs": "small",
  xs: "small",
  sm: "small",
  md: "medium",
  lg: "medium",
};

const variantToMui: Record<string, MuiTextFieldProps["variant"]> = {
  outline: "outlined",
  filled: "filled",
  flushed: "standard",
  unstyled: "standard",
  subtle: "standard",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = "md",
    variant = "outline",
    isInvalid,
    isDisabled,
    isReadOnly,
    isRequired,
    height,
    fontSize,
    sx,
    ...props
  },
  ref,
) {
  return (
    <MuiTextField
      inputRef={ref}
      size={sizeToMui[size] || "medium"}
      variant={variantToMui[variant] || "outlined"}
      error={isInvalid}
      disabled={isDisabled}
      slotProps={{
        input: {
          readOnly: isReadOnly,
        },
      }}
      required={isRequired}
      sx={{
        ...(height !== undefined && { "& .MuiInputBase-root": { height } }),
        ...(fontSize !== undefined && { "& .MuiInputBase-input": { fontSize } }),
        ...sx,
      }}
      {...props}
    />
  );
});

export default Input;
