"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import type { SwitchProps as MuiSwitchProps } from "@mui/material/Switch";
import MuiSwitch from "@mui/material/Switch";
import { forwardRef, type ReactNode } from "react";

/**
 * Switch Component - MUI equivalent of Chakra's Switch
 *
 * A toggle switch component.
 */

export interface SwitchProps
  extends Omit<MuiSwitchProps, "ref" | "size" | "color"> {
  /** Label for the switch */
  children?: ReactNode;
  /** Size of the switch */
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
  /** Whether the switch is checked (controlled) */
  isChecked?: boolean;
  /** Whether the switch is disabled */
  isDisabled?: boolean;
  /** Whether the switch is required */
  isRequired?: boolean;
}

const sizeToMui: Record<string, "small" | "medium"> = {
  sm: "small",
  md: "medium",
  lg: "medium",
};

const colorPaletteToMui: Record<string, MuiSwitchProps["color"]> = {
  iochmara: "primary",
  blue: "primary",
  cyan: "secondary",
  green: "success",
  amber: "warning",
  red: "error",
  gray: "default",
};

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      children,
      size = "md",
      colorPalette = "iochmara",
      isChecked,
      isDisabled,
      isRequired,
      ...props
    },
    ref,
  ) {
    const muiSize = sizeToMui[size] || "medium";
    const muiColor = colorPaletteToMui[colorPalette] || "primary";

    const switchElement = (
      <MuiSwitch
        ref={ref}
        size={muiSize}
        color={muiColor}
        checked={isChecked}
        disabled={isDisabled}
        required={isRequired}
        {...props}
      />
    );

    if (children) {
      return (
        <FormControlLabel
          control={switchElement}
          label={children}
          disabled={isDisabled}
        />
      );
    }

    return switchElement;
  },
);

export default Switch;
