"use client";

/**
 * @file ValueDiffDetailResultView.tsx
 * @description Framework-agnostic Value Diff Detail result view for @datarecce/ui
 *
 * Displays row-level value diff data in a data grid format. Uses the createResultView
 * factory pattern and can be used by both Recce OSS and Recce Cloud.
 *
 * Features:
 * - Displays row-level diff data with changed highlighting
 * - "Changed only" filter to show only differing rows
 * - Side-by-side vs inline display mode toggle
 * - Column pinning support
 * - Shows amber warning when results are truncated
 * - Toolbar-in-empty-state pattern: shows "No change" when changed_only=true but no changes
 */

import type { ForwardRefExoticComponent, RefAttributes } from "react";
import {
  isValueDiffDetailRun,
  type Run,
  type ValueDiffDetailViewOptions,
} from "../../api";
import {
  createColumnsRenderModeHandler,
  createPinnedColumnsHandler,
  toValueDiffGridConfigured,
} from "../../utils";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps, ResultViewData } from "../result/types";
import { ChangedOnlyCheckbox } from "../ui/ChangedOnlyCheckbox";
import { DiffDisplayModeSwitch } from "../ui/DiffDisplayModeSwitch";

// Import AG Grid styles for context menu visibility
import "../data/agGridStyles.css";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Run type with value_diff_detail result
 */
export type ValueDiffDetailRun = Run & {
  type: "value_diff_detail";
};

/**
 * Props for ValueDiffDetailResultView component
 */
export interface ValueDiffDetailResultViewProps
  extends CreatedResultViewProps<ValueDiffDetailViewOptions> {
  run: ValueDiffDetailRun | unknown;
}

// ============================================================================
// Type Guard
// ============================================================================

/**
 * Type guard wrapper that accepts unknown and delegates to typed guard.
 */
function isValueDiffDetailRunGuard(run: unknown): run is ValueDiffDetailRun {
  return isValueDiffDetailRun(run as Run);
}

// ============================================================================
// Factory-Created Component
// ============================================================================

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

    // Extract primary keys from params
    const primaryKey = run.params?.primary_key;
    if (!primaryKey || !run.result) {
      return { isEmpty: true };
    }
    const primaryKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];

    // Create callbacks for view option changes
    const onColumnsRenderModeChanged = createColumnsRenderModeHandler(
      viewOptions,
      onViewOptionsChanged,
    );

    const handlePinnedColumnsChanged = createPinnedColumnsHandler(
      viewOptions,
      onViewOptionsChanged,
    );

    // Build grid data using toValueDiffGridConfigured
    const gridData = toValueDiffGridConfigured(run.result, primaryKeys, {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
      displayMode,
    });

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
            const newChangedOnly = !viewOptions?.changed_only;
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                changed_only: newChangedOnly,
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
}) as ForwardRefExoticComponent<
  ValueDiffDetailResultViewProps & RefAttributes<DataGridHandle>
>;

// Re-export the view options type for convenience
export type { ValueDiffDetailViewOptions };
