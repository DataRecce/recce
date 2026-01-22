/**
 * @file viewOptionsHandlers.ts
 * @description Factory functions for creating view options change handlers.
 *
 * These utilities eliminate duplicate callback patterns across result view components
 * (ProfileResultView, QueryResultView, QueryDiffResultView, ValueDiffDetailResultView).
 *
 * Usage:
 * ```tsx
 * const onColumnsRenderModeChanged = createColumnsRenderModeHandler(
 *   viewOptions,
 *   onViewOptionsChanged
 * );
 *
 * const handlePinnedColumnsChanged = createPinnedColumnsHandler(
 *   viewOptions,
 *   onViewOptionsChanged
 * );
 * ```
 */

import type { ColumnRenderMode } from "../api";

/**
 * Base view options interface that includes columnsRenderMode
 */
interface ViewOptionsWithColumnsRenderMode {
  columnsRenderMode?: Record<string, ColumnRenderMode>;
}

/**
 * Base view options interface that includes pinned_columns
 */
interface ViewOptionsWithPinnedColumns {
  pinned_columns?: string[];
}

/**
 * Creates a handler for column render mode changes.
 *
 * @param viewOptions - Current view options object
 * @param onViewOptionsChanged - Callback to update view options
 * @returns Handler function that merges new render modes with existing ones
 *
 * @example
 * ```tsx
 * const handler = createColumnsRenderModeHandler(viewOptions, onViewOptionsChanged);
 * // Use in grid configuration:
 * { onColumnsRenderModeChanged: handler }
 * ```
 */
export function createColumnsRenderModeHandler<
  T extends ViewOptionsWithColumnsRenderMode,
>(
  viewOptions: T | undefined,
  onViewOptionsChanged: ((options: T) => void) | undefined,
): (cols: Record<string, ColumnRenderMode>) => void {
  return (cols: Record<string, ColumnRenderMode>) => {
    const newRenderModes = {
      ...(viewOptions?.columnsRenderMode ?? {}),
      ...cols,
    };
    if (onViewOptionsChanged) {
      onViewOptionsChanged({
        ...viewOptions,
        columnsRenderMode: newRenderModes,
      } as T);
    }
  };
}

/**
 * Creates a handler for pinned columns changes.
 *
 * @param viewOptions - Current view options object
 * @param onViewOptionsChanged - Callback to update view options
 * @returns Handler function that updates pinned_columns in view options
 *
 * @example
 * ```tsx
 * const handler = createPinnedColumnsHandler(viewOptions, onViewOptionsChanged);
 * // Use in grid configuration:
 * { onPinnedColumnsChange: handler }
 * ```
 */
export function createPinnedColumnsHandler<
  T extends ViewOptionsWithPinnedColumns,
>(
  viewOptions: T | undefined,
  onViewOptionsChanged: ((options: T) => void) | undefined,
): (pinnedColumns: string[]) => void {
  return (pinnedColumns: string[]) => {
    if (onViewOptionsChanged) {
      onViewOptionsChanged({
        ...viewOptions,
        pinned_columns: pinnedColumns,
      } as T);
    }
  };
}
