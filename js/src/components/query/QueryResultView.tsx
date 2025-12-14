import "react-data-grid/lib/styles.css";
import React, { forwardRef, Ref, useMemo } from "react";
import { DataGridHandle } from "react-data-grid";
import { PiWarning } from "react-icons/pi";
import { Box, Button, Center, Flex, Spacer } from "@/components/ui/mui";
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
    return <Center height="100%">No data</Center>;
  }

  const limit = dataframe ? (dataframe.limit ?? 0) : 0;
  const warning =
    limit > 0 && dataframe?.more
      ? `Warning: Displayed results are limited to ${limit.toLocaleString()} records. To ensure complete data retrieval, consider applying a LIMIT or WHERE clause to constrain the result set.`
      : null;
  const showTopBar = onAddToChecklist ?? warning;

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height="100%">
      {showTopBar && (
        <Flex
          borderBottom="1px solid lightgray"
          alignItems="center"
          gap="5px"
          px="10px"
          bg={warning ? "amber.100" : "inherit"}
        >
          {warning && (
            <>
              <PiWarning color="amber.600" className="self-center" />{" "}
              <Box>{warning}</Box>
            </>
          )}

          <Spacer minHeight="32px" />
          {onAddToChecklist && (
            <Button
              marginBlock="5px"
              size="xs"
              colorPalette="iochmara"
              onClick={() => {
                onAddToChecklist(run);
              }}
            >
              Add to Checklist
            </Button>
          )}
        </Flex>
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
    </Flex>
  );
};

export const QueryResultView = forwardRef(PrivateQueryResultView);
