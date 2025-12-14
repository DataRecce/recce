"use client";

import type { TextFieldProps as MuiTextFieldProps } from "@mui/material/TextField";
import MuiTextField from "@mui/material/TextField";
import { forwardRef } from "react";

/**
 * Textarea Component - MUI equivalent of Chakra's Textarea
 *
 * A multi-line text input component.
 */

export interface TextareaProps
  extends Omit<MuiTextFieldProps, "ref" | "variant" | "size" | "multiline"> {
  /** Size of the textarea */
  size?: "xs" | "sm" | "md" | "lg";
  /** Chakra variant - maps to MUI variant */
  variant?: "outline" | "filled" | "flushed" | "unstyled";
  /** Whether the textarea is invalid */
  isInvalid?: boolean;
  /** Whether the textarea is disabled */
  isDisabled?: boolean;
  /** Whether the textarea is read-only */
  isReadOnly?: boolean;
  /** Whether the textarea is required */
  isRequired?: boolean;
  /** Number of rows */
  rows?: number;
  /** Minimum number of rows for auto-resize */
  minRows?: number;
  /** Maximum number of rows for auto-resize */
  maxRows?: number;
  /** Flex value for layout */
  flex?: number | string;
  /** Resize behavior (CSS resize property) */
  resize?: "none" | "both" | "horizontal" | "vertical";
  /** Minimum height */
  minH?: string | number;
  /** Background color */
  bg?: string;
  /** Border color */
  borderColor?: string;
  /** Focus styles (Chakra compatibility) */
  _focus?: Record<string, unknown>;
}

const sizeToMui: Record<string, "small" | "medium"> = {
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
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      size = "md",
      variant = "outline",
      isInvalid,
      isDisabled,
      isReadOnly,
      isRequired,
      rows,
      minRows,
      maxRows,
      flex,
      resize,
      minH,
      bg,
      borderColor,
      _focus,
      sx,
      ...props
    },
    ref,
  ) {
    return (
      <MuiTextField
        inputRef={ref}
        multiline
        rows={rows}
        minRows={minRows}
        maxRows={maxRows}
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
          ...(flex !== undefined && { flex }),
          ...(minH !== undefined && {
            "& .MuiInputBase-root": { minHeight: minH },
          }),
          ...(bg && { "& .MuiInputBase-root": { backgroundColor: bg } }),
          ...(borderColor && {
            "& .MuiOutlinedInput-notchedOutline": { borderColor },
          }),
          ...(resize && { "& .MuiInputBase-input": { resize } }),
          ...(_focus && { "&:focus-within": _focus }),
          ...sx,
        }}
        {...props}
      />
    );
  },
);

export default Textarea;
