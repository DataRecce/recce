"use client";

import type { ReactNode, Ref } from "react";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";

/**
 * Ref types supported by ResultView components
 */
export type ResultViewRef = DataGridHandle | HTMLDivElement;

/**
 * Screenshot wrapper types
 */
export type ScreenshotWrapperType = "grid" | "box";

/**
 * Warning display styles for the toolbar area.
 *
 * - 'alert': MUI Alert with severity="warning" (default)
 * - 'amber': Amber-colored inline warning with icon (matches QueryResultView pattern)
 */
export type WarningStyle = "alert" | "amber";

/**
 * Base props for all ResultView components
 */
export interface ResultViewProps<TViewOptions = unknown> {
  run: unknown;
  viewOptions?: TViewOptions;
  onViewOptionsChanged?: (options: TViewOptions) => void;
}

/**
 * Configuration for the createResultView factory
 */
export interface ResultViewConfig<
  TRun,
  TViewOptions = unknown,
  _TRef extends ResultViewRef = DataGridHandle,
> {
  displayName: string;
  typeGuard: (run: unknown) => run is TRun;
  expectedRunType: string;
  screenshotWrapper: ScreenshotWrapperType;
  transformData: (
    run: TRun,
    options: ResultViewTransformOptions<TViewOptions>,
  ) => ResultViewData | null;
  emptyState?: ReactNode | string;
  conditionalEmptyState?: (
    run: TRun,
    viewOptions?: TViewOptions,
  ) => ReactNode | null;
}

/**
 * Options passed to transformData
 */
export interface ResultViewTransformOptions<TViewOptions> {
  viewOptions?: TViewOptions;
  onViewOptionsChanged?: (options: TViewOptions) => void;

  /**
   * Callback when user wants to add run to checklist.
   * Passed through from component props.
   */
  onAddToChecklist?: (run: unknown) => void;
}

/**
 * Result of transformData
 */
export interface ResultViewData {
  columns?: unknown[];
  rows?: unknown[];
  content?: ReactNode;
  isEmpty?: boolean;

  /**
   * Custom empty message to show when isEmpty is true.
   * When provided along with toolbar/warnings, shows toolbar above this message.
   * Enables "toolbar-in-empty-state" pattern for components like ValueDiffDetailResultView.
   */
  emptyMessage?: ReactNode;

  // Header/Footer support for additional content above/below main content
  header?: ReactNode; // Rendered ABOVE grid/content, inside outer Box
  footer?: ReactNode; // Rendered BELOW grid/content, outside ScreenshotBox

  /**
   * Toolbar controls to render above the content.
   * Renders on the right side of the toolbar area.
   */
  toolbar?: ReactNode;

  /**
   * Warning messages to display in the toolbar area.
   * Renders as alert chips on the left side.
   */
  warnings?: string[];

  /**
   * Style for rendering warnings.
   * - 'alert' (default): MUI Alert with severity="warning"
   * - 'amber': Amber-colored inline warning with icon (like QueryResultView)
   */
  warningStyle?: WarningStyle;

  // When true, component returns null (renders nothing)
  // Use for cases where original component returned null instead of empty state
  renderNull?: boolean;

  /**
   * Default column options for grid wrapper.
   * Passed to ScreenshotDataGrid's defaultColumnOptions prop.
   */
  defaultColumnOptions?: {
    resizable?: boolean;
    maxWidth?: number;
    minWidth?: number;
  };

  /**
   * Custom message for grid's empty rows state (when rows array exists but is empty).
   * Passed to EmptyRowsRenderer in ScreenshotDataGrid.
   */
  noRowsMessage?: string;
}

/**
 * Props for factory-created ResultView components
 */
export interface CreatedResultViewProps<TViewOptions = unknown>
  extends ResultViewProps<TViewOptions> {
  ref?: Ref<ResultViewRef>;

  /**
   * Callback when user wants to add run to checklist.
   * Used by QueryResultView.
   */
  onAddToChecklist?: (run: unknown) => void;
}
