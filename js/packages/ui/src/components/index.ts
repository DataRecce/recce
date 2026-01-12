"use client";

// Components barrel export
// Re-exports all UI components from @datarecce/ui

// Histogram result views
export type { HistogramDiffRun, HistogramResultViewProps } from "./histogram";
export { HistogramDiffResultView } from "./histogram";
// Lineage visualization components
export type {
  LineageCanvasProps,
  LineageViewProps,
  LineageViewRef,
} from "./lineage";
export { LineageCanvas, LineageView } from "./lineage";
// Notification components
export type { NotificationProps } from "./notifications";
export { LineageViewNotification } from "./notifications";
// Profile result views
export type {
  ProfileDiffRun,
  ProfileResultViewProps,
  ProfileRun,
} from "./profile";
export { ProfileDiffResultView, ProfileResultView } from "./profile";
// Row count result views
export type {
  RowCountDiffRun,
  RowCountResultViewProps,
  RowCountRun,
} from "./rowcount";
export { RowCountDiffResultView, RowCountResultView } from "./rowcount";
// Top-K diff result views
export type { TopKDiffResultViewProps, TopKDiffRun } from "./top-k";
export { TopKDiffResultView } from "./top-k";
// UI primitives
export type {
  ChangedOnlyCheckboxProps,
  DiffDisplayMode,
  DiffDisplayModeSwitchProps,
  DiffTextProps,
  SplitProps,
  SquareIconProps,
  ToggleSwitchProps,
} from "./ui";
export {
  ChangedOnlyCheckbox,
  DiffDisplayModeSwitch,
  DiffText,
  HSplit,
  SquareIcon,
  ToggleSwitch,
  VSplit,
} from "./ui";
// Value diff result views
export type {
  ValueDiffDetailResultViewProps,
  ValueDiffDetailRun,
  ValueDiffDetailViewOptions,
} from "./valuediff";
export { ValueDiffDetailResultView } from "./valuediff";
// High-level view components (Layer 3)
export type {
  ChecksViewProps,
  NavItem,
  RecceLayoutProps,
  RunsViewProps,
} from "./views";
export { ChecksView, RecceLayout, RunsView } from "./views";
