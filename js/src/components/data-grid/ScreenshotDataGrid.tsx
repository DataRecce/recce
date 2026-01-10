/**
 * @file ScreenshotDataGrid.tsx
 * @description Recce-specific AG Grid wrapper with PII tracking safety
 *
 * This is a thin wrapper around @datarecce/ui's ScreenshotDataGrid that adds
 * Recce-specific PII tracking safety classes.
 *
 * @deprecated For new code, consider importing directly from @datarecce/ui/primitives
 * and explicitly passing containerClassName="no-track-pii-safe" rowClassName="no-track-pii-safe"
 */

"use client";

// AG Grid custom styles for data grids (includes query/diff grid styles)
import "./agGridStyles.css";

import {
  EmptyRowsRenderer as BaseEmptyRowsRenderer,
  ScreenshotDataGrid as BaseScreenshotDataGrid,
  type ScreenshotDataGridProps as BaseScreenshotDataGridProps,
  type ColDef,
  type ColGroupDef,
  type DataGridHandle,
  type DataGridRow,
  type EmptyRowsRendererProps,
  type GetRowIdParams,
  type GridReadyEvent,
} from "@datarecce/ui/primitives";
import React, { forwardRef, type Ref } from "react";

// Re-export types and components from @datarecce/ui
export type {
  ColDef,
  ColGroupDef,
  DataGridHandle,
  GetRowIdParams,
  GridReadyEvent,
};
export { BaseEmptyRowsRenderer as EmptyRowsRenderer };
export type { EmptyRowsRendererProps };

// For backward compatibility with existing imports
export type { DataGridHandle as RecceDataGridHandle };

// Props type (use base type)
export type ScreenshotDataGridProps<TData = DataGridRow> =
  BaseScreenshotDataGridProps<TData>;

/**
 * Recce-specific AG Grid wrapper with PII tracking safety classes
 *
 * This wrapper adds the "no-track-pii-safe" class to both the container
 * and row elements for PII tracking compliance.
 */
function _ScreenshotDataGrid<TData = DataGridRow>(
  props: ScreenshotDataGridProps<TData>,
  ref: Ref<DataGridHandle>,
) {
  return (
    <BaseScreenshotDataGrid<TData>
      {...props}
      ref={ref}
      containerClassName="no-track-pii-safe"
      rowClassName="no-track-pii-safe"
    />
  );
}

export const ScreenshotDataGrid = forwardRef(_ScreenshotDataGrid) as <
  TData = DataGridRow,
>(
  props: ScreenshotDataGridProps<TData> & { ref?: Ref<DataGridHandle> },
) => React.ReactNode;
