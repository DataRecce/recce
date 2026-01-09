/**
 * @file toValueDiffGrid.ts
 * @description OSS wrapper for value diff grid generation
 *
 * This file re-exports the generator from @datarecce/ui
 * with OSS-specific render components injected.
 *
 * NOTE: Backend guarantees:
 * - in_a/in_b columns are always lowercase
 * - primary_keys match actual column casing
 * Therefore, exact string matching is used everywhere.
 */

import "src/components/query/styles.css";
import type { DataFrame } from "@datarecce/ui/api";
import {
  type DiffColumnRenderComponents,
  type QueryDataDiffGridOptions,
  toValueDiffGrid as baseToValueDiffGrid,
  type ValueDiffGridResult,
} from "@datarecce/ui/utils";
import {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
  inlineRenderCell,
} from "@/components/ui/dataGrid";

// Re-export types from @datarecce/ui
export type { QueryDataDiffGridOptions, ValueDiffGridResult } from "@datarecce/ui/utils";

/**
 * OSS-specific render components
 */
const ossRenderComponents: DiffColumnRenderComponents = {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
  inlineRenderCell,
};

/**
 * Generates grid configuration for value diff (joined data with in_a/in_b)
 *
 * @description This is the OSS wrapper that automatically injects
 * the OSS render components. See @datarecce/ui for the core implementation.
 *
 * @param df - The joined DataFrame with in_a/in_b columns
 * @param primaryKeys - Array of primary key column names
 * @param options - Grid options
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toValueDiffGrid(
 *   joinedDataFrame,
 *   ['id'],
 *   { displayMode: 'inline' }
 * );
 * ```
 */
export function toValueDiffGrid(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
): ValueDiffGridResult {
  return baseToValueDiffGrid(df, primaryKeys, options, {
    renderComponents: ossRenderComponents,
  });
}
