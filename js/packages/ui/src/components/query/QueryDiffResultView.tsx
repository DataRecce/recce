"use client";

/**
 * @file QueryDiffResultView.tsx
 * @description Framework-agnostic Query Diff result view for @datarecce/ui
 *
 * Handles both JOIN and non-JOIN modes:
 * - JOIN mode: Server computes the diff, result has `run.result.diff`
 * - Non-JOIN mode: Client-side diff, result has `run.result.base` and `run.result.current`
 *
 * Features:
 * - Displays row-level diff data with changed highlighting
 * - "Changed only" filter to show only differing rows
 * - Side-by-side vs inline display mode toggle
 * - Column pinning support
 * - Primary key selection (non-JOIN mode)
 * - Warning for truncated results
 * - Warning for non-unique primary keys (non-JOIN mode)
 */

import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { Run } from "../../api";
import {
  isQueryDiffRun,
  type QueryDiffViewOptions,
  type QueryPreviewChangeParams,
} from "../../api";
import {
  createColumnsRenderModeHandler,
  createPinnedColumnsHandler,
  toDataDiffGridConfigured,
  toValueDiffGridConfigured,
} from "../../utils";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps, ResultViewData } from "../result/types";
import { ChangedOnlyCheckbox } from "../ui/ChangedOnlyCheckbox";
import { DiffDisplayModeSwitch } from "../ui/DiffDisplayModeSwitch";

import "./styles.css";

// ============================================================================
// Type Definitions
// ============================================================================

type QueryDiffRun = Extract<Run, { type: "query_diff" }>;

/**
 * Props for QueryDiffResultView component
 */
export interface QueryDiffResultViewProps
  extends CreatedResultViewProps<QueryDiffViewOptions> {
  run: QueryDiffRun | unknown;
}

/**
 * Type guard wrapper that accepts unknown and delegates to typed guard.
 */
function isQueryDiffRunGuard(run: unknown): run is QueryDiffRun {
  return isQueryDiffRun(run as Run);
}

/**
 * QueryDiffResultView component - displays query diff results in a data grid.
 *
 * Handles both JOIN and non-JOIN modes:
 * - JOIN mode: Server computes the diff, result has `run.result.diff`
 * - Non-JOIN mode: Client-side diff, result has `run.result.base` and `run.result.current`
 *
 * Key differences between modes:
 * - Primary key handling: only in non-JOIN mode (server handles it in JOIN mode)
 * - Warning sources: `diff.limit/more` vs `current.limit/more || base.more`
 * - "No change" empty state: only in JOIN mode with changedOnly=true
 *
 * Features:
 * - Displays row-level diff data with changed highlighting
 * - "Changed only" filter to show only differing rows
 * - Side-by-side vs inline display mode toggle
 * - Column pinning support
 * - Primary key selection (non-JOIN mode)
 * - Warning for truncated results
 * - Warning for non-unique primary keys (non-JOIN mode)
 *
 * @example
 * ```tsx
 * <QueryDiffResultView
 *   run={queryDiffRun}
 *   viewOptions={{ changed_only: true, display_mode: 'inline' }}
 *   onViewOptionsChanged={setViewOptions}
 * />
 * ```
 */
export const QueryDiffResultView = createResultView<
  QueryDiffRun,
  QueryDiffViewOptions,
  DataGridHandle
>({
  displayName: "QueryDiffResultView",
  typeGuard: isQueryDiffRunGuard,
  expectedRunType: "query_diff",
  screenshotWrapper: "grid",
  emptyState: "No data",
  transformData: (
    run,
    { viewOptions, onViewOptionsChanged },
  ): ResultViewData | null => {
    // Determine mode based on result structure
    const isJoinMode =
      run.result && "diff" in run.result && run.result.diff != null;

    // Compute baseTitle/currentTitle for sandbox editor
    let baseTitle: string | undefined;
    let currentTitle: string | undefined;
    if (run.params && (run.params as QueryPreviewChangeParams).current_model) {
      baseTitle = "Original";
      currentTitle = "Editor";
    }

    // Extract view options with defaults
    const changedOnly = viewOptions?.changed_only ?? false;
    const pinnedColumns = viewOptions?.pinned_columns ?? [];
    const displayMode = viewOptions?.display_mode ?? "inline";
    const columnsRenderMode = viewOptions?.columnsRenderMode ?? {};

    // Primary keys only used in non-JOIN mode
    const primaryKeys = !isJoinMode ? (viewOptions?.primary_keys ?? []) : [];

    // Create callbacks for view option changes
    const onColumnsRenderModeChanged = createColumnsRenderModeHandler(
      viewOptions,
      onViewOptionsChanged,
    );

    // Primary key handler only for non-JOIN mode
    const handlePrimaryKeyChanged = !isJoinMode
      ? (pks: string[]) => {
          if (onViewOptionsChanged) {
            onViewOptionsChanged({
              ...viewOptions,
              primary_keys: pks,
            });
          }
        }
      : undefined;

    const handlePinnedColumnsChanged = createPinnedColumnsHandler(
      viewOptions,
      onViewOptionsChanged,
    );

    // Build grid data using appropriate grid generator based on mode
    let gridData: {
      columns: unknown[];
      rows: unknown[];
      invalidPKeyBase?: boolean;
      invalidPKeyCurrent?: boolean;
    };

    if (isJoinMode && run.result?.diff) {
      // JOIN mode: use toValueDiffGrid with the diff data
      const primaryKeysFromParams = run.params?.primary_keys ?? [];
      gridData = toValueDiffGridConfigured(
        run.result.diff,
        primaryKeysFromParams,
        {
          changedOnly,
          pinnedColumns,
          onPinnedColumnsChange: handlePinnedColumnsChanged,
          columnsRenderMode,
          onColumnsRenderModeChanged,
          baseTitle,
          currentTitle,
          displayMode,
        },
      );
    } else {
      // Non-JOIN mode: use toDataDiffGrid with base/current data
      gridData = toDataDiffGridConfigured(
        run.result?.base,
        run.result?.current,
        {
          changedOnly,
          pinnedColumns,
          onPinnedColumnsChange: handlePinnedColumnsChanged,
          columnsRenderMode,
          onColumnsRenderModeChanged,
          baseTitle,
          currentTitle,
          displayMode,
          primaryKeys,
          onPrimaryKeyChange: handlePrimaryKeyChanged,
        },
      );
    }

    // Build warnings array
    const warnings: string[] = [];

    // Primary key uniqueness warning - only for non-JOIN mode
    if (!isJoinMode && primaryKeys.length > 0) {
      const pkName = primaryKeys.join(", ");

      if (gridData.invalidPKeyBase && gridData.invalidPKeyCurrent) {
        warnings.push(
          `Warning: The primary key '${pkName}' is not unique in the base and current environments`,
        );
      } else if (gridData.invalidPKeyBase) {
        warnings.push(
          `Warning: The primary key '${pkName}' is not unique in the base environment`,
        );
      } else if (gridData.invalidPKeyCurrent) {
        warnings.push(
          `Warning: The primary key '${pkName}' is not unique in the current environment`,
        );
      }
    }

    // Limit warning - different sources for JOIN vs non-JOIN
    const limit = isJoinMode
      ? (run.result?.diff?.limit ?? 0)
      : (run.result?.current?.limit ?? 0);

    const hasMore = isJoinMode
      ? run.result?.diff?.more
      : run.result?.current?.more || run.result?.base?.more;

    if (limit > 0 && hasMore) {
      warnings.push(
        `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`,
      );
    }

    // Empty state when no columns (no data at all)
    if (gridData.columns.length === 0) {
      return { isEmpty: true };
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

    // "No change" empty state - only for JOIN mode with changedOnly=true
    if (isJoinMode && changedOnly && gridData.rows.length === 0) {
      return {
        isEmpty: true,
        emptyMessage: "No change",
        toolbar,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    return {
      columns: gridData.columns,
      rows: gridData.rows,
      warnings: warnings.length > 0 ? warnings : undefined,
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
  QueryDiffResultViewProps & RefAttributes<DataGridHandle>
>;

// Re-export the view options type for convenience
export type { QueryDiffViewOptions };
