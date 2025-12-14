"use client";

import type { FormControlProps } from "@mui/material/FormControl";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import { forwardRef, type ReactNode } from "react";

/**
 * Field Component - MUI equivalent of Chakra's Field
 *
 * A wrapper component for form inputs that provides label, helper text, and error handling.
 */

export interface FieldProps extends Omit<FormControlProps, "ref"> {
  /** Label for the field */
  label?: ReactNode;
  /** Helper text displayed below the input */
  helperText?: ReactNode;
  /** Error message (displayed when invalid) */
  errorText?: ReactNode;
  /** Whether the field is invalid */
  isInvalid?: boolean;
  /** Whether the field is disabled */
  isDisabled?: boolean;
  /** Whether the field is required */
  isRequired?: boolean;
  /** Whether the field is read-only */
  isReadOnly?: boolean;
  /** Children (form input) */
  children?: ReactNode;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  {
    label,
    helperText,
    errorText,
    isInvalid,
    isDisabled,
    isRequired,
    isReadOnly,
    children,
    ...props
  },
  ref,
) {
  return (
    <FormControl
      ref={ref}
      error={isInvalid}
      disabled={isDisabled}
      required={isRequired}
      {...props}
    >
      {label && <FormLabel>{label}</FormLabel>}
      {children}
      {(isInvalid && errorText) || helperText ? (
        <FormHelperText>{isInvalid ? errorText : helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
});

// Sub-components for compound pattern compatibility
export const FieldLabel = FormLabel;
export const FieldHelperText = FormHelperText;
export const FieldErrorText = FormHelperText;

export default Field;
