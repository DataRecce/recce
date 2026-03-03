"use client";

/**
 * @file ChangedOnlyCheckbox.tsx
 * @description Checkbox component for filtering to show only changed rows
 *
 * Framework-agnostic component that works with both Recce OSS and Cloud.
 */

import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

// ============================================================================
// Types
// ============================================================================

export interface ChangedOnlyCheckboxProps {
  /** Whether the changed-only filter is enabled */
  changedOnly?: boolean;
  /** Callback when the checkbox state changes */
  onChange: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A checkbox component for filtering diff results to show only changed rows.
 *
 * @example
 * ```tsx
 * <ChangedOnlyCheckbox
 *   changedOnly={viewOptions.changed_only}
 *   onChange={() => setChangedOnly(!viewOptions.changed_only)}
 * />
 * ```
 */
export function ChangedOnlyCheckbox({
  changedOnly,
  onChange,
}: ChangedOnlyCheckboxProps) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={changedOnly ?? false}
          onChange={() => {
            onChange();
          }}
          size="small"
        />
      }
      label="Changed only"
      slotProps={{
        typography: { variant: "body2" },
      }}
    />
  );
}
