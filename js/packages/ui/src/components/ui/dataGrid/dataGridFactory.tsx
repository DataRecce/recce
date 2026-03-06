/**
 * @file dataGridFactory.ts
 * @description Abstract factory for creating data grid configurations
 *
 * This file provides a unified interface for generating grid data
 * for different run types (query, query_diff, value_diff, value_diff_detail, profile, profile_diff)
 *
 * It wraps the existing implementations:
 * - toDataGrid for single DataFrame display
 * - toDataDiffGrid for comparing two DataFrames
 * - toValueDiffGrid for joined diff data (with in_a/in_b columns)
 * - toValueDataGrid for value_diff summary (column match statistics)
 */

import Box from "@mui/material/Box";
import type {
  ColDef,
  ColGroupDef,
  ICellRendererParams,
} from "ag-grid-community";
import type { QueryDiffResult } from "../../../api/adhocQuery";
import type { NodeData } from "../../../api/info";
import type { ProfileDiffResult } from "../../../api/profile";
import type { RowCountDiffResult, RowCountResult } from "../../../api/rowcount";
import type { Run } from "../../../api/types";
import {
  type ColumnRenderMode,
  type ColumnType,
  type DataFrame,
  isProfileDiffRun,
  isProfileRun,
  isQueryBaseRun,
  isQueryDiffRun,
  isQueryRun,
  isRowCountDiffRun,
  isRowCountRun,
  isValueDiffDetailRun,
  isValueDiffRun,
  type RowObjectType,
} from "../../../api/types";
import type { ValueDiffParams, ValueDiffResult } from "../../../api/valuediff";
import {
  mergeColumns,
  type SchemaDataGridOptions,
  type SchemaDataGridResult,
  type SingleEnvSchemaDataGridResult,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
} from "../../../lib/dataGrid/generators/toSchemaDataGrid";
// Import existing implementations from @datarecce/ui
import {
  toDataDiffGridConfigured as toDataDiffGrid,
  toDataGridConfigured as toDataGrid,
  toRowCountDataGrid,
  toRowCountDiffDataGrid,
  toValueDiffGridConfigured as toValueDiffGrid,
} from "../../../utils/dataGrid";
import { DataTypeIcon } from "../DataTypeIcon";
import { toValueDataGrid } from "./generators/toValueDataGrid";

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
  columns: ((ColDef<RowObjectType> | ColGroupDef<RowObjectType>) & {
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
  | { kind: "value_diff"; result: ValueDiffResult; params: ValueDiffParams }
  | { kind: "value_diff_detail"; result: DataFrame; primaryKeys: string[] }
  | { kind: "profile"; result: ProfileDiffResult }
  | { kind: "profile_diff"; result: ProfileDiffResult }
  // NEW: Add row count types
  | { kind: "row_count"; result: RowCountResult }
  | { kind: "row_count_diff"; result: RowCountDiffResult };

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

  if (isValueDiffRun(run)) {
    if (!run.result || !run.params) return null;
    return {
      kind: "value_diff",
      result: run.result,
      params: run.params,
    };
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

  if (isRowCountRun(run)) {
    if (!run.result) return null;
    return { kind: "row_count", result: run.result };
  }

  if (isRowCountDiffRun(run)) {
    if (!run.result) return null;
    return { kind: "row_count_diff", result: run.result };
  }

  return null;
}

/**
 * Cell renderer that displays a DataTypeIcon for data_type values.
 * Used for simple (non-diff) columns and side-by-side diff children
 * where params.value resolves directly to the data type string.
 */
function dataTypeIconCellRenderer(params: ICellRendererParams<RowObjectType>) {
  const value = params.value;
  if (!value) return null;
  return <DataTypeIcon type={String(value)} size={20} />;
}

/**
 * Cell renderer for inline diff mode data_type columns.
 * In inline diff mode, the column field is "data_type" but the row data
 * stores values under "base__data_type" and "current__data_type" prefixed keys.
 * This renderer reads from both prefixed keys and renders DataTypeIcon(s).
 */
function dataTypeIconInlineDiffCellRenderer(
  params: ICellRendererParams<RowObjectType>,
) {
  if (!params.data) return null;

  const columnKey = (params.colDef as ColDef<RowObjectType>)?.field ?? "";
  const row = params.data;
  const baseKey = `base__${columnKey}`.toLowerCase();
  const currentKey = `current__${columnKey}`.toLowerCase();

  const baseValue = row[baseKey];
  const currentValue = row[currentKey];

  const hasBase = Object.hasOwn(row, baseKey);
  const hasCurrent = Object.hasOwn(row, currentKey);

  if (!hasBase && !hasCurrent) return null;

  // Values are the same — render a single icon
  if (baseValue === currentValue) {
    return <DataTypeIcon type={String(currentValue)} size={20} />;
  }

  // Values differ — render both icons with diff styling
  return (
    <Box
      sx={{
        display: "flex",
        gap: "5px",
        alignItems: "center",
        height: "100%",
      }}
    >
      {hasBase && baseValue && (
        <Box
          component="span"
          sx={{ textDecoration: "line-through", opacity: 0.6 }}
        >
          <DataTypeIcon type={String(baseValue)} size={20} />
        </Box>
      )}
      {hasCurrent && currentValue && (
        <DataTypeIcon type={String(currentValue)} size={20} />
      )}
    </Box>
  );
}

/**
 * Checks if a column field name represents a data_type column.
 * Matches "data_type", "base__data_type", and "current__data_type".
 */
function isDataTypeField(field: string | undefined): boolean {
  if (!field) return false;
  const lower = field.toLowerCase();
  return (
    lower === "data_type" ||
    lower === "base__data_type" ||
    lower === "current__data_type"
  );
}

/**
 * Post-processes grid columns to inject DataTypeIcon renderer for data_type columns.
 * Handles:
 * - Flat ColDef with field "data_type" (inline diff mode or simple profile)
 * - ColGroupDef with children (side-by-side diff mode)
 *
 * For inline diff mode, uses a special renderer that reads from base__/current__ prefixed keys.
 * For side-by-side mode, uses the simple renderer since each child column resolves directly.
 */
function injectDataTypeIconRenderer(result: DataGridResult): DataGridResult {
  const columns = result.columns.map((col) => {
    // ColGroupDef with children (side-by-side diff mode)
    if ("children" in col && col.children) {
      const hasDataTypeChild = col.children.some((child) =>
        isDataTypeField((child as ColDef<RowObjectType>).field),
      );
      if (hasDataTypeChild) {
        return {
          ...col,
          children: col.children.map((child) => {
            const childCol = child as ColDef<RowObjectType>;
            if (isDataTypeField(childCol.field)) {
              return { ...childCol, cellRenderer: dataTypeIconCellRenderer };
            }
            return child;
          }),
        };
      }
      return col;
    }

    // Flat ColDef
    const colDef = col as ColDef<RowObjectType>;
    if (isDataTypeField(colDef.field)) {
      // Check if this is an inline diff column (field is "data_type" but data
      // lives under base__/current__ prefixed keys) or a simple column
      // (field is "data_type" and data lives directly under that key).
      // Detect by checking if the row data actually has base__data_type keys.
      const isInlineDiff =
        colDef.field === "data_type" &&
        result.rows.length > 0 &&
        Object.hasOwn(result.rows[0], "base__data_type");
      return {
        ...colDef,
        cellRenderer: isInlineDiff
          ? dataTypeIconInlineDiffCellRenderer
          : dataTypeIconCellRenderer,
      };
    }
    return col;
  });

  return { ...result, columns };
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

    case "value_diff":
      return toValueDataGrid(dataKind.result, { params: dataKind.params });

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
      const profileResult = toDataGrid(dataKind.result.current, {
        primaryKeys: [primaryKey],
        pinnedColumns: options.pinnedColumns,
        onPinnedColumnsChange: options.onPinnedColumnsChange,
        columnsRenderMode: options.columnsRenderMode,
        onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
      });
      return injectDataTypeIconRenderer(profileResult);
    }

    case "profile_diff": {
      const primaryKey = getProfilePrimaryKey(dataKind.result);
      const profileDiffResult = toDataDiffGrid(
        dataKind.result.base,
        dataKind.result.current,
        {
          primaryKeys: [primaryKey],
          pinnedColumns: options.pinnedColumns,
          onPinnedColumnsChange: options.onPinnedColumnsChange,
          displayMode: options.displayMode,
          columnsRenderMode: options.columnsRenderMode,
          onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
        },
      );
      return injectDataTypeIconRenderer(profileDiffResult);
    }

    case "row_count":
      return toRowCountDataGrid(dataKind.result);

    case "row_count_diff":
      return toRowCountDiffDataGrid(dataKind.result);

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
  | { type: "joined"; dataframe: DataFrame; primaryKeys: string[] }
  | {
      type: "schema_diff";
      base?: NodeData["columns"];
      current?: NodeData["columns"];
    }
  | { type: "schema_single"; columns?: NodeData["columns"] };

/**
 * Union of all possible grid results from createDataGridFromData
 */
export type DataGridFromDataResult =
  | DataGridResult
  | SchemaDataGridResult
  | SingleEnvSchemaDataGridResult;

/**
 * Alternative factory that accepts raw data instead of Run objects
 * Useful for testing or when you have data outside the Run structure
 *
 * @overload For DataFrame inputs, returns DataGridResult
 * @overload For schema inputs, returns schema-specific result types
 */
export function createDataGridFromData(
  input:
    | { type: "joined"; dataframe: DataFrame; primaryKeys: string[] }
    | { type: "dual"; base?: DataFrame; current?: DataFrame }
    | { type: "single"; dataframe: DataFrame },
  options?: DiffGridOptions,
): DataGridResult;
export function createDataGridFromData(
  input: {
    type: "schema_diff";
    base?: NodeData["columns"];
    current?: NodeData["columns"];
  },
  options?: SchemaDataGridOptions,
): SchemaDataGridResult;
export function createDataGridFromData(
  input: { type: "schema_single"; columns?: NodeData["columns"] },
  options?: SchemaDataGridOptions,
): SingleEnvSchemaDataGridResult;
export function createDataGridFromData(
  input: DataGridInput,
  options?: DiffGridOptions | SchemaDataGridOptions,
): DataGridFromDataResult {
  switch (input.type) {
    case "single":
      return toDataGrid(input.dataframe, (options ?? {}) as DiffGridOptions);

    case "dual":
      return toDataDiffGrid(
        input.base,
        input.current,
        (options ?? {}) as DiffGridOptions,
      );

    case "joined":
      return toValueDiffGrid(
        input.dataframe,
        input.primaryKeys,
        (options ?? {}) as DiffGridOptions,
      );

    case "schema_diff": {
      const schemaDiff = mergeColumns(input.base, input.current);
      return toSchemaDataGrid(
        schemaDiff,
        (options ?? {}) as SchemaDataGridOptions,
      );
    }

    case "schema_single":
      return toSingleEnvDataGrid(
        input.columns,
        (options ?? {}) as SchemaDataGridOptions,
      );
  }
}
