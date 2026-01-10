/**
 * @file toDiffColumn.tsx
 * @description Shared column builder for diff grids (querydiff and valuediff)
 *
 * Provides a unified function to create column definitions for data diff grids,
 * supporting both inline and side-by-side display modes.
 */

import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import _ from "lodash";
import type { ColumnRenderMode, ColumnType, RowObjectType } from "../../api";
import { getHeaderCellClass } from "./gridUtils";
import type {
  DataFrameColumnGroupHeaderProps,
  DiffColumnRenderComponents,
} from "./renderTypes";

// ============================================================================
// Types
// ============================================================================

/**
 * Custom context data for Recce columns
 * Stored in colDef.context to avoid AG Grid validation warnings
 */
export interface RecceColumnContext {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

/**
 * Configuration for building a diff column
 */
export interface DiffColumnConfig {
  /** Column name */
  name: string;
  /** Column diff status: 'added', 'removed', 'modified', or empty */
  columnStatus: string;
  /** Column data type */
  columnType: ColumnType;
  /** How to render numeric values */
  columnRenderMode?: ColumnRenderMode;
  /** Display mode: inline shows diff in single cell, side_by_side shows two columns */
  displayMode: "inline" | "side_by_side";
  /** Title for base column in side_by_side mode */
  baseTitle?: string;
  /** Title for current column in side_by_side mode */
  currentTitle?: string;
  /** Props to pass to DataFrameColumnGroupHeader */
  headerProps?: Partial<DataFrameColumnGroupHeaderProps>;
  /** Render components for building the column */
  renderComponents: DiffColumnRenderComponents;
}

/**
 * Extended column type with context metadata
 * Uses context property for custom data per AG Grid best practices
 * Note: Distributed form allows TypeScript to narrow types correctly
 */
export type DiffColumnResult =
  | (ColDef<RowObjectType> & { context?: RecceColumnContext })
  | (ColGroupDef<RowObjectType> & { context?: RecceColumnContext });

// ============================================================================
// Cell Class Factories
// ============================================================================

/**
 * Creates a cell class function for base column cells
 *
 * @param columnName - The column name (used for value comparison)
 * @param columnStatus - The column's diff status
 * @returns Function that returns CSS class based on row status and value diff
 */
export function createCellClassBase(
  columnName: string,
  columnStatus: string,
): (params: CellClassParams<RowObjectType>) => string | undefined {
  return (params: CellClassParams<RowObjectType>) => {
    const row = params.data;
    if (!row) return undefined;

    const rowStatus = row.__status;

    if (rowStatus === "removed") return "diff-cell-removed";
    if (rowStatus === "added") return "diff-cell-added";
    if (columnStatus === "added" || columnStatus === "removed")
      return undefined;

    const baseKey = `base__${columnName}`.toLowerCase();
    const currentKey = `current__${columnName}`.toLowerCase();

    if (!_.isEqual(row[baseKey], row[currentKey])) {
      return "diff-cell-removed";
    }

    return undefined;
  };
}

/**
 * Creates a cell class function for current column cells
 *
 * @param columnName - The column name (used for value comparison)
 * @param columnStatus - The column's diff status
 * @returns Function that returns CSS class based on row status and value diff
 */
export function createCellClassCurrent(
  columnName: string,
  columnStatus: string,
): (params: CellClassParams<RowObjectType>) => string | undefined {
  return (params: CellClassParams<RowObjectType>) => {
    const row = params.data;
    if (!row) return undefined;

    const rowStatus = row.__status;

    if (rowStatus === "removed") return "diff-cell-removed";
    if (rowStatus === "added") return "diff-cell-added";
    if (columnStatus === "added" || columnStatus === "removed")
      return undefined;

    const baseKey = `base__${columnName}`.toLowerCase();
    const currentKey = `current__${columnName}`.toLowerCase();

    if (!_.isEqual(row[baseKey], row[currentKey])) {
      return "diff-cell-added";
    }

    return undefined;
  };
}

// ============================================================================
// Main Column Builder
// ============================================================================

/**
 * Creates a diff column definition for use in data grids
 *
 * @description Builds a column configuration that supports both inline and
 * side-by-side diff display modes. In inline mode, differences are shown
 * within a single cell. In side-by-side mode, base and current values
 * appear in separate child columns.
 *
 * @param config - Column configuration options
 * @returns Column definition compatible with AG Grid
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
 *   renderComponents: {
 *     DataFrameColumnGroupHeader,
 *     defaultRenderCell,
 *     inlineRenderCell,
 *   },
 * });
 *
 * @example
 * // Side-by-side mode for valuediff
 * const column = toDiffColumn({
 *   name: 'Amount',
 *   columnStatus: '',
 *   columnType: 'number',
 *   displayMode: 'side_by_side',
 *   baseTitle: 'Before',
 *   currentTitle: 'After',
 *   headerProps: {
 *     primaryKeys: ['id'],
 *   },
 *   renderComponents: {
 *     DataFrameColumnGroupHeader,
 *     defaultRenderCell,
 *     inlineRenderCell,
 *   },
 * });
 */
export function toDiffColumn(config: DiffColumnConfig): DiffColumnResult {
  const {
    name,
    columnStatus,
    columnType,
    columnRenderMode,
    displayMode,
    baseTitle = "Base",
    currentTitle = "Current",
    headerProps = {},
    renderComponents,
  } = config;

  const { DataFrameColumnGroupHeader, defaultRenderCell, inlineRenderCell } =
    renderComponents;

  const headerCellClass = getHeaderCellClass(columnStatus);

  // Build the header component
  const headerComponent = () => (
    <DataFrameColumnGroupHeader
      name={name}
      columnStatus={columnStatus}
      columnType={columnType}
      {...headerProps}
    />
  );

  if (displayMode === "inline") {
    return {
      field: name,
      headerName: name,
      headerClass: headerCellClass,
      headerComponent,
      cellRenderer: inlineRenderCell,
      context: { columnType, columnRenderMode },
    };
  }

  // Side-by-side mode with base/current child columns
  const cellClassBase = createCellClassBase(name, columnStatus);
  const cellClassCurrent = createCellClassCurrent(name, columnStatus);

  return {
    headerName: name,
    headerClass: headerCellClass,
    headerGroupComponent: headerComponent,
    context: { columnType, columnRenderMode },
    children: [
      {
        field: `base__${name}`,
        headerName: baseTitle,
        headerClass: headerCellClass,
        cellClass: cellClassBase,
        cellRenderer: defaultRenderCell,
        context: { columnType, columnRenderMode },
      } as ColDef<RowObjectType>,
      {
        field: `current__${name}`,
        headerName: currentTitle,
        headerClass: headerCellClass,
        cellClass: cellClassCurrent,
        cellRenderer: defaultRenderCell,
        context: { columnType, columnRenderMode },
      } as ColDef<RowObjectType>,
    ],
  };
}
