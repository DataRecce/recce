import {
  type ColumnRenderMode,
  isProfileDiffRun,
  isProfileRun,
  type ProfileDiffViewOptions,
} from "@datarecce/ui/api";
import { createResultView } from "@datarecce/ui/result";
import { createDataGrid } from "@/lib/dataGrid/dataGridFactory";
import { DiffDisplayModeSwitch } from "../query/ToggleSwitch";
import { RunToolbar } from "../run/RunToolbar";

// Type guard wrapper for factory compatibility (accepts unknown instead of Run)
type ProfileDiffRun = Extract<
  Parameters<typeof isProfileDiffRun>[0],
  { type: "profile_diff" }
>;
const isProfileDiffRunGuard = (run: unknown): run is ProfileDiffRun =>
  typeof run === "object" &&
  run !== null &&
  "type" in run &&
  isProfileDiffRun(run as Parameters<typeof isProfileDiffRun>[0]);

export const ProfileDiffResultView = createResultView<
  ProfileDiffRun,
  ProfileDiffViewOptions
>({
  displayName: "ProfileDiffResultView",
  typeGuard: isProfileDiffRunGuard,
  expectedRunType: "profile_diff",
  screenshotWrapper: "grid",
  transformData: (run, { viewOptions, onViewOptionsChanged }) => {
    const pinnedColumns = viewOptions?.pinned_columns ?? [];
    const displayMode = viewOptions?.display_mode ?? "inline";

    // Default proportion columns to percentage display
    const columnsRenderMode = {
      distinct_proportion: "percent" as ColumnRenderMode,
      not_null_proportion: "percent" as ColumnRenderMode,
      ...viewOptions?.columnsRenderMode,
    };

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

    const gridData = createDataGrid(run, {
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      displayMode,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    }) ?? { columns: [], rows: [] };

    const header = (
      <RunToolbar run={run}>
        <DiffDisplayModeSwitch
          displayMode={displayMode}
          onDisplayModeChanged={(mode) => {
            if (onViewOptionsChanged) {
              onViewOptionsChanged({
                ...viewOptions,
                display_mode: mode,
              });
            }
          }}
        />
      </RunToolbar>
    );

    return {
      columns: gridData.columns,
      rows: gridData.rows,
      header,
      isEmpty: gridData.columns.length === 0,
    };
  },
});

// Type guard wrapper for factory compatibility (accepts unknown instead of Run)
type ProfileRun = Extract<
  Parameters<typeof isProfileRun>[0],
  { type: "profile" }
>;
const isProfileRunGuard = (run: unknown): run is ProfileRun =>
  typeof run === "object" &&
  run !== null &&
  "type" in run &&
  isProfileRun(run as Parameters<typeof isProfileRun>[0]);

export const ProfileResultView = createResultView<
  ProfileRun,
  ProfileDiffViewOptions
>({
  displayName: "ProfileResultView",
  typeGuard: isProfileRunGuard,
  expectedRunType: "profile",
  screenshotWrapper: "grid",
  transformData: (run, { viewOptions, onViewOptionsChanged }) => {
    const pinnedColumns = viewOptions?.pinned_columns ?? [];

    // Default proportion columns to percentage display
    const columnsRenderMode = {
      distinct_proportion: "percent" as ColumnRenderMode,
      not_null_proportion: "percent" as ColumnRenderMode,
      ...viewOptions?.columnsRenderMode,
    };

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

    const gridData = createDataGrid(run, {
      pinnedColumns,
      onPinnedColumnsChange: handlePinnedColumnsChanged,
      columnsRenderMode,
      onColumnsRenderModeChanged,
    }) ?? { columns: [], rows: [] };

    return {
      columns: gridData.columns,
      rows: gridData.rows,
      isEmpty: gridData.columns.length === 0,
    };
  },
});
