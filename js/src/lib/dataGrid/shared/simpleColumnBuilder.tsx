/**
 * @file simpleColumnBuilder.tsx
 * @description OSS wrapper for simple column definition builder
 *
 * This file re-exports the column builder from @datarecce/ui
 * with OSS-specific render components injected.
 */

import {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
} from "@datarecce/ui/components/ui";
import {
  type BuildSimpleColumnDefinitionsConfig as BaseConfig,
  type BuildSimpleColumnDefinitionsResult,
  buildSimpleColumnDefinitions as baseBuildSimpleColumnDefinitions,
  type RecceColumnContext,
  type SimpleColumnDefinition,
  type SimpleColumnRenderComponents,
} from "@datarecce/ui/utils";

// Re-export types from @datarecce/ui
export type {
  BuildSimpleColumnDefinitionsResult,
  RecceColumnContext,
  SimpleColumnDefinition,
} from "@datarecce/ui/utils";

/**
 * OSS-specific render components
 */
const ossRenderComponents: SimpleColumnRenderComponents = {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
};

/**
 * Configuration for building simple column definitions (OSS version)
 * Omits renderComponents since OSS provides them automatically
 */
export interface BuildSimpleColumnDefinitionsConfig
  extends Omit<BaseConfig, "renderComponents"> {}

/**
 * Builds AG Grid column definitions from ColumnConfig array
 *
 * @description This is the OSS wrapper that automatically injects
 * the OSS render components. See @datarecce/ui for the core implementation.
 *
 * @example
 * ```tsx
 * const { columns } = buildSimpleColumnDefinitions({
 *   columns: columnConfigs,
 *   headerProps: {
 *     pinnedColumns,
 *     onPinnedColumnsChange,
 *     onColumnsRenderModeChanged,
 *   },
 * });
 * ```
 */
export function buildSimpleColumnDefinitions(
  config: BuildSimpleColumnDefinitionsConfig,
): BuildSimpleColumnDefinitionsResult {
  return baseBuildSimpleColumnDefinitions({
    ...config,
    renderComponents: ossRenderComponents,
  });
}
