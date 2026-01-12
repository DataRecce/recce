/**
 * @file ProfileDiffResultView.tsx
 * @description OSS Profile result view components
 *
 * This file provides OSS implementations of Profile result views that use the
 * OSS-specific createDataGrid factory:
 *
 * - ProfileResultView: Single environment profile stats
 * - ProfileDiffResultView: Compares base vs current with RunToolbar header
 *
 * The framework-agnostic versions in @datarecce/ui provide alternative implementations
 * that use the lower-level utilities directly for use by Recce Cloud.
 *
 * Re-exports types from @datarecce/ui for API compatibility.
 */

import {
  type ColumnRenderMode,
  isProfileDiffRun,
  isProfileRun,
  type ProfileDiffViewOptions,
} from "@datarecce/ui/api";
import { DiffDisplayModeSwitch } from "@datarecce/ui/components/ui";
import { createDataGrid } from "@datarecce/ui/components/ui/dataGrid";
import { RunToolbar } from "@datarecce/ui/primitives";
import { createResultView } from "@datarecce/ui/result";

// Re-export types from @datarecce/ui for API compatibility
export type {
  ProfileDiffRun,
  ProfileResultViewProps,
  ProfileRun,
} from "@datarecce/ui/components/profile";

// ============================================================================
// Type Guards
// ============================================================================

// Type guard wrapper for factory compatibility (accepts unknown instead of Run)
type ProfileDiffRunInternal = Extract<
  Parameters<typeof isProfileDiffRun>[0],
  { type: "profile_diff" }
>;

const isProfileDiffRunGuard = (run: unknown): run is ProfileDiffRunInternal =>
  typeof run === "object" &&
  run !== null &&
  "type" in run &&
  isProfileDiffRun(run as Parameters<typeof isProfileDiffRun>[0]);

type ProfileRunInternal = Extract<
  Parameters<typeof isProfileRun>[0],
  { type: "profile" }
>;

const isProfileRunGuard = (run: unknown): run is ProfileRunInternal =>
  typeof run === "object" &&
  run !== null &&
  "type" in run &&
  isProfileRun(run as Parameters<typeof isProfileRun>[0]);

// ============================================================================
// ProfileResultView (single environment)
// ============================================================================

/**
 * Result view for single environment profile stats.
 * Uses the OSS createDataGrid factory for data transformation.
 */
export const ProfileResultView = createResultView<
  ProfileRunInternal,
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

    const handlePinnedColumnsChanged = (newPinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: newPinnedColumns,
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

// ============================================================================
// ProfileDiffResultView (comparing environments)
// ============================================================================

/**
 * OSS-specific ProfileDiffResultView that adds:
 * - RunToolbar header with DiffDisplayModeSwitch
 *
 * Uses the OSS createDataGrid factory for data transformation.
 */
export const ProfileDiffResultView = createResultView<
  ProfileDiffRunInternal,
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

    const handlePinnedColumnsChanged = (newPinnedColumns: string[]) => {
      if (onViewOptionsChanged) {
        onViewOptionsChanged({
          ...viewOptions,
          pinned_columns: newPinnedColumns,
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

    // OSS-specific header with RunToolbar and DiffDisplayModeSwitch
    const header = (
      <RunToolbar>
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
