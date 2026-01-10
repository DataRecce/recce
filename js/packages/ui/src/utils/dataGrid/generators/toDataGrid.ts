/**
 * @file toDataGrid.ts
 * @description Simple data grid generation for single DataFrame display
 *
 * Unlike toDataDiffGrid, this handles non-diff scenarios
 * where we just display a single DataFrame without base/current comparison.
 *
 * This module provides the core grid generation logic with render component injection.
 * OSS provides wrapped versions that inject OSS-specific components.
 */

import type { ColDef, ColGroupDef } from "ag-grid-community";
import type { ColumnRenderMode, DataFrame, RowObjectType } from "../../../api";
import { dataFrameToRowObjects } from "../../transforms";
import { getSimpleDisplayColumns } from "../columnBuilders";
import { buildColumnMap } from "../gridUtils";
import type { SimpleColumnRenderComponents } from "../renderTypes";
import {
  buildSimpleColumnDefinitions,
  type SimpleColumnDefinition,
} from "../simpleColumnBuilder";
import { validateToDataGridInputs } from "../validation";

// ============================================================================
// Types
// ============================================================================

/**
 * Options for generating a simple data grid
 */
export interface QueryDataGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

/**
 * Configuration for building the data grid
 */
export interface ToDataGridConfig {
  /**
   * Render components for column headers and cells
   */
  renderComponents: SimpleColumnRenderComponents;
}

/**
 * Result of generating a data grid
 */
export interface DataGridResult {
  columns: SimpleColumnDefinition[];
  rows: RowObjectType[];
}

// ============================================================================
// Main Grid Generation Function
// ============================================================================

/**
 * Generates grid configuration for a simple DataFrame display
 *
 * @param result - The DataFrame to display
 * @param options - Grid options (primary keys, pinning, etc.)
 * @param config - Configuration with render components
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toDataGrid(
 *   dataFrame,
 *   { primaryKeys: ['id'], pinnedColumns: [] },
 *   { renderComponents }
 * );
 * ```
 */
export function toDataGrid(
  result: DataFrame,
  options: QueryDataGridOptions,
  config: ToDataGridConfig,
): DataGridResult {
  validateToDataGridInputs(result, options);

  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];
  const columnsRenderMode = options.columnsRenderMode ?? {};

  // Build column map from DataFrame
  const columnMap = buildColumnMap(result);

  // Get column configurations (pure data)
  const columnConfigs = getSimpleDisplayColumns({
    columnMap,
    primaryKeys,
    pinnedColumns,
    columnsRenderMode,
  });

  // Build column definitions with React components
  const { columns } = buildSimpleColumnDefinitions({
    columns: columnConfigs,
    headerProps: {
      pinnedColumns,
      onPinnedColumnsChange: options.onPinnedColumnsChange,
      onColumnsRenderModeChanged: options.onColumnsRenderModeChanged,
    },
    allowIndexFallback: true,
    renderComponents: config.renderComponents,
  });

  return { columns, rows: dataFrameToRowObjects(result) };
}
