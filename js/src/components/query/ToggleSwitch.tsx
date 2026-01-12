/**
 * @file ToggleSwitch.tsx
 * @description OSS wrapper for ToggleSwitch and DiffDisplayModeSwitch components
 *
 * This file re-exports the framework-agnostic components from @datarecce/ui.
 * The actual implementations live in @datarecce/ui for use by both
 * Recce OSS and Recce Cloud.
 */

export {
  type DiffDisplayMode,
  DiffDisplayModeSwitch,
  type DiffDisplayModeSwitchProps,
  ToggleSwitch,
  type ToggleSwitchProps,
} from "@datarecce/ui/components/ui";
