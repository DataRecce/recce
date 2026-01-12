/**
 * @file ValueDiffDetailResultView.tsx
 * @description OSS wrapper for Value Diff Detail result view component
 *
 * This file provides the OSS-specific implementation using createDataGrid
 * for backwards compatibility with existing tests and mocks. The core logic
 * lives in @datarecce/ui but OSS maintains its own implementation for
 * proper test mock integration.
 */

import type { Run } from "@datarecce/ui/api";
import {
  type ColumnRenderMode,
  isValueDiffDetailRun,
  type ValueDiffDetailViewOptions,
} from "@datarecce/ui/api";
import {
  ChangedOnlyCheckbox,
  DiffDisplayModeSwitch,
} from "@datarecce/ui/components/ui";
import { createResultView, type ResultViewData } from "@datarecce/ui/result";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import type { DataGridHandle } from "../data-grid/ScreenshotDataGrid";

import "../query/styles.css";

// ============================================================================
// Type Definitions
// ============================================================================

type ValueDiffDetailRun = Extract<Run, { type: "value_diff_detail" }>;

// Re-export types for backwards compatibility
export type { ValueDiffDetailRun };
export type { ValueDiffDetailViewOptions };

// Export props type alias for backwards compatibility
export interface ValueDiffDetailResultViewProps {
  run: ValueDiffDetailRun;
  viewOptions?: ValueDiffDetailViewOptions;
  onViewOptionsChanged?: (options: ValueDiffDetailViewOptions) => void;
}

/**
 * Type guard wrapper that accepts unknown and delegates to typed guard.
 */
function isValueDiffDetailRunGuard(run: unknown): run is ValueDiffDetailRun {
  return isValueDiffDetailRun(run as Run);
}

/**
 * ValueDiffDetailResultView component - displays value diff details in a data grid.
 *
 * Features:
 * - Displays row-level diff data with changed highlighting
 * - "Changed only" filter to show only differing rows
 * - Side-by-side vs inline display mode toggle
 * - Column pinning support
 * - Shows amber warning when results are truncated
 * - Toolbar-in-empty-state pattern: shows "No change" when changed_only=true but no changes
 *
 * @example
 * ```tsx
 * <ValueDiffDetailResultView
 *   run={valueDiffDetailRun}
 *   viewOptions={{ changed_only: true, display_mode: 'inline' }}
 *   onViewOptionsChanged={setViewOptions}
 * />
 * ```
 */
export const ValueDiffDetailResultView = createResultView<
  ValueDiffDetailRun,
  ValueDiffDetailViewOptions,
  DataGridHandle
>({
  displayName: "ValueDiffDetailResultView",
  typeGuard: isValueDiffDetailRunGuard,
  expectedRunType: "value_diff_detail",
  screenshotWrapper: "grid",
  emptyState: "No data",
  transformData: (
    run,
    { viewOptions, onViewOptionsChanged },
  ): ResultViewData | null => {
    const changedOnly = viewOptions?.changed_only ?? false;
    const pinnedColumns = viewOptions?.pinned_columns ?? [];
    const displayMode = viewOptions?.display_mode ?? "inline";
    const columnsRenderMode = viewOptions?.columnsRenderMode ?? {};

    // Create callbacks for view option changes
    const onColumnsRenderModeChanged = (
      cols: Record<string, ColumnRenderMode>,
    ) => {
      const newRenderModes = {
        ...(viewOptions?.columnsRenderMode ?? {}),
        ...cols,
      };
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          columnsRenderMode: newRenderModes,
        });
      }
    };

    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    // Build grid data using createDataGrid factory
    const gridData = createDataGrid(run as Run, {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
      displayMode,
    }) ?? { columns: [], rows: [] };

    // Empty state when no columns (no data at all)
    if (gridData.columns.length === 0) {
      return { isEmpty: true };
    }

    // Build warnings array
    const limit = run.result?.limit ?? 0;
    const warnings: string[] = [];
    if (limit > 0 && run.result?.more) {
      warnings.push(
        `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`,
      );
    }

    // Build toolbar with display mode switch and changed only checkbox
    const toolbar = (
      <>
        <DiffDisplayModeSwitch
          displayMode={displayMode}
          onDisplayModeChanged={(newDisplayMode) => {
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                display_mode: newDisplayMode,
              });
            }
          }}
        />
        <ChangedOnlyCheckbox
          changedOnly={viewOptions?.changed_only}
          onChange={() => {
            const changedOnly = !viewOptions?.changed_only;
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                changed_only: changedOnly,
              });
            }
          }}
        />
      </>
    );

    // Toolbar-in-empty-state pattern: when changed_only is true but no changed rows
    if (changedOnly && gridData.rows.length === 0) {
      return {
        isEmpty: true,
        emptyMessage: "No change",
        toolbar,
        warnings: warnings.length > 0 ? warnings : undefined,
        warningStyle: "amber",
      };
    }

    return {
      columns: gridData.columns,
      rows: gridData.rows,
      warnings: warnings.length > 0 ? warnings : undefined,
      warningStyle: "amber",
      toolbar,
      defaultColumnOptions: {
        resizable: true,
        maxWidth: 800,
        minWidth: 35,
      },
      noRowsMessage: "No mismatched rows",
    };
  },
});
