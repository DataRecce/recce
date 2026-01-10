/**
 * @file configured.ts
 * @description Pre-configured grid utilities with default render components.
 *
 * These exports inject DataFrameColumnGroupHeader, defaultRenderCell, and inlineRenderCell
 * automatically, eliminating the need for consumers to provide render components.
 *
 * Use these when you want the standard UI components without customization.
 * For custom render components, use the base functions and provide your own.
 *
 * @example
 * ```tsx
 * // Pre-configured (no render components needed)
 * import { toDataDiffGridConfigured } from "@datarecce/ui/utils";
 * const { columns, rows } = toDataDiffGridConfigured(base, current, options);
 *
 * // Base function (bring your own render components)
 * import { toDataDiffGrid } from "@datarecce/ui/utils";
 * const { columns, rows } = toDataDiffGrid(base, current, options, {
 *   renderComponents: myCustomComponents,
 * });
 * ```
 */

import type { DataFrame } from "../../api";
import {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
  inlineRenderCell,
} from "../../components/ui";
import {
  type BuildDiffColumnDefinitionsConfig,
  type BuildDiffColumnDefinitionsResult,
  buildDiffColumnDefinitions,
} from "./diffColumnBuilder";
import {
  type DataDiffGridResult,
  type QueryDataDiffGridOptions,
  toDataDiffGrid,
} from "./generators/toDataDiffGrid";
import {
  type DataGridResult,
  type QueryDataGridOptions,
  toDataGrid,
} from "./generators/toDataGrid";
import {
  toValueDiffGrid,
  type ValueDiffGridResult,
} from "./generators/toValueDiffGrid";
import type {
  DiffColumnRenderComponents,
  SimpleColumnRenderComponents,
} from "./renderTypes";
import {
  type BuildSimpleColumnDefinitionsConfig,
  type BuildSimpleColumnDefinitionsResult,
  buildSimpleColumnDefinitions,
} from "./simpleColumnBuilder";
import {
  type DiffColumnConfig,
  type DiffColumnResult,
  toDiffColumn,
} from "./toDiffColumn";

// ============================================================================
// Default Render Components
// ============================================================================

/**
 * Default render components used by diff column pre-configured exports.
 * These are the standard UI components from @datarecce/ui.
 */
export const defaultRenderComponents: DiffColumnRenderComponents = {
  DataFrameColumnGroupHeader,
  defaultRenderCell,
  inlineRenderCell,
};

/**
 * Default render components used by simple column pre-configured exports.
 * These are the standard UI components from @datarecce/ui.
 */
export const defaultSimpleRenderComponents: SimpleColumnRenderComponents = {
  DataFrameColumnGroupHeader,
  DataFrameColumnHeader,
  defaultRenderCell,
};

// ============================================================================
// Pre-configured toDiffColumn
// ============================================================================

/**
 * Configuration for pre-configured toDiffColumn (without renderComponents)
 */
export type DiffColumnConfigConfigured = Omit<
  DiffColumnConfig,
  "renderComponents"
>;

/**
 * Creates a diff column definition with default render components.
 *
 * @param config - Column configuration (renderComponents automatically provided)
 * @returns Column definition compatible with AG Grid
 *
 * @example
 * ```tsx
 * const column = toDiffColumnConfigured({
 *   name: 'price',
 *   columnStatus: 'modified',
 *   columnType: 'number',
 *   displayMode: 'inline',
 * });
 * ```
 */
export function toDiffColumnConfigured(
  config: DiffColumnConfigConfigured,
): DiffColumnResult {
  return toDiffColumn({
    ...config,
    renderComponents: defaultRenderComponents,
  });
}

// ============================================================================
// Pre-configured buildDiffColumnDefinitions
// ============================================================================

/**
 * Configuration for pre-configured buildDiffColumnDefinitions (without renderComponents)
 */
export type BuildDiffColumnDefinitionsConfigConfigured = Omit<
  BuildDiffColumnDefinitionsConfig,
  "renderComponents"
>;

/**
 * Builds AG Grid column definitions with default render components.
 *
 * @param config - Column configuration (renderComponents automatically provided)
 * @returns Column definitions and metadata
 *
 * @example
 * ```tsx
 * const { columns, usedIndexFallback } = buildDiffColumnDefinitionsConfigured({
 *   columns: columnConfigs,
 *   displayMode: "inline",
 *   headerProps: { primaryKeys },
 * });
 * ```
 */
export function buildDiffColumnDefinitionsConfigured(
  config: BuildDiffColumnDefinitionsConfigConfigured,
): BuildDiffColumnDefinitionsResult {
  return buildDiffColumnDefinitions({
    ...config,
    renderComponents: defaultRenderComponents,
  });
}

// ============================================================================
// Pre-configured toDataDiffGrid
// ============================================================================

/**
 * Generates grid configuration for comparing base and current DataFrames
 * with default render components.
 *
 * @param base - The base DataFrame (optional)
 * @param current - The current DataFrame (optional)
 * @param options - Grid options (primary keys, display mode, etc.)
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows, invalidPKeyBase, invalidPKeyCurrent } = toDataDiffGridConfigured(
 *   baseDataFrame,
 *   currentDataFrame,
 *   { primaryKeys: ['id'], displayMode: 'inline' }
 * );
 * ```
 */
export function toDataDiffGridConfigured(
  base?: DataFrame,
  current?: DataFrame,
  options?: QueryDataDiffGridOptions,
): DataDiffGridResult {
  return toDataDiffGrid(base, current, options, {
    renderComponents: defaultRenderComponents,
  });
}

// ============================================================================
// Pre-configured toValueDiffGrid
// ============================================================================

/**
 * Generates grid configuration for value diff (joined data with in_a/in_b)
 * with default render components.
 *
 * @param df - The joined DataFrame with in_a/in_b columns
 * @param primaryKeys - Array of primary key column names
 * @param options - Grid options
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toValueDiffGridConfigured(
 *   joinedDataFrame,
 *   ['id'],
 *   { displayMode: 'inline' }
 * );
 * ```
 */
export function toValueDiffGridConfigured(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
): ValueDiffGridResult {
  return toValueDiffGrid(df, primaryKeys, options, {
    renderComponents: defaultRenderComponents,
  });
}

// ============================================================================
// Pre-configured toDataGrid
// ============================================================================

/**
 * Generates grid configuration for a simple DataFrame display
 * with default render components.
 *
 * @param result - The DataFrame to display
 * @param options - Grid options (primary keys, pinning, etc.)
 * @returns Grid columns and rows ready for AG Grid
 *
 * @example
 * ```tsx
 * const { columns, rows } = toDataGridConfigured(dataFrame, {
 *   primaryKeys: ['id'],
 *   pinnedColumns: [],
 * });
 * ```
 */
export function toDataGridConfigured(
  result: DataFrame,
  options: QueryDataGridOptions,
): DataGridResult {
  return toDataGrid(result, options, {
    renderComponents: defaultSimpleRenderComponents,
  });
}

// ============================================================================
// Pre-configured buildSimpleColumnDefinitions
// ============================================================================

/**
 * Configuration for pre-configured buildSimpleColumnDefinitions (without renderComponents)
 */
export type BuildSimpleColumnDefinitionsConfigConfigured = Omit<
  BuildSimpleColumnDefinitionsConfig,
  "renderComponents"
>;

/**
 * Builds AG Grid column definitions for simple grids with default render components.
 *
 * @param config - Column configuration (renderComponents automatically provided)
 * @returns Column definitions and metadata
 *
 * @example
 * ```tsx
 * const { columns } = buildSimpleColumnDefinitionsConfigured({
 *   columns: columnConfigs,
 *   headerProps: { pinnedColumns },
 * });
 * ```
 */
export function buildSimpleColumnDefinitionsConfigured(
  config: BuildSimpleColumnDefinitionsConfigConfigured,
): BuildSimpleColumnDefinitionsResult {
  return buildSimpleColumnDefinitions({
    ...config,
    renderComponents: defaultSimpleRenderComponents,
  });
}
