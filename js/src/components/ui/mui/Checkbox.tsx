"use client";

import type { BoxProps } from "@mui/material/Box";
import Box from "@mui/material/Box";
import type { CheckboxProps as MuiCheckboxProps } from "@mui/material/Checkbox";
import MuiCheckbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useState,
} from "react";

/**
 * Checkbox Component - MUI equivalent of Chakra's Checkbox
 *
 * A checkbox input component with optional label.
 * Supports both simple usage and compound pattern.
 */

// Context for compound pattern
interface CheckboxContextValue {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size: "xs" | "sm" | "md" | "lg";
}

const CheckboxContext = createContext<CheckboxContextValue | null>(null);

function useCheckboxContext() {
  return useContext(CheckboxContext);
}

export interface CheckboxProps
  extends Omit<MuiCheckboxProps, "ref" | "size" | "color"> {
  /** Label for the checkbox */
  children?: ReactNode;
  /** Size of the checkbox */
  size?: "xs" | "sm" | "md" | "lg";
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
  xs: "small",
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

const CheckboxSimple = forwardRef<HTMLButtonElement, CheckboxProps>(
  function CheckboxSimple(
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

// Compound pattern components
export interface CheckboxRootProps extends Omit<BoxProps, "ref" | "onChange"> {
  children?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (details: { checked: boolean }) => void;
  size?: "xs" | "sm" | "md" | "lg";
}

const CheckboxRoot = forwardRef<HTMLDivElement, CheckboxRootProps>(
  function CheckboxRoot(
    {
      children,
      checked,
      defaultChecked,
      onCheckedChange,
      size = "md",
      sx,
      ...props
    },
    ref,
  ) {
    const [internalChecked, setInternalChecked] = useState(
      defaultChecked ?? false,
    );
    const isControlled = checked !== undefined;
    const currentChecked = isControlled ? checked : internalChecked;

    const handleChange = (newChecked: boolean) => {
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      onCheckedChange?.({ checked: newChecked });
    };

    return (
      <CheckboxContext.Provider
        value={{ checked: currentChecked, onChange: handleChange, size }}
      >
        <Box
          ref={ref}
          component="label"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            cursor: "pointer",
            ...sx,
          }}
          {...props}
        >
          {children}
        </Box>
      </CheckboxContext.Provider>
    );
  },
);

function CheckboxHiddenInput() {
  // Hidden input is handled by MUI Checkbox internally
  return null;
}

function CheckboxControl() {
  const context = useCheckboxContext();
  if (!context) return null;

  const muiSize = sizeToMui[context.size] || "small";

  return (
    <MuiCheckbox
      checked={context.checked}
      onChange={(e) => context.onChange(e.target.checked)}
      size={muiSize}
      sx={{ p: 0, mr: 0.5 }}
    />
  );
}

interface CheckboxLabelProps {
  children?: ReactNode;
  fontWeight?: string | number;
  pt?: string | number;
}

function CheckboxLabel({ children, fontWeight, pt }: CheckboxLabelProps) {
  const context = useCheckboxContext();
  const fontSize = context?.size === "xs" ? "0.75rem" : "0.875rem";

  return (
    <Box
      component="span"
      sx={{
        fontSize,
        ...(fontWeight && { fontWeight }),
        ...(pt && { pt }),
      }}
    >
      {children}
    </Box>
  );
}

// Combined export with compound pattern
export const Checkbox = Object.assign(CheckboxSimple, {
  Root: CheckboxRoot,
  HiddenInput: CheckboxHiddenInput,
  Control: CheckboxControl,
  Label: CheckboxLabel,
});

export default Checkbox;
