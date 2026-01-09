/**
 * @file toDiffColumn.tsx
 * @description OSS wrapper for shared diff column builder
 *
 * This file re-exports the column builder from @datarecce/ui
 * with OSS-specific render components injected.
 */

import {
  type DiffColumnConfig as BaseConfig,
  toDiffColumn as baseToDiffColumn,
  createCellClassBase,
  createCellClassCurrent,
  type DataFrameColumnGroupHeaderProps,
  type DiffColumnRenderComponents,
  type DiffColumnResult,
} from "@datarecce/ui/utils";
import {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
  inlineRenderCell,
} from "@/components/ui/dataGrid";

// Re-export types and functions from @datarecce/ui
export type {
  DataFrameColumnGroupHeaderProps,
  DiffColumnResult,
} from "@datarecce/ui/utils";
export {
  createCellClassBase,
  createCellClassCurrent,
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
 * Configuration for building a diff column (OSS version)
 * Omits renderComponents since OSS provides them automatically
 */
export interface DiffColumnConfig
  extends Omit<BaseConfig, "renderComponents"> {}

/**
 * Creates a diff column definition for use in data grids
 *
 * @description This is the OSS wrapper that automatically injects
 * the OSS render components. See @datarecce/ui for the core implementation.
 *
 * @example
 * // Inline mode for querydiff
 * const column = toDiffColumn({
 *   name: 'price',
 *   columnStatus: 'modified',
 *   columnType: 'number',
 *   displayMode: 'inline',
 *   headerProps: {
 *     primaryKeys: ['id'],
 *     onPrimaryKeyChange: setPrimaryKeys,
 *   },
 * });
 */
export function toDiffColumn(config: DiffColumnConfig): DiffColumnResult {
  return baseToDiffColumn({
    ...config,
    renderComponents: ossRenderComponents,
  });
}
