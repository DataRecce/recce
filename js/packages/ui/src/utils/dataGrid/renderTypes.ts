/**
 * @file renderTypes.ts
 * @description Type definitions for column render components
 *
 * Defines interfaces for render components used by column builders.
 * This allows column builders to be pure and not depend on specific
 * React component implementations.
 */

import type { ICellRendererParams } from "ag-grid-community";
import type { ColumnRenderMode, ColumnType } from "../../api";

// ============================================================================
// Header Component Props
// ============================================================================

/**
 * Props for the column group header component
 */
export interface DataFrameColumnGroupHeaderProps {
  /** Column name to display */
  name: string;
  /** Column diff status: 'added', 'removed', 'modified', or empty string */
  columnStatus: string;
  /** Column data type for determining available options */
  columnType: ColumnType;
  /** List of current primary key column names */
  primaryKeys?: string[];
  /** Callback when primary keys change (enables PK toggle functionality) */
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  /** List of currently pinned column names */
  pinnedColumns?: string[];
  /** Callback when pinned columns change */
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  /** Callback when column render mode changes */
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

/**
 * Props for the simple column header component
 */
export interface DataFrameColumnHeaderProps {
  /** Column name to display */
  name: string;
  /** Column data type for determining available options */
  columnType: ColumnType;
  /** List of currently pinned column names */
  pinnedColumns?: string[];
  /** Callback when pinned columns change */
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  /** Callback when column render mode changes */
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

// ============================================================================
// Cell Renderer Types
// ============================================================================

/**
 * Cell renderer function type (compatible with AG Grid)
 */
export type CellRendererFunction = (
  params: ICellRendererParams,
) => React.ReactNode;

// ============================================================================
// Render Components Interface
// ============================================================================

/**
 * Collection of render components for column builders
 *
 * @description Column builders accept this interface to decouple the column
 * building logic from specific React component implementations. This allows:
 *
 * - @datarecce/ui to contain the pure column building logic
 * - OSS packages to provide their own render component implementations
 * - Easy testing with mock components
 *
 * @example
 * ```tsx
 * // OSS passes its render components
 * const renderComponents: ColumnRenderComponents = {
 *   DataFrameColumnGroupHeader,
 *   DataFrameColumnHeader,
 *   defaultRenderCell,
 *   inlineRenderCell,
 * };
 *
 * const result = buildDiffColumnDefinitions({
 *   columns: columnConfigs,
 *   displayMode: "inline",
 *   headerProps: {...},
 *   renderComponents,
 * });
 * ```
 */
export interface ColumnRenderComponents {
  /**
   * Column group header component (used for PK columns and diff grids)
   * Supports PK indicator, pin toggle, and precision menu
   */
  DataFrameColumnGroupHeader: React.ComponentType<DataFrameColumnGroupHeaderProps>;

  /**
   * Simple column header component (used for non-PK columns in simple grids)
   * Supports pin toggle and precision menu
   */
  DataFrameColumnHeader?: React.ComponentType<DataFrameColumnHeaderProps>;

  /**
   * Default cell renderer (displays single value)
   */
  defaultRenderCell: CellRendererFunction;

  /**
   * Inline diff cell renderer (displays base/current values inline)
   * Required for inline display mode in diff grids
   */
  inlineRenderCell?: CellRendererFunction;
}

/**
 * Render components required for diff column builders
 */
export interface DiffColumnRenderComponents {
  DataFrameColumnGroupHeader: React.ComponentType<DataFrameColumnGroupHeaderProps>;
  defaultRenderCell: CellRendererFunction;
  inlineRenderCell: CellRendererFunction;
}

/**
 * Render components required for simple column builders
 */
export interface SimpleColumnRenderComponents {
  DataFrameColumnGroupHeader: React.ComponentType<DataFrameColumnGroupHeaderProps>;
  DataFrameColumnHeader: React.ComponentType<DataFrameColumnHeaderProps>;
  defaultRenderCell: CellRendererFunction;
}
