"use client";

// Components barrel export
// Re-exports all UI components from @datarecce/ui

// Lineage visualization components
export type {
  LineageCanvasProps,
  LineageViewProps,
  LineageViewRef,
} from "./lineage";
export { LineageCanvas, LineageView } from "./lineage";
// UI primitives
export type { DiffTextProps, SplitProps, SquareIconProps } from "./ui";
export { DiffText, HSplit, SquareIcon, VSplit } from "./ui";
// High-level view components (Layer 3)
export type {
  ChecksViewProps,
  NavItem,
  RecceLayoutProps,
  RunsViewProps,
} from "./views";
export { ChecksView, RecceLayout, RunsView } from "./views";
