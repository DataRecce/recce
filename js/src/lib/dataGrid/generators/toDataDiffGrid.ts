/**
 * @file toDataDiffGrid.ts
 * @description OSS wrapper for data diff grid generation
 *
 * This file re-exports the generator from @datarecce/ui
 * with OSS-specific render components injected.
 */

import "src/components/query/styles.css";
import type { DataFrame } from "@datarecce/ui/api";
import {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
} from "@datarecce/ui/components/ui";
import {
  toDataDiffGrid as baseToDataDiffGrid,
  type DataDiffGridResult,
  type DiffColumnRenderComponents,
  type QueryDataDiffGridOptions,
} from "@datarecce/ui/utils";
import { inlineRenderCell } from "@/components/ui/dataGrid/inlineRenderCell";

// Re-export types from @datarecce/ui
export type {
  DataDiffGridResult,
  QueryDataDiffGridOptions,
} from "@datarecce/ui/utils";

/**
 * OSS-specific render components
 */
const ossRenderComponents: DiffColumnRenderComponents = {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
  inlineRenderCell,
};

/**
 * Generates grid configuration for comparing base and current DataFrames
 *
 * @description This is the OSS wrapper that automatically injects
 * the OSS render components. See @datarecce/ui for the core implementation.
 *
 * @param base - The base DataFrame (optional)
 * @param current - The current DataFrame (optional)
 * @param options - Grid options (primary keys, display mode, etc.)
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows, invalidPKeyBase, invalidPKeyCurrent } = toDataDiffGrid(
 *   baseDataFrame,
 *   currentDataFrame,
 *   { primaryKeys: ['id'], displayMode: 'inline' }
 * );
 * ```
 */
export function toDataDiffGrid(
  _base?: DataFrame,
  _current?: DataFrame,
  options?: QueryDataDiffGridOptions,
): DataDiffGridResult {
  return baseToDataDiffGrid(_base, _current, options, {
    renderComponents: ossRenderComponents,
  });
}
