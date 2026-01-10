/**
 * @file toDataGrid.ts
 * @description OSS wrapper for simple data grid generation
 *
 * This file re-exports the generator from @datarecce/ui
 * with OSS-specific render components injected.
 */

import "src/components/query/styles.css";
import type { DataFrame } from "@datarecce/ui/api";
import {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
} from "@datarecce/ui/components/ui";
import {
  toDataGrid as baseToDataGrid,
  type DataGridResult,
  type QueryDataGridOptions,
  type SimpleColumnRenderComponents,
} from "@datarecce/ui/utils";

// Re-export types from @datarecce/ui
export type { DataGridResult, QueryDataGridOptions } from "@datarecce/ui/utils";

/**
 * OSS-specific render components
 */
const ossRenderComponents: SimpleColumnRenderComponents = {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
};

/**
 * Generates grid configuration for a simple DataFrame display
 *
 * @description This is the OSS wrapper that automatically injects
 * the OSS render components. See @datarecce/ui for the core implementation.
 *
 * @param result - The DataFrame to display
 * @param options - Grid options (primary keys, pinning, etc.)
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toDataGrid(dataFrame, {
 *   primaryKeys: ['id'],
 *   pinnedColumns: [],
 * });
 * ```
 */
export function toDataGrid(
  result: DataFrame,
  options: QueryDataGridOptions,
): DataGridResult {
  return baseToDataGrid(result, options, {
    renderComponents: ossRenderComponents,
  });
}
