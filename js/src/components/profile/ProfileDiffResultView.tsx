import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { forwardRef, Ref, useMemo } from "react";
import { ProfileDiffViewOptions } from "@/lib/api/profile";
import {
  ColumnRenderMode,
  isProfileDiffRun,
  isProfileRun,
} from "@/lib/api/types";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import {
  type DataGridHandle,
  ScreenshotDataGrid,
} from "../data-grid/ScreenshotDataGrid";
import { DiffDisplayModeSwitch } from "../query/ToggleSwitch";
import { RunToolbar } from "../run/RunToolbar";
import { RunResultViewProps } from "../run/types";

type ProfileDiffResultViewProp = RunResultViewProps<ProfileDiffViewOptions>;

const PrivateProfileDiffResultView = (
  { run, viewOptions, onViewOptionsChanged }: ProfileDiffResultViewProp,

  ref: Ref<DataGridHandle>,
) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (!isProfileDiffRun(run)) {
    throw new Error("Only run type profile_diff is supported");
  }
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns ?? [],
    [viewOptions],
  );
  const displayMode = useMemo(
    () => viewOptions?.display_mode ?? "inline",
    [viewOptions],
  );
  // Default proportion columns to percentage display
  const columnsRenderMode = useMemo(
    () => ({
      distinct_proportion: "percent" as ColumnRenderMode,
      not_null_proportion: "percent" as ColumnRenderMode,
      ...viewOptions?.columnsRenderMode,
    }),
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
        pinnedColumns,
        onPinnedColumnsChange: handlePinnedColumnsChanged,
        displayMode,
        columnsRenderMode,
        onColumnsRenderModeChanged,
      }) ?? { columns: [], rows: [] }
    );
  }, [
    run,
    pinnedColumns,
    displayMode,
    viewOptions,
    onViewOptionsChanged,
    columnsRenderMode,
  ]);

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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      <RunToolbar run={run}>
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
      </RunToolbar>
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
      />
    </Box>
  );
};

const PrivateProfileResultView = (
  { run, viewOptions, onViewOptionsChanged }: ProfileDiffResultViewProp,

  ref: Ref<DataGridHandle>,
) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (!isProfileRun(run)) {
    throw new Error("Only run type profile_diff is supported");
  }
  const pinnedColumns = useMemo(
    () => viewOptions?.pinned_columns ?? [],
    [viewOptions],
  );
  // Default proportion columns to percentage display
  const columnsRenderMode = useMemo(
    () => ({
      distinct_proportion: "percent" as ColumnRenderMode,
      not_null_proportion: "percent" as ColumnRenderMode,
      ...viewOptions?.columnsRenderMode,
    }),
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

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
      />
    </Box>
  );
};

export const ProfileDiffResultView = forwardRef(PrivateProfileDiffResultView);
export const ProfileResultView = forwardRef(PrivateProfileResultView);
