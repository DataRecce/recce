import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { forwardRef, Ref, useMemo } from "react";

import "../query/styles.css";
import { ColumnRenderMode, isValueDiffDetailRun, Run } from "@/lib/api/types";
import { ValueDiffDetailViewOptions } from "@/lib/api/valuediff";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { ChangedOnlyCheckbox } from "../query/ChangedOnlyCheckbox";
import { DiffDisplayModeSwitch } from "../query/ToggleSwitch";
import { RunToolbar } from "../run/RunToolbar";
import { RunResultViewProps } from "../run/types";

export interface ValueDiffDetailResultViewProps
  extends RunResultViewProps<ValueDiffDetailViewOptions> {
  onAddToChecklist?: (run: Run) => void;
}

const PrivateValueDiffDetailResultView = (
  {
    run,
    onAddToChecklist,
    viewOptions,
    onViewOptionsChanged,
  }: ValueDiffDetailResultViewProps,

  ref: Ref<DataGridHandle>,
) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (!isValueDiffDetailRun(run)) {
    throw new Error("run type must be value_diff_detail");
  }
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

    const handlePinnedColumnsChanged = (pinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: pinnedColumns,
        });
      }
    };

    return (
      createDataGrid(run, {
        changedOnly,
        pinnedColumns,
        onPinnedColumnsChange: handlePinnedColumnsChanged,
        columnsRenderMode,
        onColumnsRenderModeChanged,
        displayMode,
      }) ?? { columns: [], rows: [] }
    );
  }, [
    run,
    viewOptions,
    changedOnly,
    pinnedColumns,
    displayMode,
    onViewOptionsChanged,
    columnsRenderMode,
  ]);

  const limit = run.result?.limit ?? 0;
  const warning =
    limit > 0 && run.result?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;

  const warnings: string[] = [];
  if (warning) {
    warnings.push(warning);
  }

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

  if (changedOnly && gridData.rows.length === 0) {
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
          onDisplayModeChanged={(displayMode) => {
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                display_mode: displayMode,
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
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
      />
    </Box>
  );
};

export const ValueDiffDetailResultView = forwardRef(
  PrivateValueDiffDetailResultView,
);
