import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { forwardRef, Ref, useMemo } from "react";
import { isRowCountDiffRun, isRowCountRun, Run } from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import {
  type DataGridHandle,
  EmptyRowsRenderer,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

// ============================================================================
// Shared Component
// ============================================================================

interface RowCountGridViewProps {
  run: Run;
  typeGuard: (run: Run) => boolean;
  expectedType: string;
}

function _RowCountGridView(
  { run, typeGuard, expectedType }: RowCountGridViewProps,
  ref: Ref<DataGridHandle>,
) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (!typeGuard(run)) {
    throw new Error(`Run type must be ${expectedType}`);
  }

  const gridData = useMemo(() => {
    return createDataGrid(run) ?? { columns: [], rows: [] };
  }, [run]);

  if (gridData.rows.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        No nodes matched
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ScreenshotDataGrid
        ref={ref}
        style={{
          blockSize: "auto",
          maxHeight: "100%",
          overflow: "auto",
          fontSize: "0.875rem",
          borderWidth: 1,
        }}
        columns={gridData.columns}
        rows={gridData.rows}
        renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
      />
    </Box>
  );
}

const RowCountGridView = forwardRef(_RowCountGridView);

// ============================================================================
// Exported Components
// ============================================================================

function _RowCountDiffResultView(
  { run }: RunResultViewProps,
  ref: Ref<DataGridHandle>,
) {
  return (
    <RowCountGridView
      ref={ref}
      run={run}
      typeGuard={isRowCountDiffRun}
      expectedType="row_count_diff"
    />
  );
}

function _RowCountResultView(
  { run }: RunResultViewProps,
  ref: Ref<DataGridHandle>,
) {
  return (
    <RowCountGridView
      ref={ref}
      run={run}
      typeGuard={isRowCountRun}
      expectedType="row_count"
    />
  );
}

export const RowCountDiffResultView = forwardRef(_RowCountDiffResultView);
export const RowCountResultView = forwardRef(_RowCountResultView);
