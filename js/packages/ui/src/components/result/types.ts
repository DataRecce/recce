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
}

/**
 * Result of transformData
 */
export interface ResultViewData {
  columns?: unknown[];
  rows?: unknown[];
  content?: ReactNode;
  isEmpty?: boolean;
}

/**
 * Props for factory-created ResultView components
 */
export interface CreatedResultViewProps<TViewOptions = unknown>
  extends ResultViewProps<TViewOptions> {
  ref?: Ref<ResultViewRef>;
}
