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

import type {
  ForwardRefExoticComponent,
  ReactNode,
  RefAttributes,
} from "react";
import {
  type ColumnRenderMode,
  isProfileDiffRun,
  isProfileRun,
  type ProfileDiffResult,
  type ProfileDiffViewOptions,
  type Run,
} from "../../api";
import {
  toDataDiffGridConfigured as toDataDiffGrid,
  toDataGridConfigured as toDataGrid,
} from "../../utils";
import type { DataGridHandle } from "../data/ScreenshotDataGrid";
import { createResultView } from "../result/createResultView";
import type {
  CreatedResultViewProps,
  ResultViewData,
  ResultViewTransformOptions,
} from "../result/types";

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
// Type Guards (wrapper to accept unknown)
// ============================================================================

function isProfileRunGuard(run: unknown): run is ProfileRun {
  return (
    typeof run === "object" &&
    run !== null &&
    "type" in run &&
    isProfileRun(run as Run)
  );
}

function isProfileDiffRunGuard(run: unknown): run is ProfileDiffRun {
  return (
    typeof run === "object" &&
    run !== null &&
    "type" in run &&
    isProfileDiffRun(run as Run)
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts the primary key field name from profile data.
 * The profile data uses "column_name" as the identifier for each row.
 */
function getProfilePrimaryKey(result: ProfileDiffResult): string {
  const field = result.current?.columns.find(
    (f) => f.name.toLowerCase() === "column_name",
  );
  return field?.name ?? "column_name";
}

/**
 * Default proportion columns that should display as percentages
 */
const DEFAULT_PROPORTION_RENDER_MODE: Record<string, ColumnRenderMode> = {
  distinct_proportion: "percent",
  not_null_proportion: "percent",
};

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform ProfileRun data to grid format (single environment)
 */
function transformProfileData(
  run: ProfileRun,
  {
    viewOptions,
    onViewOptionsChanged,
  }: ResultViewTransformOptions<ProfileDiffViewOptions>,
): ResultViewData | null {
  if (!run.result?.current) {
    return null;
  }

  const pinnedColumns = viewOptions?.pinned_columns ?? [];

  // Merge default proportion render modes with user options
  const columnsRenderMode = {
    ...DEFAULT_PROPORTION_RENDER_MODE,
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

  const primaryKey = getProfilePrimaryKey(run.result);

  const gridData = toDataGrid(run.result.current, {
    primaryKeys: [primaryKey],
    pinnedColumns,
    onPinnedColumnsChange: handlePinnedColumnsChanged,
    columnsRenderMode,
    onColumnsRenderModeChanged,
  });

  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: gridData.columns.length === 0,
  };
}

/**
 * Transform ProfileDiffRun data to grid format (comparing environments)
 */
function transformProfileDiffData(
  run: ProfileDiffRun,
  {
    viewOptions,
    onViewOptionsChanged,
  }: ResultViewTransformOptions<ProfileDiffViewOptions>,
): ResultViewData | null {
  if (!run.result) {
    return null;
  }

  const pinnedColumns = viewOptions?.pinned_columns ?? [];
  const displayMode = viewOptions?.display_mode ?? "inline";

  // Merge default proportion render modes with user options
  const columnsRenderMode = {
    ...DEFAULT_PROPORTION_RENDER_MODE,
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

  const primaryKey = getProfilePrimaryKey(run.result);

  const gridData = toDataDiffGrid(run.result.base, run.result.current, {
    primaryKeys: [primaryKey],
    pinnedColumns,
    onPinnedColumnsChange: handlePinnedColumnsChanged,
    displayMode,
    columnsRenderMode,
    onColumnsRenderModeChanged,
  });

  return {
    columns: gridData.columns,
    rows: gridData.rows,
    isEmpty: gridData.columns.length === 0,
  };
}

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
  ProfileRun,
  ProfileDiffViewOptions,
  DataGridHandle
>({
  displayName: "ProfileResultView",
  typeGuard: isProfileRunGuard,
  expectedRunType: "profile",
  screenshotWrapper: "grid",
  transformData: transformProfileData,
  emptyState: "No data",
}) as ForwardRefExoticComponent<
  ProfileResultViewProps & RefAttributes<DataGridHandle>
>;

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
  ProfileDiffRun,
  ProfileDiffViewOptions,
  DataGridHandle
>({
  displayName: "ProfileDiffResultView",
  typeGuard: isProfileDiffRunGuard,
  expectedRunType: "profile_diff",
  screenshotWrapper: "grid",
  transformData: transformProfileDiffData,
  emptyState: "No data",
}) as ForwardRefExoticComponent<
  ProfileResultViewProps & RefAttributes<DataGridHandle>
>;
