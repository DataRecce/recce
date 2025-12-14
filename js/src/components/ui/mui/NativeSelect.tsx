"use client";

import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import type { NativeSelectProps as MuiNativeSelectProps } from "@mui/material/NativeSelect";
import MuiNativeSelect from "@mui/material/NativeSelect";
import { forwardRef, type ReactNode } from "react";

/**
 * NativeSelect Component - MUI equivalent of Chakra's NativeSelect
 *
 * A native HTML select element styled with MUI.
 */

// NativeSelect Root
export interface NativeSelectRootProps {
  children?: ReactNode;
  /** Size of the select */
  size?: "sm" | "md" | "lg";
  /** Width */
  width?: string | number;
  /** Whether the select is disabled */
  disabled?: boolean;
}

const NativeSelectRoot = forwardRef<HTMLDivElement, NativeSelectRootProps>(
  function NativeSelectRoot({ children, size = "md", width, disabled }, ref) {
    const muiSize = size === "sm" ? "small" : "medium";

    return (
      <FormControl
        ref={ref}
        size={muiSize}
        disabled={disabled}
        sx={{
          ...(width !== undefined && { width }),
        }}
      >
        {children}
      </FormControl>
    );
  },
);

// NativeSelect Field - The actual select element
export interface NativeSelectFieldProps
  extends Omit<MuiNativeSelectProps, "ref"> {
  children?: ReactNode;
  /** Placeholder text */
  placeholder?: string;
}

const NativeSelectField = forwardRef<HTMLSelectElement, NativeSelectFieldProps>(
  function NativeSelectField({ children, placeholder, ...props }, ref) {
    return (
      <MuiNativeSelect ref={ref} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </MuiNativeSelect>
    );
  },
);

// NativeSelect Label
interface NativeSelectLabelProps {
  children?: ReactNode;
}

function NativeSelectLabel({ children }: NativeSelectLabelProps) {
  return <InputLabel>{children}</InputLabel>;
}

// NativeSelect Indicator - Visual indicator (no-op for MUI, handled internally)
function NativeSelectIndicator() {
  // MUI NativeSelect handles the dropdown indicator internally
  return null;
}

// Compound component type
type NativeSelectWithCompound = typeof NativeSelectRoot & {
  Root: typeof NativeSelectRoot;
  Field: typeof NativeSelectField;
  Label: typeof NativeSelectLabel;
  Indicator: typeof NativeSelectIndicator;
};

// Export compound component
export const NativeSelect = Object.assign(NativeSelectRoot, {
  Root: NativeSelectRoot,
  Field: NativeSelectField,
  Label: NativeSelectLabel,
  Indicator: NativeSelectIndicator,
}) as NativeSelectWithCompound;

export default NativeSelect;
