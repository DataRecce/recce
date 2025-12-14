"use client";

import FormControlLabel from "@mui/material/FormControlLabel";
import type { SwitchProps as MuiSwitchProps } from "@mui/material/Switch";
import MuiSwitch from "@mui/material/Switch";
import {
  createContext,
  forwardRef,
  type ReactNode,
  useContext,
  useState,
} from "react";

/**
 * Switch Component - MUI equivalent of Chakra's Switch
 *
 * A toggle switch component with compound component support.
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

// Context for compound components
interface SwitchContextValue {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  size: "small" | "medium";
  color: MuiSwitchProps["color"];
}

const SwitchContext = createContext<SwitchContextValue | null>(null);

function useSwitchContext() {
  return useContext(SwitchContext);
}

// Switch Root - Container for compound components
export interface SwitchRootProps {
  children?: ReactNode;
  /** Whether the switch is checked (controlled) */
  checked?: boolean;
  /** Default checked state (uncontrolled) */
  defaultChecked?: boolean;
  /** Callback when checked state changes */
  onCheckedChange?: (details: { checked: boolean }) => void;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Size of the switch */
  size?: "sm" | "md" | "lg";
  /** Color palette */
  colorPalette?: string;
}

const SwitchRoot = forwardRef<HTMLLabelElement, SwitchRootProps>(
  function SwitchRoot(
    {
      children,
      checked: controlledChecked,
      defaultChecked = false,
      onCheckedChange,
      disabled = false,
      size = "md",
      colorPalette = "iochmara",
    },
    ref,
  ) {
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const handleChange = (newChecked: boolean) => {
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      onCheckedChange?.({ checked: newChecked });
    };

    const muiSize = sizeToMui[size] || "medium";
    const muiColor = colorPaletteToMui[colorPalette] || "primary";

    return (
      <SwitchContext.Provider
        value={{
          checked,
          onChange: handleChange,
          disabled,
          size: muiSize,
          color: muiColor,
        }}
      >
        <label
          ref={ref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {children}
        </label>
      </SwitchContext.Provider>
    );
  },
);

// Switch HiddenInput - Hidden input for accessibility
function SwitchHiddenInput() {
  const ctx = useSwitchContext();
  if (!ctx) return null;
  // MUI Switch handles this internally
  return null;
}

// Switch Control - The actual switch element
function SwitchControl() {
  const ctx = useSwitchContext();
  if (!ctx) return null;

  return (
    <MuiSwitch
      checked={ctx.checked}
      onChange={(e) => ctx.onChange(e.target.checked)}
      disabled={ctx.disabled}
      size={ctx.size}
      color={ctx.color}
    />
  );
}

// Switch Label - Label text
interface SwitchLabelProps {
  children?: ReactNode;
}

function SwitchLabel({ children }: SwitchLabelProps) {
  return <span>{children}</span>;
}

// Switch Thumb - The toggle button (no-op, MUI handles this internally)
function SwitchThumb() {
  return null;
}

// Basic Switch Component
const SwitchBase = forwardRef<HTMLButtonElement, SwitchProps>(
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

// Compound Switch type
type SwitchWithCompound = typeof SwitchBase & {
  Root: typeof SwitchRoot;
  HiddenInput: typeof SwitchHiddenInput;
  Control: typeof SwitchControl;
  Label: typeof SwitchLabel;
  Thumb: typeof SwitchThumb;
};

// Export compound component
export const Switch = Object.assign(SwitchBase, {
  Root: SwitchRoot,
  HiddenInput: SwitchHiddenInput,
  Control: SwitchControl,
  Label: SwitchLabel,
  Thumb: SwitchThumb,
}) as SwitchWithCompound;

export default Switch;
