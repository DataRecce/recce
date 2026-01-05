import {
  type ColumnRenderMode,
  isQueryBaseRun,
  isQueryRun,
  type QueryViewOptions,
} from "@datarecce/ui/api";
import { createResultView, type ResultViewData } from "@datarecce/ui/result";
import Button from "@mui/material/Button";
// Import Run from OSS types for proper discriminated union support with Extract<>
import type { Run } from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import type { DataGridHandle } from "../data-grid/ScreenshotDataGrid";

// ============================================================================
// Type Definitions
// ============================================================================

type QueryRun = Extract<Run, { type: "query" }>;
type QueryBaseRun = Extract<Run, { type: "query_base" }>;

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

    // Build grid data using createDataGrid factory
    const gridData = createDataGrid(run as Run, {
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    }) ?? { columns: [], rows: [] };

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
});
