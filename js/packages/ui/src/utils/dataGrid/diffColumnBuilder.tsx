/**
 * @file diffColumnBuilder.tsx
 * @description Builds AG Grid column definitions from ColumnConfig[]
 *
 * This module transforms the pure data structures from columnBuilders.ts
 * into actual column definitions with React components for headers.
 */

import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import type { RowObjectType } from "../../api";
import type { ColumnConfig } from "./columnBuilders";
import type {
  DataFrameColumnGroupHeaderProps,
  DiffColumnRenderComponents,
} from "./renderTypes";
import type { RecceColumnContext } from "./toDiffColumn";
import { toDiffColumn } from "./toDiffColumn";

// ============================================================================
// Types
// ============================================================================

/**
 * Extended column type with context metadata
 * Uses context property for custom data per AG Grid best practices
 * Note: Distributed form allows TypeScript to narrow types correctly
 */
export type DiffColumnDefinition =
  | (ColDef<RowObjectType> & { context?: RecceColumnContext })
  | (ColGroupDef<RowObjectType> & { context?: RecceColumnContext });

/**
 * Configuration for building diff column definitions
 */
export interface BuildDiffColumnDefinitionsConfig {
  /**
   * Column configurations from getDisplayColumns()
   */
  columns: ColumnConfig[];

  /**
   * Display mode for diff columns
   * - "inline": Single column with inline diff rendering
   * - "side_by_side": Column group with base/current sub-columns
   */
  displayMode: "inline" | "side_by_side";

  /**
   * Props to pass to DataFrameColumnGroupHeader for all columns
   */
  headerProps: Partial<DataFrameColumnGroupHeaderProps>;

  /**
   * Title for base column in side_by_side mode
   */
  baseTitle?: string;

  /**
   * Title for current column in side_by_side mode
   */
  currentTitle?: string;

  /**
   * Whether to add index column when no primary keys exist
   * Only applies when columns array has no isPrimaryKey entries
   * @default false
   */
  allowIndexFallback?: boolean;

  /**
   * Render components for building the columns
   */
  renderComponents: DiffColumnRenderComponents;

  /**
   * Optional function to format column names for display
   */
  formatHeaderName?: (name: string) => string;
}

/**
 * Result from building diff column definitions
 */
export interface BuildDiffColumnDefinitionsResult {
  /**
   * The generated column definitions ready for AG Grid
   */
  columns: DiffColumnDefinition[];

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
function createIndexColumn(): DiffColumnDefinition {
  return {
    field: "_index",
    headerName: "",
    width: 50,
    maxWidth: 100,
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
 * - Have a special cellClass based on row status
 * - Use defaultRenderCell (no base__/current__ prefixing)
 */
function createPrimaryKeyColumn(
  config: ColumnConfig,
  headerProps: Partial<DataFrameColumnGroupHeaderProps>,
  renderComponents: DiffColumnRenderComponents,
  formatHeaderName?: (name: string) => string,
): DiffColumnDefinition {
  const { key, name, columnType, columnStatus, columnRenderMode } = config;
  const { DataFrameColumnGroupHeader, defaultRenderCell } = renderComponents;
  const displayName = formatHeaderName?.(name);

  return {
    field: key,
    headerName: displayName ?? name,
    headerComponent: () => (
      <DataFrameColumnGroupHeader
        name={name}
        displayName={displayName}
        columnStatus={columnStatus ?? ""}
        columnType={columnType}
        {...headerProps}
      />
    ),
    pinned: "left",
    cellClass: (params: CellClassParams<RowObjectType>) => {
      if (params.data?.__status) {
        return `diff-header-${params.data.__status}`;
      }
      return undefined;
    },
    cellRenderer: defaultRenderCell,
    context: { columnType, columnRenderMode },
  };
}

/**
 * Creates a diff column definition (non-PK column)
 *
 * Uses toDiffColumn() to handle inline vs side_by_side modes
 */
function createDiffColumn(
  config: ColumnConfig,
  displayMode: "inline" | "side_by_side",
  headerProps: Partial<DataFrameColumnGroupHeaderProps>,
  renderComponents: DiffColumnRenderComponents,
  baseTitle?: string,
  currentTitle?: string,
  formatHeaderName?: (name: string) => string,
): DiffColumnDefinition {
  const { name, columnType, columnStatus, columnRenderMode } = config;

  return toDiffColumn({
    name,
    displayName: formatHeaderName?.(name),
    columnStatus: columnStatus ?? "",
    columnType,
    columnRenderMode,
    displayMode,
    baseTitle,
    currentTitle,
    headerProps,
    renderComponents,
  });
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
 * - Primary key columns (pinned, special cellClass)
 * - Diff columns (via toDiffColumn for inline/side_by_side modes)
 * - Index fallback (when no PKs and allowIndexFallback is true)
 *
 * @example
 * ```tsx
 * // Get column configs from shared utility
 * const columnConfigs = getDisplayColumns({
 *   columnMap,
 *   primaryKeys,
 *   pinnedColumns,
 *   columnsRenderMode,
 *   changedOnly,
 *   rowStats,
 *   excludeColumns: ["in_a", "in_b"],
 * });
 *
 * // Build actual column definitions
 * const { columns } = buildDiffColumnDefinitions({
 *   columns: columnConfigs,
 *   displayMode: "inline",
 *   headerProps: {
 *     primaryKeys,
 *     pinnedColumns,
 *     onPinnedColumnsChange,
 *   },
 *   renderComponents: {
 *     DataFrameColumnGroupHeader,
 *     defaultRenderCell,
 *     inlineRenderCell,
 *   },
 * });
 * ```
 *
 * @example
 * ```tsx
 * // With index fallback for querydiff when no PKs
 * const { columns, usedIndexFallback } = buildDiffColumnDefinitions({
 *   columns: columnConfigs,
 *   displayMode: "side_by_side",
 *   allowIndexFallback: true,
 *   headerProps: {
 *     primaryKeys: [],
 *     pinnedColumns,
 *     onPrimaryKeyChange,
 *     onPinnedColumnsChange,
 *   },
 *   renderComponents: {
 *     DataFrameColumnGroupHeader,
 *     defaultRenderCell,
 *     inlineRenderCell,
 *   },
 * });
 *
 * if (usedIndexFallback) {
 *   // Index-based matching was used
 * }
 * ```
 */
export function buildDiffColumnDefinitions(
  config: BuildDiffColumnDefinitionsConfig,
): BuildDiffColumnDefinitionsResult {
  const {
    columns: columnConfigs,
    displayMode,
    headerProps,
    baseTitle,
    currentTitle,
    allowIndexFallback = false,
    renderComponents,
    formatHeaderName,
  } = config;

  const columns: DiffColumnDefinition[] = [];
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
      // Primary key column - pinned with special cellClass
      columns.push(
        createPrimaryKeyColumn(
          colConfig,
          headerProps,
          renderComponents,
          formatHeaderName,
        ),
      );
    } else {
      // Regular diff column - uses toDiffColumn for inline/side_by_side
      const diffColumn = createDiffColumn(
        colConfig,
        displayMode,
        headerProps,
        renderComponents,
        baseTitle,
        currentTitle,
        formatHeaderName,
      );

      // Set pinned property - "left" for frozen columns, undefined to explicitly unpin
      // Setting undefined is important to override AG Grid's internal pinned state
      columns.push({
        ...diffColumn,
        pinned: colConfig.frozen ? "left" : undefined,
      });
    }
  }

  return { columns, usedIndexFallback };
}
