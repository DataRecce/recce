import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import React, { forwardRef, Ref, useMemo } from "react";
import { PiWarning } from "react-icons/pi";
import { colors } from "@/components/ui/mui-theme";
import { QueryViewOptions } from "@/lib/api/adhocQuery";
import {
  ColumnRenderMode,
  isQueryBaseRun,
  isQueryRun,
  Run,
} from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import {
  type DataGridHandle,
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
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

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
    <Stack sx={{ bgcolor: isDark ? "grey.900" : "grey.50", height: "100%" }}>
      {showTopBar && (
        <Stack
          direction="row"
          sx={{
            borderBottom: "1px solid",
            borderBottomColor: "divider",
            alignItems: "center",
            gap: "5px",
            px: "10px",
            bgcolor: warning
              ? isDark
                ? colors.amber[900]
                : colors.amber[100]
              : "inherit",
            color: warning
              ? isDark
                ? colors.amber[200]
                : colors.amber[800]
              : "inherit",
          }}
        >
          {warning && (
            <>
              <PiWarning
                color={isDark ? colors.amber[400] : colors.amber[600]}
                style={{ alignSelf: "center" }}
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
        className={isDark ? "rdg-dark" : "rdg-light"}
      />
    </Stack>
  );
};

export const QueryResultView = forwardRef(PrivateQueryResultView);
