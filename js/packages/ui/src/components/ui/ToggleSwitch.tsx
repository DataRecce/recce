"use client";

/**
 * @file ToggleSwitch.tsx
 * @description Toggle switch component for switching between two values
 *
 * Framework-agnostic toggle switch that works with both Recce OSS and Cloud.
 */

import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";

// ============================================================================
// Types
// ============================================================================

export interface ToggleSwitchProps {
  /** Current toggle state */
  value: boolean;
  /** Callback when toggle state changes */
  onChange: (value: boolean) => void;
  /** Label for the "on" state */
  textOn?: string;
  /** Label for the "off" state */
  textOff?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A toggle switch component that allows switching between two values.
 *
 * @example
 * ```tsx
 * <ToggleSwitch
 *   value={isEnabled}
 *   onChange={setIsEnabled}
 *   textOff="Inline"
 *   textOn="Side by side"
 * />
 * ```
 */
export function ToggleSwitch({
  value,
  onChange,
  textOn,
  textOff,
}: ToggleSwitchProps) {
  return (
    <ButtonGroup variant="outlined" size="xsmall" sx={{ borderRadius: 1 }}>
      <Button
        onClick={() => {
          onChange(false);
        }}
        sx={{
          color: !value ? "text.primary" : "text.disabled",
          bgcolor: !value ? "background.paper" : "action.hover",
          borderColor: "divider",
          "&:hover": {
            bgcolor: !value ? "background.paper" : "action.selected",
            borderColor: "divider",
          },
        }}
      >
        {textOff ?? "Off"}
      </Button>
      <Button
        onClick={() => {
          onChange(true);
        }}
        sx={{
          color: value ? "text.primary" : "text.disabled",
          bgcolor: value ? "background.paper" : "action.hover",
          borderColor: "divider",
          "&:hover": {
            bgcolor: value ? "background.paper" : "action.selected",
            borderColor: "divider",
          },
        }}
      >
        {textOn ?? "On"}
      </Button>
    </ButtonGroup>
  );
}
