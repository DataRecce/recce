import "react-data-grid/lib/styles.css";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import React, { forwardRef, Ref, useMemo } from "react";
import { DataGridHandle } from "react-data-grid";
import { PiWarning } from "react-icons/pi";
import { QueryViewOptions } from "@/lib/api/adhocQuery";
import {
  ColumnRenderMode,
  isQueryBaseRun,
  isQueryRun,
  Run,
} from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import {
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

interface QueryResultViewProp extends RunResultViewProps<QueryViewOptions> {
  onAddToChecklist?: (run: Run) => void;
}

const PrivateQueryResultView = (
  {
    run,
    viewOptions,
    onViewOptionsChanged,
    onAddToChecklist,
  }: QueryResultViewProp,
  ref: Ref<DataGridHandle>,
) => {
  if (!(isQueryRun(run) || isQueryBaseRun(run))) {
    throw new Error("run type must be query");
  }
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns ?? [],
    [viewOptions],
  );
  const columnsRenderMode = useMemo(
    () => viewOptions?.columnsRenderMode ?? {},
    [viewOptions],
  );

  const dataframe = run.result;
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
        pinnedColumns,
        onPinnedColumnsChange: handlePinnedColumnsChanged,
        columnsRenderMode,
        onColumnsRenderModeChanged,
      }) ?? { columns: [], rows: [] }
    );
  }, [
    run,
    pinnedColumns,
    viewOptions,
    onViewOptionsChanged,
    columnsRenderMode,
  ]);

  if (gridData.columns.length === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        No data
      </Box>
    );
  }

  const limit = dataframe ? (dataframe.limit ?? 0) : 0;
  const warning =
    limit > 0 && dataframe?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;
  const showTopBar = onAddToChecklist ?? warning;

  return (
    <Stack sx={{ bgcolor: "rgb(249, 249, 249)", height: "100%" }}>
      {showTopBar && (
        <Stack
          direction="row"
          sx={{
            borderBottom: "1px solid lightgray",
            alignItems: "center",
            gap: "5px",
            px: "10px",
            bgcolor: warning ? "amber.100" : "inherit",
          }}
        >
          {warning && (
            <>
              <Box
                component={PiWarning}
                sx={{ color: "amber.600", alignSelf: "center" }}
              />{" "}
              <Box>{warning}</Box>
            </>
          )}

          <Box sx={{ flexGrow: 1, minHeight: "32px" }} />
          {onAddToChecklist && (
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
          )}
        </Stack>
      )}
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
        defaultColumnOptions={{
          resizable: true,
          maxWidth: 800,
          minWidth: 35,
        }}
        className="rdg-light"
      />
    </Stack>
  );
};

export const QueryResultView = forwardRef(PrivateQueryResultView);
