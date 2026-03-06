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
import Tooltip from "@mui/material/Tooltip";
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
import { buildColumnTooltip, DataTypeIcon } from "../DataTypeIcon";
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
 * Cell renderer for column_name in single profile and side-by-side diff children.
 * Shows the column name + DataTypeIcon inline.
 */
function profileColumnNameRenderer(params: ICellRendererParams<RowObjectType>) {
  const row = params.data;
  if (!row) return null;
  const name = params.value ? String(params.value) : "";
  const dataType = row.data_type ? String(row.data_type) : undefined;
  const tooltipText = buildColumnTooltip({ name, currentType: dataType });

  return (
    <Tooltip title={tooltipText} placement="top">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Box>
        {dataType && <DataTypeIcon type={dataType} size={16} disableTooltip />}
      </Box>
    </Tooltip>
  );
}

/**
 * Cell renderer for column_name in inline diff mode.
 * Reads base/current data types from prefixed keys and renders DataTypeIcon(s).
 */
function profileDiffColumnNameRenderer(
  params: ICellRendererParams<RowObjectType>,
) {
  const row = params.data;
  if (!row) return null;
  const name = params.value ? String(params.value) : "";
  const baseType = row.base__data_type
    ? String(row.base__data_type)
    : undefined;
  const currentType = row.current__data_type
    ? String(row.current__data_type)
    : undefined;
  const isTypeChanged =
    baseType != null && currentType != null && baseType !== currentType;
  const displayType = currentType ?? baseType;
  const tooltipText = buildColumnTooltip({ name, baseType, currentType });

  return (
    <Tooltip title={tooltipText} placement="top">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </Box>
        {isTypeChanged ? (
          <Box
            component="span"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
            }}
          >
            <Box
              component="span"
              sx={{ textDecoration: "line-through", opacity: 0.6 }}
            >
              <DataTypeIcon type={baseType} size={16} disableTooltip />
            </Box>
            <Box component="span" sx={{ fontSize: "0.7em", opacity: 0.5 }}>
              →
            </Box>
            <DataTypeIcon type={currentType} size={16} disableTooltip />
          </Box>
        ) : (
          displayType && (
            <DataTypeIcon type={displayType} size={16} disableTooltip />
          )
        )}
      </Box>
    </Tooltip>
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
 * Post-processes profile grid columns to:
 * 1. Remove data_type columns (flat and side-by-side children)
 * 2. Inject a custom cell renderer on column_name that shows name + DataTypeIcon inline
 */
function injectProfileColumnNameRenderer(
  result: DataGridResult,
): DataGridResult {
  const isInlineDiff =
    result.rows.length > 0 && Object.hasOwn(result.rows[0], "base__data_type");

  const columns = result.columns
    .filter((col) => {
      // Remove data_type columns from ColGroupDef children (side-by-side mode)
      if ("children" in col && col.children) {
        const filtered = col.children.filter(
          (child) => !isDataTypeField((child as ColDef<RowObjectType>).field),
        );
        if (filtered.length === 0) return false;
        (col as ColGroupDef<RowObjectType>).children = filtered;
        return true;
      }
      // Remove flat data_type columns
      return !isDataTypeField((col as ColDef<RowObjectType>).field);
    })
    .map((col) => {
      // Inject renderer on column_name columns
      if ("children" in col && col.children) {
        return {
          ...col,
          children: col.children.map((child) => {
            const childCol = child as ColDef<RowObjectType>;
            if (childCol.field?.toLowerCase() === "column_name") {
              return {
                ...childCol,
                cellRenderer: profileColumnNameRenderer,
              };
            }
            return child;
          }),
        };
      }
      const colDef = col as ColDef<RowObjectType>;
      if (colDef.field?.toLowerCase() === "column_name") {
        return {
          ...colDef,
          cellRenderer: isInlineDiff
            ? profileDiffColumnNameRenderer
            : profileColumnNameRenderer,
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
      return injectProfileColumnNameRenderer(profileResult);
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
      return injectProfileColumnNameRenderer(profileDiffResult);
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
