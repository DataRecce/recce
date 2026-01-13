"use client";

/**
 * @file ProfileResultView.tsx
 * @description Framework-agnostic Profile result view components for @datarecce/ui
 *
 * These components use the createResultView factory pattern and can be used by both
 * Recce OSS and Recce Cloud. They accept generic Run types and use type guards
 * for validation.
 *
 * The components display profile data in a grid format:
 * - ProfileResultView: Single environment profile stats (column metrics)
 * - ProfileDiffResultView: Diff between environments (base vs current column metrics)
 *
 * OSS-specific features (like RunToolbar, DiffDisplayModeSwitch) should be injected
 * via the header prop or by wrapping these components.
 */

import type { ReactNode } from "react";
import {
  type ColumnRenderMode,
  isProfileDiffRun,
  isProfileRun,
  type ProfileDiffResult,
  type ProfileDiffViewOptions,
  type Run,
} from "../../api";
import { createResultView } from "../result/createResultView";
import type { CreatedResultViewProps } from "../result/types";
import { RunToolbar } from "../run/RunToolbar";
import { DiffDisplayModeSwitch } from "../ui/DiffDisplayModeSwitch";
import { createDataGrid } from "../ui/dataGrid/dataGridFactory";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Run type with profile result (single environment)
 */
export type ProfileRun = Run & {
  type: "profile";
  result?: ProfileDiffResult;
};

/**
 * Run type with profile_diff result
 */
export type ProfileDiffRun = Run & {
  type: "profile_diff";
  result?: ProfileDiffResult;
};

/**
 * Props for ProfileResultView components
 */
export interface ProfileResultViewProps
  extends CreatedResultViewProps<ProfileDiffViewOptions> {
  run: ProfileRun | ProfileDiffRun | unknown;
  /**
   * Optional header element to render above the grid.
   * Use this to inject OSS-specific controls like RunToolbar.
   */
  header?: ReactNode;
}

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
// Factory-Created Components
// ============================================================================

/**
 * Result view for single environment profile stats
 *
 * Displays a grid with column metrics (count, distinct, null proportion, etc.)
 * for a single dbt model.
 *
 * @example
 * ```tsx
 * <ProfileResultView run={profileRun} ref={gridRef} />
 * ```
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

/**
 * Result view for comparing profile stats between base and current environments
 *
 * Displays a grid with column metrics from both environments,
 * styled to highlight differences.
 *
 * @example
 * ```tsx
 * <ProfileDiffResultView
 *   run={profileDiffRun}
 *   ref={gridRef}
 *   viewOptions={{ display_mode: "inline" }}
 *   onViewOptionsChanged={setViewOptions}
 * />
 * ```
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
