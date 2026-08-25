/**
 * @file toDiffColumn.tsx
 * @description Shared column builder for diff grids (querydiff and valuediff)
 *
 * Provides a unified function to create column definitions for data diff grids,
 * supporting both inline and side-by-side display modes.
 */

import Box from "@mui/material/Box";
import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import type { ColumnRenderMode, ColumnType, RowObjectType } from "../../api";
import { StructuralChangeIndicator } from "../../components/ui/StructuralChangeIndicator";
import type { StructuralChangeStatus } from "../../theme";
import { getCellClass, getHeaderCellClass } from "./gridUtils";
import type {
  DataFrameColumnGroupHeaderProps,
  DiffColumnRenderComponents,
  HeaderPresentation,
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
  showStructuralIndicator?: boolean;
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
  headerProps?: Partial<DataFrameColumnGroupHeaderProps> & {
    headerPresentation?: Record<string, HeaderPresentation>;
  };
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
  columnType?: ColumnType,
): (params: CellClassParams<RowObjectType>) => string | undefined {
  return (params: CellClassParams<RowObjectType>) => {
    const row = params.data;
    if (!row) return undefined;
    return getCellClass(row, columnStatus, columnName, true, columnType);
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
  columnType?: ColumnType,
): (params: CellClassParams<RowObjectType>) => string | undefined {
  return (params: CellClassParams<RowObjectType>) => {
    const row = params.data;
    if (!row) return undefined;
    return getCellClass(row, columnStatus, columnName, false, columnType);
  };
}

function createStructuralRowCellClass(
  params: CellClassParams<RowObjectType>,
): string | undefined {
  const status = params.data?.__status;
  return status ? `structural-row-${status}` : undefined;
}

function isStructuralChangeStatus(
  status: string,
): status is Exclude<StructuralChangeStatus, "unchanged"> {
  return status === "added" || status === "removed" || status === "modified";
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
  const { headerPresentation, ...headerComponentProps } = headerProps;

  const headerCellClass = getHeaderCellClass(columnStatus);

  // Build the header component
  const headerComponent = () => (
    <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
      {isStructuralChangeStatus(columnStatus) && (
        <StructuralChangeIndicator
          status={columnStatus}
          size="sm"
          showLabel={false}
          emphasis="secondary"
        />
      )}
      <DataFrameColumnGroupHeader
        name={name}
        columnStatus={columnStatus}
        columnType={columnType}
        {...headerComponentProps}
        {...headerPresentation?.[name]}
      />
    </Box>
  );

  if (displayMode === "inline") {
    return {
      field: name,
      headerName: name,
      headerClass: headerCellClass,
      headerComponent,
      cellClass: createStructuralRowCellClass,
      cellRenderer: inlineRenderCell,
      context: {
        columnType,
        columnRenderMode,
        showStructuralIndicator: false,
      },
    };
  }

  // Side-by-side mode with base/current child columns
  const cellClassBase = createCellClassBase(name, columnStatus, columnType);
  const cellClassCurrent = createCellClassCurrent(
    name,
    columnStatus,
    columnType,
  );

  return {
    headerName: name,
    headerClass: headerCellClass,
    headerGroupComponent: headerComponent,
    context: {
      columnType,
      columnRenderMode,
      showStructuralIndicator: false,
    },
    children: [
      {
        field: `base__${name}`,
        headerName: baseTitle,
        headerClass: headerCellClass,
        cellClass: cellClassBase,
        cellRenderer: defaultRenderCell,
        context: {
          columnType,
          columnRenderMode,
          showStructuralIndicator: false,
        },
      } as ColDef<RowObjectType>,
      {
        field: `current__${name}`,
        headerName: currentTitle,
        headerClass: headerCellClass,
        cellClass: cellClassCurrent,
        cellRenderer: defaultRenderCell,
        context: {
          columnType,
          columnRenderMode,
          showStructuralIndicator: false,
        },
      } as ColDef<RowObjectType>,
    ],
  };
}
