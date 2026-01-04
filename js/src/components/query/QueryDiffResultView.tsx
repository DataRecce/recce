import Box from "@mui/material/Box";
import { ForwardedRef, forwardRef, Ref, useMemo } from "react";
import {
  QueryDiffViewOptions,
  QueryPreviewChangeParams,
} from "@/lib/api/adhocQuery";
import { useIsDark } from "@/lib/hooks/useIsDark";

import "./styles.css";
import { ColumnRenderMode, Run } from "@/lib/api/types";
import {
  createDataGrid,
  DiffGridOptions,
} from "@/lib/dataGrid/dataGridFactory";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunToolbar } from "../run/RunToolbar";
import { RunResultViewProps } from "../run/types";
import { ChangedOnlyCheckbox } from "./ChangedOnlyCheckbox";
import { DiffDisplayModeSwitch } from "./ToggleSwitch";

export interface QueryDiffResultViewProps
  extends RunResultViewProps<QueryDiffViewOptions> {
  onAddToChecklist?: (run: Run) => void;
  baseTitle?: string;
  currentTitle?: string;
}

/**
 * Unified QueryDiffResultView component that handles both JOIN and non-JOIN modes.
 *
 * JOIN mode: Server computes the diff, result has `run.result.diff`
 * Non-JOIN mode: Client-side diff, result has `run.result.base` and `run.result.current`
 *
 * Key differences handled:
 * - Primary key handling: only in non-JOIN mode (server handles it in JOIN mode)
 * - Warning sources: `diff.limit/more` vs `current.limit/more || base.more`
 * - "No change" empty state: only in JOIN mode with changedOnly=true
 */
const PrivateQueryDiffResultView = (
  {
    run,
    // Note: onAddToChecklist is in props interface for API compatibility but unused
    viewOptions,
    onViewOptionsChanged,
    baseTitle,
    currentTitle,
  }: QueryDiffResultViewProps,
  ref: Ref<DataGridHandle>,
) => {
  const isDark = useIsDark();

  if (run.type !== "query_diff") {
    throw new Error("QueryDiffResult view should be rendered as query_diff");
  }

  // Determine mode based on result structure
  const isJoinMode =
    run.result && "diff" in run.result && run.result.diff != null;

  // Primary keys only used in non-JOIN mode
  const primaryKeys = useMemo(
    () => (!isJoinMode ? (viewOptions?.primary_keys ?? []) : []),
    [viewOptions, isJoinMode],
  );

  const changedOnly = useMemo(
    () => viewOptions?.changed_only ?? false,
    [viewOptions],
  );

  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns ?? [],
    [viewOptions],
  );

  const displayMode = useMemo(
    () => viewOptions?.display_mode ?? "inline",
    [viewOptions],
  );

  const columnsRenderMode = useMemo(
    () => viewOptions?.columnsRenderMode ?? {},
    [viewOptions],
  );

  const gridData = useMemo(() => {
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

    const handlePinnedColumnsChanged = (pinnedCols: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedCols,
        });
      }
    };

    const options: DiffGridOptions = {
      changedOnly,
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
      baseTitle,
      currentTitle,
      displayMode,
      // Only pass onPrimaryKeyChange for non-JOIN mode
      ...(handlePrimaryKeyChanged && {
        onPrimaryKeyChange: handlePrimaryKeyChanged,
      }),
    };

    return createDataGrid(run, options) ?? { columns: [], rows: [] };
  }, [
    run,
    viewOptions,
    changedOnly,
    pinnedColumns,
    displayMode,
    onViewOptionsChanged,
    baseTitle,
    currentTitle,
    columnsRenderMode,
    isJoinMode,
  ]);

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

  // Empty state: No data
  if (gridData.columns.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        No data
      </Box>
    );
  }

  // Empty state: No change (JOIN mode only, when changedOnly is true)
  if (isJoinMode && changedOnly && gridData.rows.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        <RunToolbar
          run={run}
          viewOptions={viewOptions}
          onViewOptionsChanged={onViewOptionsChanged}
          warnings={warnings}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          No change
        </Box>
      </Box>
    );
  }

  // Main render
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      <RunToolbar
        run={run}
        viewOptions={viewOptions}
        onViewOptionsChanged={onViewOptionsChanged}
        warnings={warnings}
      >
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
      </RunToolbar>
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{
          noRowsFallback: (
            <EmptyRowsRenderer emptyMessage="No mismatched rows" />
          ),
        }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
      />
    </Box>
  );
};

// Create the forwardRef component
const QueryDiffResultViewWithRef = forwardRef(PrivateQueryDiffResultView);

export const QueryDiffResultView = forwardRef(
  (props: QueryDiffResultViewProps, ref: ForwardedRef<DataGridHandle>) => {
    let baseTitle;
    let currentTitle;
    if (
      props.run.params &&
      (props.run.params as QueryPreviewChangeParams).current_model
    ) {
      // Configure the base and current titles under Sandbox Editor
      baseTitle = "Original";
      currentTitle = "Editor";
    }

    return (
      <QueryDiffResultViewWithRef
        {...props}
        ref={ref}
        baseTitle={baseTitle}
        currentTitle={currentTitle}
      />
    );
  },
);
