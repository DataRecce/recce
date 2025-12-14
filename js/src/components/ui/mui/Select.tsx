"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import type { SelectProps as MuiSelectProps } from "@mui/material/Select";
import MuiSelect from "@mui/material/Select";
import { forwardRef, type ReactNode } from "react";

/**
 * Select Component - MUI equivalent of Chakra's Select
 *
 * A select/dropdown component.
 */

export interface SelectProps
  extends Omit<MuiSelectProps, "ref" | "size" | "variant"> {
  /** Size of the select */
  size?: "xs" | "sm" | "md" | "lg";
  /** Chakra variant - maps to MUI variant */
  variant?: "outline" | "filled" | "flushed" | "unstyled";
  /** Whether the select is invalid */
  isInvalid?: boolean;
  /** Whether the select is disabled */
  isDisabled?: boolean;
  /** Whether the select is read-only */
  isReadOnly?: boolean;
  /** Whether the select is required */
  isRequired?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Root props for the wrapper element */
  rootProps?: React.ComponentProps<typeof FormControl>;
}

const sizeToMui: Record<string, "small" | "medium"> = {
  xs: "small",
  sm: "small",
  md: "medium",
  lg: "medium",
};

const variantToMui: Record<string, MuiSelectProps["variant"]> = {
  outline: "outlined",
  filled: "filled",
  flushed: "standard",
  unstyled: "standard",
};

export const Select = forwardRef<HTMLDivElement, SelectProps>(function Select(
  {
    size = "md",
    variant = "outline",
    isInvalid,
    isDisabled,
    isReadOnly,
    isRequired,
    placeholder,
    label,
    children,
    rootProps,
    ...props
  },
  ref,
) {
  const muiSize = sizeToMui[size] || "medium";
  const muiVariant = variantToMui[variant] || "outlined";

  return (
    <FormControl
      ref={ref}
      size={muiSize}
      variant={muiVariant}
      error={isInvalid}
      disabled={isDisabled}
      required={isRequired}
      {...rootProps}
    >
      {label && <InputLabel>{label}</InputLabel>}
      <MuiSelect
        label={label}
        readOnly={isReadOnly}
        displayEmpty={!!placeholder}
        {...props}
      >
        {placeholder && (
          <MenuItem value="" disabled>
            {placeholder}
          </MenuItem>
        )}
        {children}
      </MuiSelect>
    </FormControl>
  );
});

// Re-export MenuItem for convenience
export { MenuItem as SelectItem };

export default Select;
