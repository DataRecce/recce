import { Center, Flex } from "@chakra-ui/react";

import { ScreenshotDataGrid } from "../data-grid/ScreenshotDataGrid";
import { RunResultViewProps } from "../run/types";

import { ProfileDiffParams, ProfileDiffResult, ProfileDiffViewOptions } from "@/lib/api/profile";
import { forwardRef, useMemo } from "react";
import { toDataDiffGrid } from "../query/querydiff";
import { RunToolbar } from "../run/RunToolbar";
import { DiffDisplayModeSwitch } from "../query/ToggleSwitch";
import { toDataGrid } from "../query/QueryResultView";
import { ColumnRenderMode } from "@/lib/api/types";

type ProfileDiffResultViewProp = RunResultViewProps<
  ProfileDiffParams,
  ProfileDiffResult,
  ProfileDiffViewOptions
>;

const PrivateProfileDiffResultView = (
  { run, viewOptions, onViewOptionsChanged }: ProfileDiffResultViewProp,
  ref: any,
) => {
  const result = run.result;
  const pinnedColumns = useMemo(() => viewOptions?.pinned_columns ?? [], [viewOptions]);
  const displayMode = useMemo(() => viewOptions?.display_mode ?? "inline", [viewOptions]);
  const columnsRenderMode = useMemo(() => viewOptions?.columnsRenderMode ?? {}, [viewOptions]);

  const field = (result?.current?.columns ?? []).find(
    (f) => f.name.toLowerCase() === "column_name",
  );
  const primaryKey = field?.name ?? "column_name";

  const gridData = useMemo(() => {
    const onColumnsRenderModeChanged = (cols: Record<string, ColumnRenderMode>) => {
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

    return toDataDiffGrid(result?.base, result?.current, {
      primaryKeys: [primaryKey],
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      displayMode,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    });
  }, [
    result,
    primaryKey,
    pinnedColumns,
    displayMode,
    viewOptions,
    onViewOptionsChanged,
    columnsRenderMode,
  ]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height={"100%"}>
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
        className="rdg-light"
      />
    </Flex>
  );
};

const PrivateProfileResultView = (
  { run, viewOptions, onViewOptionsChanged }: ProfileDiffResultViewProp,
  ref: any,
) => {
  const result = run.result;
  const dataFrame = result?.current;
  const pinnedColumns = useMemo(() => viewOptions?.pinned_columns ?? [], [viewOptions]);
  const columnsRenderMode = useMemo(() => viewOptions?.columnsRenderMode ?? {}, [viewOptions]);

  const field = (result?.current?.columns ?? []).find(
    (f) => f.name.toLowerCase() === "column_name",
  );
  const primaryKey = field?.name ?? "column_name";

  const gridData = useMemo(() => {
    const onColumnsRenderModeChanged = (cols: Record<string, ColumnRenderMode>) => {
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

    if (!dataFrame) {
      return { columns: [], rows: [] };
    }

    return toDataGrid(dataFrame, {
      primaryKeys: [primaryKey],
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    });
  }, [dataFrame, pinnedColumns, primaryKey, viewOptions, onViewOptionsChanged, columnsRenderMode]);

  if (gridData.columns.length === 0) {
    return <Center height="100%">No data</Center>;
  }

  return (
    <Flex direction="column" backgroundColor="rgb(249, 249, 249)" height={"100%"}>
      <ScreenshotDataGrid
        ref={ref}
        style={{ blockSize: "auto", maxHeight: "100%", overflow: "auto" }}
        columns={gridData.columns}
        rows={gridData.rows}
        defaultColumnOptions={{ resizable: true, maxWidth: 800, minWidth: 35 }}
        className="rdg-light"
      />
    </Flex>
  );
};

export const ProfileDiffResultView = forwardRef(PrivateProfileDiffResultView);
export const ProfileResultView = forwardRef(PrivateProfileResultView);
