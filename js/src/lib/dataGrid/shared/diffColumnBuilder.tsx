/**
 * @file diffColumnBuilder.tsx
 * @description OSS wrapper for diff column definition builder
 *
 * This file re-exports the column builder from @datarecce/ui
 * with OSS-specific render components injected.
 */

import {
  buildDiffColumnDefinitions as baseBuildDiffColumnDefinitions,
  type BuildDiffColumnDefinitionsConfig as BaseConfig,
  type BuildDiffColumnDefinitionsResult,
  type DiffColumnDefinition,
  type DiffColumnRenderComponents,
} from "@datarecce/ui/utils";
import {
  DataFrameColumnGroupHeader,
  type DataFrameColumnGroupHeaderProps,
  defaultRenderCell,
  inlineRenderCell,
} from "@/components/ui/dataGrid";

// Re-export types from @datarecce/ui
export type {
  BuildDiffColumnDefinitionsResult,
  DiffColumnDefinition,
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
 * Configuration for building diff column definitions (OSS version)
 * Omits renderComponents since OSS provides them automatically
 */
export interface BuildDiffColumnDefinitionsConfig
  extends Omit<BaseConfig, "renderComponents"> {}

/**
 * Builds AG Grid column definitions from ColumnConfig array
 *
 * @description This is the OSS wrapper that automatically injects
 * the OSS render components. See @datarecce/ui for the core implementation.
 *
 * @example
 * ```tsx
 * const { columns } = buildDiffColumnDefinitions({
 *   columns: columnConfigs,
 *   displayMode: "inline",
 *   headerProps: {
 *     primaryKeys,
 *     pinnedColumns,
 *     onPinnedColumnsChange,
 *   },
 * });
 * ```
 */
export function buildDiffColumnDefinitions(
  config: BuildDiffColumnDefinitionsConfig,
): BuildDiffColumnDefinitionsResult {
  return baseBuildDiffColumnDefinitions({
    ...config,
    renderComponents: ossRenderComponents,
  });
}

// Re-export DataFrameColumnGroupHeaderProps for backward compatibility
export type { DataFrameColumnGroupHeaderProps };
