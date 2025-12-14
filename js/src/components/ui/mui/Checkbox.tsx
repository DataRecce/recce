"use client";

import type { CheckboxProps as MuiCheckboxProps } from "@mui/material/Checkbox";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { forwardRef, type ReactNode } from "react";

/**
 * Checkbox Component - MUI equivalent of Chakra's Checkbox
 *
 * A checkbox input component with optional label.
 */

export interface CheckboxProps
  extends Omit<MuiCheckboxProps, "ref" | "size" | "color"> {
  /** Label for the checkbox */
  children?: ReactNode;
  /** Size of the checkbox */
  size?: "sm" | "md" | "lg";
  /** Chakra colorPalette - maps to MUI color */
  colorPalette?:
    | "iochmara"
    | "blue"
    | "cyan"
    | "green"
    | "amber"
    | "red"
    | "gray";
  /** Whether the checkbox is checked (controlled) */
  isChecked?: boolean;
  /** Whether the checkbox is disabled */
  isDisabled?: boolean;
  /** Whether the checkbox is indeterminate */
  isIndeterminate?: boolean;
  /** Whether the checkbox is invalid */
  isInvalid?: boolean;
  /** Whether the checkbox is required */
  isRequired?: boolean;
}

const sizeToMui: Record<string, "small" | "medium"> = {
  sm: "small",
  md: "medium",
  lg: "medium",
};

const colorPaletteToMui: Record<string, MuiCheckboxProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  red: "error",
  gray: "default",
};

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  function Checkbox(
    {
      children,
      size = "md",
      colorPalette = "iochmara",
      isChecked,
      isDisabled,
      isIndeterminate,
      isInvalid,
      isRequired,
      ...props
    },
    ref,
  ) {
    const muiSize = sizeToMui[size] || "medium";
    const muiColor = colorPaletteToMui[colorPalette] || "primary";

    const checkbox = (
      <MuiCheckbox
        ref={ref}
        size={muiSize}
        color={isInvalid ? "error" : muiColor}
        checked={isChecked}
        disabled={isDisabled}
        indeterminate={isIndeterminate}
        required={isRequired}
        {...props}
      />
    );

    if (children) {
      return (
        <FormControlLabel
          control={checkbox}
          label={children}
          disabled={isDisabled}
        />
      );
    }

    return checkbox;
  },
);

export default Checkbox;
