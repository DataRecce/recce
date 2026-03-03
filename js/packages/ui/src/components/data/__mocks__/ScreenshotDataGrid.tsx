/**
 * @file ScreenshotDataGrid mock for Vitest
 * @description Manual mock that renders a testable div with data attributes
 */

import React, { forwardRef, useImperativeHandle } from "react";
import { vi } from "vitest";

/**
 * Mock DataGridHandle for ref testing
 */
export interface DataGridHandle {
  api: unknown | null;
  element: HTMLElement | null;
}

/**
 * Props for ScreenshotDataGrid mock
 * Simplified props without index signature to avoid children type conflicts
 */
interface ScreenshotDataGridProps {
  columns?: unknown[];
  rows?: unknown[];
  children?: React.ReactNode;
}

/**
 * Mock ScreenshotDataGrid component
 * Renders a simple div with data-testid="screenshot-data-grid-mock"
 */
export const ScreenshotDataGrid = forwardRef<
  DataGridHandle,
  ScreenshotDataGridProps
>(function MockScreenshotDataGrid({ columns, rows, children }, ref) {
  // Expose mock methods via ref
  useImperativeHandle(ref, () => ({
    api: null,
    element: null,
  }));

  const columnCount = Array.isArray(columns) ? columns.length : 0;
  const rowCount = Array.isArray(rows) ? rows.length : 0;

  return (
    <div
      data-testid="screenshot-data-grid-mock"
      data-columns={JSON.stringify(columnCount)}
      data-rows={JSON.stringify(rowCount)}
    >
      {children ?? `Mock Grid: ${rowCount} rows, ${columnCount} columns`}
    </div>
  );
});

/**
 * Empty rows renderer mock
 */
export const EmptyRowsRenderer = () => null;
