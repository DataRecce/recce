"use client";

import MuiFormControlLabel from "@mui/material/FormControlLabel";
import MuiRadio from "@mui/material/Radio";
import type { RadioGroupProps as MuiRadioGroupProps } from "@mui/material/RadioGroup";
import MuiRadioGroup from "@mui/material/RadioGroup";
import { forwardRef, type ReactNode } from "react";

/**
 * RadioGroup Components - MUI equivalent of Chakra's RadioGroup compound components
 */

// RadioGroup Root
export interface RadioGroupRootProps
  extends Omit<MuiRadioGroupProps, "ref" | "onChange"> {
  children?: ReactNode;
  /** Callback when value changes */
  onValueChange?: (details: { value: string }) => void;
}

export const RadioGroupRoot = forwardRef<HTMLDivElement, RadioGroupRootProps>(
  function RadioGroupRoot({ children, onValueChange, ...props }, ref) {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange?.({ value: event.target.value });
    };

    return (
      <MuiRadioGroup ref={ref} onChange={handleChange} {...props}>
        {children}
      </MuiRadioGroup>
    );
  },
);

// RadioGroup Item
export interface RadioGroupItemProps {
  children?: ReactNode;
  value: string;
  disabled?: boolean;
}

export const RadioGroupItem = forwardRef<HTMLLabelElement, RadioGroupItemProps>(
  function RadioGroupItem({ children, value, disabled }, ref) {
    return (
      <MuiFormControlLabel
        ref={ref}
        value={value}
        control={<MuiRadio />}
        label={children}
        disabled={disabled}
      />
    );
  },
);

// RadioGroup Item Hidden Input - For Chakra compatibility
export const RadioGroupItemHiddenInput = () => null;

// RadioGroup Item Indicator - For Chakra compatibility
export const RadioGroupItemIndicator = () => null;

// RadioGroup Item Text
export interface RadioGroupItemTextProps {
  children?: ReactNode;
}

export const RadioGroupItemText = forwardRef<
  HTMLSpanElement,
  RadioGroupItemTextProps
>(function RadioGroupItemText({ children }, ref) {
  return <span ref={ref}>{children}</span>;
});

// Combined RadioGroup namespace
export const RadioGroup = {
  Root: RadioGroupRoot,
  Item: RadioGroupItem,
  ItemHiddenInput: RadioGroupItemHiddenInput,
  ItemIndicator: RadioGroupItemIndicator,
  ItemText: RadioGroupItemText,
};

export default RadioGroup;
