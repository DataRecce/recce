/**
 * @file toDiffColumn.tsx
 * @description Shared column builder for diff grids (querydiff and valuediff)
 *
 * Provides a unified function to create column definitions for data diff grids,
 * supporting both inline and side-by-side display modes.
 */

import _ from "lodash";
import React from "react";
import { ColumnOrColumnGroup, renderTextEditor } from "react-data-grid";
import {
  DataFrameColumnGroupHeader,
  DataFrameColumnGroupHeaderProps,
  defaultRenderCell,
  inlineRenderCell,
} from "@/components/ui/dataGrid";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import { getHeaderCellClass } from "./gridUtils";

// ============================================================================
// Types
// ============================================================================

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
}

/**
 * Extended column type with metadata
 */
export type DiffColumnResult = ColumnOrColumnGroup<RowObjectType> & {
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
};

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
): (row: RowObjectType) => string | undefined {
  return (row: RowObjectType) => {
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
): (row: RowObjectType) => string | undefined {
  return (row: RowObjectType) => {
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
 * @returns Column definition compatible with react-data-grid
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
 *   }
 * });
 *
 * @example
 * // Side-by-side mode for valuediff with case-insensitive matching
 * const column = toDiffColumn({
 *   name: 'Amount',
 *   columnStatus: '',
 *   columnType: 'number',
 *   displayMode: 'side_by_side',
 *   baseTitle: 'Before',
 *   currentTitle: 'After',
 *   headerProps: {
 *     primaryKeys: ['id'],
 *     caseInsensitive: true,
 *   }
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
  } = config;

  const headerCellClass = getHeaderCellClass(columnStatus);

  // Build the header component
  const headerElement = (
    <DataFrameColumnGroupHeader
      name={name}
      columnStatus={columnStatus}
      columnType={columnType}
      {...headerProps}
    />
  );

  if (displayMode === "inline") {
    return {
      headerCellClass,
      name: headerElement,
      key: name,
      renderCell: inlineRenderCell,
      columnType,
      columnRenderMode,
    };
  }

  // Side-by-side mode with base/current child columns
  const cellClassBase = createCellClassBase(name, columnStatus);
  const cellClassCurrent = createCellClassCurrent(name, columnStatus);

  return {
    headerCellClass,
    name: headerElement,
    children: [
      {
        key: `base__${name}`,
        name: baseTitle,
        renderEditCell: renderTextEditor,
        headerCellClass,
        cellClass: cellClassBase,
        renderCell: defaultRenderCell,
        // @ts-expect-error Unable to patch children type in react-data-grid
        columnType,
        columnRenderMode,
      },
      {
        key: `current__${name}`,
        name: currentTitle,
        renderEditCell: renderTextEditor,
        headerCellClass,
        cellClass: cellClassCurrent,
        renderCell: defaultRenderCell,
        // @ts-expect-error Unable to patch children type in react-data-grid
        columnType,
        columnRenderMode,
      },
    ],
  };
}
