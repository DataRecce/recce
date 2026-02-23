"use client";

/**
 * @file DiffDisplayModeSwitch.tsx
 * @description Switch component for toggling between inline and side-by-side diff display modes
 *
 * Framework-agnostic component that works with both Recce OSS and Cloud.
 */

import { DiffText } from "./DiffText";
import { ToggleSwitch } from "./ToggleSwitch";

// ============================================================================
// Types
// ============================================================================

export type DiffDisplayMode = "inline" | "side_by_side";

export interface DiffDisplayModeSwitchProps {
  /** Current display mode */
  displayMode: DiffDisplayMode;
  /** Callback when display mode changes */
  onDisplayModeChanged: (displayMode: DiffDisplayMode) => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * A switch component for toggling between inline and side-by-side diff display modes.
 *
 * When in inline mode, also shows color legend (Base = orange, Current = blue).
 *
 * @example
 * ```tsx
 * <DiffDisplayModeSwitch
 *   displayMode="inline"
 *   onDisplayModeChanged={(mode) => setDisplayMode(mode)}
 * />
 * ```
 */
export function DiffDisplayModeSwitch({
  displayMode,
  onDisplayModeChanged,
}: DiffDisplayModeSwitchProps) {
  return (
    <>
      {displayMode === "inline" && (
        <>
          <DiffText
            value="Base"
            colorPalette="orange"
            grayOut={false}
            fontSize="10pt"
            noCopy
          />
          <DiffText
            value="Current"
            colorPalette="iochmara"
            grayOut={false}
            fontSize="10pt"
            noCopy
          />
        </>
      )}
      <ToggleSwitch
        value={displayMode === "side_by_side"}
        onChange={(value) => {
          onDisplayModeChanged(value ? "side_by_side" : "inline");
        }}
        textOff="Inline"
        textOn="Side by side"
      />
    </>
  );
}
