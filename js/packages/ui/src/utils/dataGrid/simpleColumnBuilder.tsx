/**
 * @file simpleColumnBuilder.tsx
 * @description Builds AG Grid column definitions for simple (non-diff) grids
 *
 * This module transforms the pure data structures from columnBuilders.ts
 * into actual column definitions with React components for headers.
 *
 * Unlike diffColumnBuilder.tsx, this handles simple grids without:
 * - Base/current value comparison
 * - Inline vs side-by-side display modes
 * - Column status (added/removed/modified)
 */

import type { ColDef, ColGroupDef } from "ag-grid-community";
import type { ColumnRenderMode, RowObjectType } from "../../api";
import type { ColumnConfig } from "./columnBuilders";
import type { SimpleColumnRenderComponents } from "./renderTypes";
import type { RecceColumnContext } from "./toDiffColumn";

// Re-export RecceColumnContext for convenience
export type { RecceColumnContext };

// ============================================================================
// Types
// ============================================================================

/**
 * Extended column type with context metadata
 * Uses context property for custom data per AG Grid best practices
 * Note: Distributed form allows TypeScript to narrow types correctly
 */
export type SimpleColumnDefinition =
  | (ColDef<RowObjectType> & { context?: RecceColumnContext })
  | (ColGroupDef<RowObjectType> & { context?: RecceColumnContext });

/**
 * Configuration for building simple column definitions
 */
export interface BuildSimpleColumnDefinitionsConfig {
  /**
   * Column configurations from getSimpleDisplayColumns()
   */
  columns: ColumnConfig[];

  /**
   * Props to pass to column headers
   */
  headerProps: {
    pinnedColumns?: string[];
    onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
    onColumnsRenderModeChanged?: (
      cols: Record<string, ColumnRenderMode>,
    ) => void;
    formatHeaderName?: (name: string) => string;
  };

  /**
   * Whether to add index column when no primary keys exist
   * Only applies when columns array has no isPrimaryKey entries
   * @default true
   */
  allowIndexFallback?: boolean;

  /**
   * Render components for building the columns
   */
  renderComponents: SimpleColumnRenderComponents;
}

/**
 * Result from building simple column definitions
 */
export interface BuildSimpleColumnDefinitionsResult {
  /**
   * The generated column definitions ready for AG Grid
   */
  columns: SimpleColumnDefinition[];

  /**
   * Whether an index fallback column was added
   */
  usedIndexFallback: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates the index fallback column used when no primary keys are specified
 */
function createIndexColumn(): SimpleColumnDefinition {
  return {
    field: "_index",
    headerName: "",
    width: 50,
    cellClass: "index-column",
    resizable: false,
    pinned: "left",
  };
}

/**
 * Creates a primary key column definition
 *
 * Primary key columns are:
 * - Pinned left (sticky left)
 * - Use DataFrameColumnGroupHeader (with columnStatus="")
 * - Use defaultRenderCell
 */
function createPrimaryKeyColumn(
  config: ColumnConfig,
  headerProps: BuildSimpleColumnDefinitionsConfig["headerProps"],
  renderComponents: SimpleColumnRenderComponents,
): SimpleColumnDefinition {
  const { key, name, columnType, columnRenderMode } = config;
  const { DataFrameColumnGroupHeader, defaultRenderCell } = renderComponents;
  const displayName = headerProps.formatHeaderName?.(name);

  return {
    field: key,
    headerName: displayName ?? name,
    headerComponent: () => (
      <DataFrameColumnGroupHeader
        name={name}
        displayName={displayName}
        columnStatus=""
        columnType={columnType}
        pinnedColumns={headerProps.pinnedColumns}
        onPinnedColumnsChange={headerProps.onPinnedColumnsChange}
        onColumnsRenderModeChanged={headerProps.onColumnsRenderModeChanged}
      />
    ),
    pinned: "left",
    cellRenderer: defaultRenderCell,
    context: { columnType, columnRenderMode },
  };
}

/**
 * Creates a regular (non-PK) column definition
 *
 * Regular columns use DataFrameColumnHeader (simpler, no PK toggle)
 */
function createRegularColumn(
  config: ColumnConfig,
  headerProps: BuildSimpleColumnDefinitionsConfig["headerProps"],
  renderComponents: SimpleColumnRenderComponents,
): SimpleColumnDefinition {
  const { key, name, columnType, columnRenderMode } = config;
  const { DataFrameColumnHeader, defaultRenderCell } = renderComponents;
  const displayName = headerProps.formatHeaderName?.(name);

  return {
    field: key,
    headerName: displayName ?? name,
    headerComponent: () => (
      <DataFrameColumnHeader
        name={name}
        displayName={displayName}
        columnType={columnType}
        pinnedColumns={headerProps.pinnedColumns}
        onPinnedColumnsChange={headerProps.onPinnedColumnsChange}
        onColumnsRenderModeChanged={headerProps.onColumnsRenderModeChanged}
      />
    ),
    cellRenderer: defaultRenderCell,
    context: { columnType, columnRenderMode },
  };
}

// ============================================================================
// Main Function
// ============================================================================

/**
 * Builds AG Grid column definitions from ColumnConfig array
 *
 * @description Transforms pure column configuration objects into actual
 * column definitions with React JSX headers. Handles:
 *
 * - Primary key columns (pinned, use DataFrameColumnGroupHeader)
 * - Regular columns (use DataFrameColumnHeader)
 * - Index fallback (when no PKs and allowIndexFallback is true)
 *
 * @example
 * ```tsx
 * // Get column configs from shared utility
 * const columnConfigs = getSimpleDisplayColumns({
 *   columnMap,
 *   primaryKeys,
 *   pinnedColumns,
 *   columnsRenderMode,
 * });
 *
 * // Build actual column definitions
 * const { columns } = buildSimpleColumnDefinitions({
 *   columns: columnConfigs,
 *   headerProps: {
 *     pinnedColumns,
 *     onPinnedColumnsChange,
 *     onColumnsRenderModeChanged,
 *   },
 *   renderComponents: {
 *     DataFrameColumnGroupHeader,
 *     DataFrameColumnHeader,
 *     defaultRenderCell,
 *   },
 * });
 * ```
 */
export function buildSimpleColumnDefinitions(
  config: BuildSimpleColumnDefinitionsConfig,
): BuildSimpleColumnDefinitionsResult {
  const {
    columns: columnConfigs,
    headerProps,
    allowIndexFallback = true,
    renderComponents,
  } = config;

  const columns: SimpleColumnDefinition[] = [];
  let usedIndexFallback = false;

  // Check if we have any primary key columns
  const hasPrimaryKeys = columnConfigs.some((col) => col.isPrimaryKey);

  // Add index fallback if no PKs and allowed
  if (!hasPrimaryKeys && allowIndexFallback) {
    columns.push(createIndexColumn());
    usedIndexFallback = true;
  }

  // Build column definitions
  for (const colConfig of columnConfigs) {
    if (colConfig.isPrimaryKey) {
      columns.push(
        createPrimaryKeyColumn(colConfig, headerProps, renderComponents),
      );
    } else {
      const regularColumn = createRegularColumn(
        colConfig,
        headerProps,
        renderComponents,
      );

      // Set pinned property - "left" for frozen columns, undefined to explicitly unpin
      // Setting undefined is important to override AG Grid's internal pinned state
      columns.push({
        ...regularColumn,
        pinned: colConfig.frozen ? "left" : undefined,
      });
    }
  }

  return { columns, usedIndexFallback };
}
