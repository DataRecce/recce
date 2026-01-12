"use client";

/**
 * @file QueryResultView.tsx
 * @description Framework-agnostic Query result view for @datarecce/ui
 *
 * Displays query results in a data grid format. Uses the createResultView
 * factory pattern and can be used by both Recce OSS and Recce Cloud.
 *
 * Features:
 * - Displays query results with column pinning support
 * - Shows amber warning when results are truncated (limit exceeded)
 * - Optional "Add to Checklist" button in toolbar
 * - Supports both "query" and "query_base" run types
 */

import Button from "@mui/material/Button";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { Run } from "../../api";
import {
  type ColumnRenderMode,
  isQueryBaseRun,
  isQueryRun,
  type QueryViewOptions,
} from "../../api";
import { toDataGridConfigured } from "../../utils";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps, ResultViewData } from "../result/types";

// ============================================================================
// Type Definitions
// ============================================================================

type QueryRun = Extract<Run, { type: "query" }>;
type QueryBaseRun = Extract<Run, { type: "query_base" }>;

/**
 * Props for QueryResultView component
 */
export interface QueryResultViewProps
  extends CreatedResultViewProps<QueryViewOptions> {
  run: QueryRun | QueryBaseRun | unknown;
}

/**
 * Type guard for query or query_base runs.
 * QueryResultView accepts both run types.
 * Wrapper accepts unknown and delegates to typed guards.
 */
function isQueryOrQueryBaseRun(run: unknown): run is QueryRun | QueryBaseRun {
  return isQueryRun(run as Run) || isQueryBaseRun(run as Run);
}

/**
 * QueryResultView component - displays query results in a data grid.
 *
 * Features:
 * - Displays query results with column pinning support
 * - Shows amber warning when results are truncated (limit exceeded)
 * - Optional "Add to Checklist" button in toolbar
 * - Supports both "query" and "query_base" run types
 *
 * @example
 * ```tsx
 * <QueryResultView
 *   run={queryRun}
 *   viewOptions={{ pinned_columns: ['id'] }}
 *   onViewOptionsChanged={setViewOptions}
 *   onAddToChecklist={(run) => addToChecklist(run)}
 * />
 * ```
 */
export const QueryResultView = createResultView<
  QueryRun | QueryBaseRun,
  QueryViewOptions,
  DataGridHandle
>({
  displayName: "QueryResultView",
  typeGuard: isQueryOrQueryBaseRun,
  expectedRunType: "query",
  screenshotWrapper: "grid",
  emptyState: "No data",
  transformData: (
    run,
    { viewOptions, onViewOptionsChanged, onAddToChecklist },
  ): ResultViewData | null => {
    const pinnedColumns = viewOptions?.pinned_columns ?? [];
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

    // Build grid data using toDataGridConfigured
    if (!run.result) {
      return { isEmpty: true };
    }

    const gridData = toDataGridConfigured(run.result, {
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    });

    // Empty state when no columns
    if (gridData.columns.length === 0) {
      return { isEmpty: true };
    }

    // Build warnings array
    const dataframe = run.result;
    const limit = dataframe ? (dataframe.limit ?? 0) : 0;
    const warnings: string[] = [];
    if (limit > 0 && dataframe?.more) {
      warnings.push(
        `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`,
      );
    }

    // Build toolbar with "Add to Checklist" button
    const toolbar = onAddToChecklist ? (
      <Button
        sx={{ my: "5px" }}
        size="small"
        color="iochmara"
        variant="contained"
        onClick={() => {
          onAddToChecklist(run);
        }}
      >
        Add to Checklist
      </Button>
    ) : undefined;

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
    };
  },
}) as ForwardRefExoticComponent<
  QueryResultViewProps & RefAttributes<DataGridHandle>
>;

// Re-export the view options type for convenience
export type { QueryViewOptions };
