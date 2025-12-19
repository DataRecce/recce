/**
 * @file ScreenshotDataGrid.tsx
 * @description AG Grid wrapper component for Recce data grids
 *
 * This component wraps the AG Grid and provides a consistent interface
 * for all data grid views in the application. It handles:
 * - Theme switching (light/dark)
 * - PII tracking safety classes
 * - Default grid configurations
 * - Backward compatibility with existing column/row data formats
 */

"use client";

import Box from "@mui/material/Box";
import type {
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  GridReadyEvent,
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import "./agGridStyles.css";
import Typography from "@mui/material/Typography";
import React, {
  type CSSProperties,
  forwardRef,
  type Ref,
  useMemo,
} from "react";
import { RowObjectType } from "@/lib/api/types";
import { recceGridThemeLight } from "./agGridTheme";

// Register AG Grid modules once
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Handle type for accessing AG Grid API (backward compatible)
 */
export interface DataGridHandle {
  api: GridReadyEvent["api"] | null;
}

/**
 * Props for ScreenshotDataGrid component
 *
 * Supports both new AG Grid style props (columnDefs/rowData) and
 * legacy react-data-grid style props (columns/rows) for backward compatibility
 */
export interface ScreenshotDataGridProps<TData = RowObjectType>
  extends Omit<AgGridReactProps<TData>, "theme" | "rowClass"> {
  /** Container style */
  style?: CSSProperties;
  /** Additional CSS class for container */
  className?: string;
  /** Empty state renderer (legacy) */
  renderers?: {
    noRowsFallback?: React.ReactNode;
  };
  /** Legacy: Column definitions (maps to columnDefs) */
  columns?: (ColDef<TData> | ColGroupDef<TData>)[];
  /** Legacy: Row data (maps to rowData) */
  rows?: TData[];
  /** Legacy: Default column options (maps to defaultColDef) */
  defaultColumnOptions?: ColDef<TData>;
}

/**
 * Empty rows renderer component
 */
interface EmptyRowsRendererProps {
  emptyMessage?: string;
}

export function EmptyRowsRenderer({ emptyMessage }: EmptyRowsRendererProps) {
  return (
    <Box
      sx={{
        display: "flex",
        height: "35px",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.100",
        textAlign: "center",
        gridColumn: "1/-1",
      }}
    >
      <Typography sx={{ fontWeight: 600 }}>
        {emptyMessage ?? "No rows"}
      </Typography>
    </Box>
  );
}

/**
 * AG Grid wrapper component for Recce (Screenshot-capable)
 *
 * @description Provides a themed AG Grid with default configurations:
 * - Automatic light/dark theme switching
 * - Row hover highlighting disabled by default
 * - Cell focus suppressed for cleaner UX
 * - PII-safe tracking class applied to all rows
 *
 * Backward compatible with react-data-grid API:
 * - `columns` prop maps to `columnDefs`
 * - `rows` prop maps to `rowData`
 * - `defaultColumnOptions` maps to `defaultColDef`
 * - `renderers.noRowsFallback` maps to `noRowsOverlayComponent`
 *
 * @example
 * ```tsx
 * // New AG Grid style
 * <ScreenshotDataGrid
 *   columnDefs={columns}
 *   rowData={rows}
 *   style={{ height: '400px' }}
 * />
 *
 * // Legacy react-data-grid style
 * <ScreenshotDataGrid
 *   columns={columns}
 *   rows={rows}
 *   renderers={{ noRowsFallback: <EmptyRowsRenderer /> }}
 * />
 * ```
 */
function _ScreenshotDataGrid<TData = RowObjectType>(
  {
    style,
    className,
    columnDefs,
    rowData,
    columns,
    rows,
    getRowId,
    rowHeight = 32,
    headerHeight = 36,
    defaultColDef,
    defaultColumnOptions,
    renderers,
    ...props
  }: ScreenshotDataGridProps<TData>,
  ref: Ref<DataGridHandle>,
) {
  // Use light theme (dark mode can be added later with useColorScheme)
  const theme = useMemo(() => recceGridThemeLight, []);

  // Support both new and legacy props
  const resolvedColumnDefs = columnDefs ?? columns;
  const resolvedRowData = rowData ?? rows;
  const resolvedDefaultColDef = defaultColDef ?? defaultColumnOptions;

  // Merge default column options
  const mergedDefaultColDef = useMemo<ColDef<TData>>(
    () => ({
      resizable: true,
      suppressMovable: true,
      ...resolvedDefaultColDef,
    }),
    [resolvedDefaultColDef],
  );

  // Custom overlay component when no rows
  const noRowsOverlayComponent = useMemo(() => {
    if (!renderers?.noRowsFallback) return undefined;
    return () => renderers.noRowsFallback;
  }, [renderers?.noRowsFallback]);

  // Generate row ID from __rowKey if available
  const resolvedGetRowId = useMemo(() => {
    if (getRowId) return getRowId;
    return (params: GetRowIdParams<TData>) => {
      const data = params.data as RowObjectType;
      if (data?.__rowKey !== undefined) {
        return String(data.__rowKey);
      }
      // Use rowIndex from the data or generate a random ID
      const index = (params.data as unknown as { rowIndex?: number })?.rowIndex;
      return String(index ?? Math.random());
    };
  }, [getRowId]);

  // Generate a key based on pinned columns to force AG Grid to remount when pinned columns change
  // This is necessary because AG Grid maintains internal column state that may not update
  // when columnDefs change
  const gridKey = useMemo(() => {
    if (!resolvedColumnDefs) return "grid";
    const pinnedFields = resolvedColumnDefs
      .filter(
        (col): col is ColDef<TData> => "field" in col && col.pinned === "left",
      )
      .map((col) => col.field)
      .sort()
      .join(",");
    return `grid-${pinnedFields}`;
  }, [resolvedColumnDefs]);

  return (
    <Box
      className={
        className ? `${className} no-track-pii-safe` : "no-track-pii-safe"
      }
      sx={{
        // Use flex: 1 and minHeight: 0 for proper sizing in flex containers
        // This allows AG Grid to fill available space and scroll internally
        flex: 1,
        minHeight: 0,
        width: "100%",
        overflow: "hidden",
        "& .ag-root-wrapper": {
          border: "none",
          height: "100%",
        },
        "& .ag-header": {
          borderBottom: "1px solid var(--ag-border-color)",
        },
        "& .ag-row": {
          borderBottom: "1px solid var(--ag-border-color)",
        },
        // Diff cell styling
        "& .diff-cell-added": {
          backgroundColor: "#cefece !important",
          color: "black",
        },
        "& .diff-cell-removed": {
          backgroundColor: "#ffc5c5 !important",
          color: "black",
        },
        "& .diff-cell-modified": {
          backgroundColor: "#ffc5c5 !important",
          color: "black",
        },
        // Diff header styling
        "& .diff-header-added": {
          backgroundColor: "#15803d !important",
          color: "white",
        },
        "& .diff-header-removed": {
          backgroundColor: "#f43f5e !important",
          color: "white",
        },
        // Index column styling
        "& .index-column": {
          color: "rgb(128, 128, 128)",
          textAlign: "right",
        },
        // Frozen/pinned column styling
        "& .ag-pinned-left-cols-container .ag-cell": {
          backgroundColor: "#f5f5f5",
        },
      }}
    >
      <AgGridReact<TData>
        key={gridKey}
        theme={theme}
        columnDefs={resolvedColumnDefs}
        rowData={resolvedRowData}
        getRowId={resolvedGetRowId}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        defaultColDef={mergedDefaultColDef}
        suppressCellFocus={true}
        suppressRowHoverHighlight={false}
        animateRows={false}
        rowClass="no-track-pii-safe"
        noRowsOverlayComponent={noRowsOverlayComponent}
        {...props}
      />
    </Box>
  );
}

export const ScreenshotDataGrid = forwardRef(_ScreenshotDataGrid) as <
  TData = RowObjectType,
>(
  props: ScreenshotDataGridProps<TData> & { ref?: Ref<DataGridHandle> },
) => React.ReactNode;

// Re-export AG Grid types for convenience
export type { ColDef, ColGroupDef, GetRowIdParams, GridReadyEvent };

// For backward compatibility, also export as DataGridHandle
export type { DataGridHandle as RecceDataGridHandle };
