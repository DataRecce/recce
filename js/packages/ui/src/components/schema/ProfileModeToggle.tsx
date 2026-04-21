"use client";

import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import type { ProfileMode } from "../../hooks";

export interface ProfileModeToggleProps {
  value: ProfileMode;
  onChange: (mode: ProfileMode) => void;
}

const MODES: { mode: ProfileMode; label: string; tooltip: string }[] = [
  { mode: "wide", label: "Wide", tooltip: "Wide: full base/current columns" },
  { mode: "strip", label: "Strip", tooltip: "Strip: compact 5-square indicator" },
  { mode: "grid", label: "Grid", tooltip: "Grid: card gallery per column" },
];

/**
 * 3-way segmented control for choosing how inline-profile data is rendered.
 * Sits in the SchemaView header. Only rendered when inline profile is active.
 */
export function ProfileModeToggle({ value, onChange }: ProfileModeToggleProps) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      onChange={(_, next: ProfileMode | null) => {
        if (next && next !== value) onChange(next);
      }}
      aria-label="Profile render mode"
    >
      {MODES.map(({ mode, label, tooltip }) => (
        <Tooltip key={mode} title={tooltip} arrow>
          <ToggleButton value={mode} aria-label={label}>
            {label}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
