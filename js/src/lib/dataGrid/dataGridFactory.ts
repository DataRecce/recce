/**
 * @file dataGridFactory.ts
 * @description Abstract factory for creating data grid configurations
 *
 * This file provides a unified interface for generating grid data
 * for different run types (query, query_diff, value_diff_detail, profile, profile_diff)
 *
 * It wraps the existing implementations:
 * - toDataGrid from QueryResultView.tsx
 * - toDataDiffGrid from querydiff.ts
 * - toValueDiffGrid from valuediff.ts
 */

import { ColumnOrColumnGroup } from "react-data-grid";
// Import existing implementations
import { toDataGrid } from "@/components/query/QueryResultView";
import { QueryDiffResult } from "@/lib/api/adhocQuery";
import { ProfileDiffResult } from "@/lib/api/profile";
import {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  isProfileDiffRun,
  isProfileRun,
  isQueryBaseRun,
  isQueryDiffRun,
  isQueryRun,
  isValueDiffDetailRun,
  RowObjectType,
  Run,
} from "@/lib/api/types";
import { toDataDiffGrid } from "@/lib/dataGrid/generators/toDataDiffGrid";
import { toValueDiffGrid } from "@/lib/dataGrid/generators/toValueDiffGrid";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Common options shared across all grid types
 */
export interface BaseGridOptions {
  primaryKeys?: string[];
  pinnedColumns?: string[];
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  onColumnsRenderModeChanged?: (cols: Record<string, ColumnRenderMode>) => void;
}

/**
 * Additional options for diff grids
 */
export interface DiffGridOptions extends BaseGridOptions {
  changedOnly?: boolean;
  displayMode?: "inline" | "side_by_side";
  baseTitle?: string;
  currentTitle?: string;
}

/**
 * Standard output structure for all grid generation functions
 */
export interface DataGridResult {
  columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[];
  rows: RowObjectType[];
  invalidPKeyBase?: boolean;
  invalidPKeyCurrent?: boolean;
}

/**
 * Discriminated union for run result data
 */
type RunResultData =
  | { kind: "query"; result: DataFrame }
  | { kind: "query_diff_separate"; result: QueryDiffResult }
  | {
      kind: "query_diff_joined";
      result: QueryDiffResult;
      primaryKeys: string[];
    }
  | { kind: "value_diff_detail"; result: DataFrame; primaryKeys: string[] }
  | { kind: "profile"; result: ProfileDiffResult }
  | { kind: "profile_diff"; result: ProfileDiffResult };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines the appropriate grid generation strategy based on run type and data
 */
function determineDataKind(run: Run): RunResultData | null {
  if (isQueryRun(run) || isQueryBaseRun(run)) {
    if (!run.result) return null;
    return { kind: "query", result: run.result };
  }

  if (isQueryDiffRun(run)) {
    if (!run.result) return null;
    // If the result has a `diff` field, it's pre-joined data
    if (run.result.diff && run.params?.primary_keys) {
      return {
        kind: "query_diff_joined",
        result: run.result,
        primaryKeys: run.params.primary_keys,
      };
    }
    // Otherwise, it's separate base/current DataFrames
    return { kind: "query_diff_separate", result: run.result };
  }

  if (isValueDiffDetailRun(run)) {
    if (!run.result || !run.params?.primary_key) return null;
    const primaryKey = run.params.primary_key;
    const primaryKeys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
    return {
      kind: "value_diff_detail",
      result: run.result,
      primaryKeys,
    };
  }

  if (isProfileRun(run)) {
    if (!run.result?.current) return null;
    return { kind: "profile", result: run.result };
  }

  if (isProfileDiffRun(run)) {
    if (!run.result) return null;
    return { kind: "profile_diff", result: run.result };
  }

  return null;
}

/**
 * Extracts the primary key field name from profile data
 */
function getProfilePrimaryKey(result: ProfileDiffResult): string {
  const field = result.current?.columns.find(
    (f) => f.name.toLowerCase() === "column_name",
  );
  return field?.name ?? "column_name";
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates grid data from a Run object and options
 *
 * This is the main entry point that abstracts away the different
 * data transformations needed for different run types.
 *
 * @param run - The Run object containing result data
 * @param options - Grid configuration options
 * @returns DataGridResult with columns and rows, or null if invalid
 *
 * @example
 * ```tsx
 * const gridData = createDataGrid(run, {
 *   primaryKeys: ['id'],
 *   pinnedColumns: ['name'],
 *   changedOnly: true,
 *   displayMode: 'inline',
 * });
 *
 * if (gridData) {
 *   return <ScreenshotDataGrid columns={gridData.columns} rows={gridData.rows} />;
 * }
 * ```
 */
export function createDataGrid(
  run: Run,
  options: DiffGridOptions = {},
): DataGridResult | null {
  const dataKind = determineDataKind(run);
  if (!dataKind) return null;

  switch (dataKind.kind) {
    case "query":
      return toDataGrid(dataKind.result, {
        primaryKeys: options.primaryKeys,
        pinnedColumns: options.pinnedColumns,
        columnsRenderMode: options.columnsRenderMode,
        onPrimaryKeyChange: options.onPrimaryKeyChange,
        onPinnedColumnsChange: options.onPinnedColumnsChange,
        onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
      });

    case "query_diff_separate":
      return toDataDiffGrid(
        dataKind.result.base,
        dataKind.result.current,
        options,
      );

    case "query_diff_joined":
      if (!dataKind.result.diff) {
        return null;
      }
      return toValueDiffGrid(dataKind.result.diff, dataKind.primaryKeys, {
        changedOnly: options.changedOnly,
        pinnedColumns: options.pinnedColumns,
        onPinnedColumnsChange: options.onPinnedColumnsChange,
        baseTitle: options.baseTitle,
        currentTitle: options.currentTitle,
        displayMode: options.displayMode,
        columnsRenderMode: options.columnsRenderMode,
        onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
      });

    case "value_diff_detail":
      return toValueDiffGrid(dataKind.result, dataKind.primaryKeys, {
        changedOnly: options.changedOnly,
        pinnedColumns: options.pinnedColumns,
        onPinnedColumnsChange: options.onPinnedColumnsChange,
        displayMode: options.displayMode,
        columnsRenderMode: options.columnsRenderMode,
        onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
      });

    case "profile": {
      if (!dataKind.result.current) {
        return null;
      }
      const primaryKey = getProfilePrimaryKey(dataKind.result);
      return toDataGrid(dataKind.result.current, {
        primaryKeys: [primaryKey],
        pinnedColumns: options.pinnedColumns,
        onPinnedColumnsChange: options.onPinnedColumnsChange,
        columnsRenderMode: options.columnsRenderMode,
        onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
      });
    }

    case "profile_diff": {
      const primaryKey = getProfilePrimaryKey(dataKind.result);
      return toDataDiffGrid(dataKind.result.base, dataKind.result.current, {
        primaryKeys: [primaryKey],
        pinnedColumns: options.pinnedColumns,
        onPinnedColumnsChange: options.onPinnedColumnsChange,
        displayMode: options.displayMode,
        columnsRenderMode: options.columnsRenderMode,
        onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
      });
    }

    default:
      return null;
  }
}

/**
 * Input types for the data-only factory function
 */
export type DataGridInput =
  | { type: "single"; dataframe: DataFrame }
  | { type: "dual"; base?: DataFrame; current?: DataFrame }
  | { type: "joined"; dataframe: DataFrame; primaryKeys: string[] };

/**
 * Alternative factory that accepts raw data instead of Run objects
 * Useful for testing or when you have data outside the Run structure
 */
export function createDataGridFromData(
  input: DataGridInput,
  options: DiffGridOptions = {},
): DataGridResult {
  switch (input.type) {
    case "single":
      return toDataGrid(input.dataframe, options);

    case "dual":
      return toDataDiffGrid(input.base, input.current, options);

    case "joined":
      return toValueDiffGrid(input.dataframe, input.primaryKeys, options);
  }
}

// Re-export the underlying functions for backward compatibility
export { toDataGrid, toDataDiffGrid, toValueDiffGrid };
