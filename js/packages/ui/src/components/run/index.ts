"use client";

/**
 * @file run/index.ts
 * @description Run component exports including primitives, types, and extensible registry.
 *
 * This module provides:
 * - Run primitives (RunList, RunProgress, RunStatusBadge, RunToolbar)
 * - Extensible registry for run types (createRunTypeRegistry, defaultRunTypeConfig)
 * - Shared types for run forms and result views
 */

// ============================================================================
// Run Primitives - Pure Presentation Components
// ============================================================================

export {
  RunList,
  RunListItem,
  type RunListItemData,
  type RunListItemProps,
  type RunListProps,
} from "./RunList";
export { RunListOss } from "./RunListOss";
export { RunModal, type RunModalProps } from "./RunModal";
export {
  RunModalOss,
  type RunModalProps as RunModalOssProps,
} from "./RunModalOss";
export {
  RunProgress,
  RunProgressOverlay,
  type RunProgressOverlayProps,
  type RunProgressProps,
  type RunProgressVariant,
} from "./RunProgress";
export {
  type AddToCheckButtonProps,
  type CSVExportProps,
  type RunResultExportMenuProps,
  RunResultPane,
  type RunResultPaneProps,
  type RunResultPaneTabValue,
  type RunResultShareMenuProps,
  type SingleEnvironmentNotificationProps,
  type SqlEditorProps,
} from "./RunResultPane";
export { RunResultPaneOss } from "./RunResultPaneOss";
export {
  formatRunDate,
  formatRunDateTime,
  inferRunStatus,
  type RunStatus,
  RunStatusAndDate,
  type RunStatusAndDateProps,
  RunStatusBadge,
  type RunStatusBadgeProps,
  RunStatusWithDate,
  type RunStatusWithDateProps,
} from "./RunStatusBadge";
export {
  type DiffViewOptions,
  RunToolbar,
  type RunToolbarProps,
} from "./RunToolbar";
export {
  type ErrorBoundaryWrapperProps,
  RunView,
  type RunViewProps,
} from "./RunView";
export { RunViewOss, type RunViewOssProps } from "./RunViewOss";

// ============================================================================
// Registry - Run Type Configuration
// ============================================================================

export {
  createBoundFindByRunType,
  createRunTypeRegistry,
  defaultRunTypeConfig,
  findByRunType,
  type RunRegistry,
  registry,
} from "./registry";

// ============================================================================
// Types - Shared Types for Run Components
// ============================================================================

export type {
  IconComponent,
  PartialRunTypeRegistry,
  RefTypes,
  RegistryEntry,
  RunFormParamTypes,
  RunFormProps,
  RunResultViewProps,
  RunResultViewRef,
  RunTypeConfig,
  RunTypeRegistry,
  ViewOptionTypes,
} from "./types";
