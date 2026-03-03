"use client";

/**
 * @file ScreenshotDataGrid.tsx
 * @description AG Grid wrapper component with screenshot support
 *
 * This component wraps AG Grid and provides:
 * - Theme switching (light/dark)
 * - Default grid configurations
 * - Screenshot capture support via ref
 * - Backward compatibility with react-data-grid API
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type {
  ColDef,
  ColGroupDef,
  GetRowIdParams,
  GridReadyEvent,
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import React, {
  type CSSProperties,
  forwardRef,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

import { useIsDark } from "../../hooks";
import "./agGridStyles.css";
import { dataGridThemeDark, dataGridThemeLight } from "./agGridTheme";

// Register AG Grid modules once
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Handle type for accessing AG Grid API and DOM element (for screenshots)
 */
export interface DataGridHandle {
  api: GridReadyEvent["api"] | null;
  /** DOM element for screenshot functionality */
  element: HTMLElement | null;
}

/**
 * Generic row type for data grids
 */
export interface DataGridRow {
  __rowKey?: string | number;
  [key: string]: unknown;
}

/**
 * Props for ScreenshotDataGrid component
 *
 * Supports both AG Grid style props (columnDefs/rowData) and
 * legacy react-data-grid style props (columns/rows) for backward compatibility
 */
export interface ScreenshotDataGridProps<TData = DataGridRow>
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
  /** Optional CSS class to apply to rows (e.g., for PII tracking) */
  rowClassName?: string;
  /** Optional CSS class to apply to container (e.g., for PII tracking) */
  containerClassName?: string;
}

/**
 * Empty rows renderer component
 */
export interface EmptyRowsRendererProps {
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
 * AG Grid wrapper component with screenshot support
 *
 * @description Provides a themed AG Grid with default configurations:
 * - Automatic light/dark theme switching
 * - Row hover highlighting disabled by default
 * - Cell focus suppressed for cleaner UX
 *
 * Backward compatible with react-data-grid API:
 * - `columns` prop maps to `columnDefs`
 * - `rows` prop maps to `rowData`
 * - `defaultColumnOptions` maps to `defaultColDef`
 * - `renderers.noRowsFallback` maps to `noRowsOverlayComponent`
 *
 * @example
 * ```tsx
 * // AG Grid style
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
function _ScreenshotDataGrid<TData = DataGridRow>(
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
    rowClassName,
    containerClassName,
    ...props
  }: ScreenshotDataGridProps<TData>,
  ref: Ref<DataGridHandle>,
) {
  // Container ref for screenshot functionality
  const containerRef = useRef<HTMLDivElement>(null);
  // AG Grid API ref
  const gridApiRef = useRef<GridReadyEvent["api"] | null>(null);

  // Expose both API and DOM element through ref
  useImperativeHandle(
    ref,
    () => ({
      api: gridApiRef.current,
      element: containerRef.current,
    }),
    [],
  );

  // Use useIsDark for reliable dark mode detection with CSS Variables
  const isDark = useIsDark();

  // Select AG Grid theme based on dark mode
  const gridTheme = useMemo(
    () => (isDark ? dataGridThemeDark : dataGridThemeLight),
    [isDark],
  );

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
      const data = params.data as DataGridRow;
      if (data?.__rowKey !== undefined) {
        return String(data.__rowKey);
      }
      // Use rowIndex from the data or generate a random ID
      const index = (params.data as unknown as { rowIndex?: number })?.rowIndex;
      return String(index ?? Math.random());
    };
  }, [getRowId]);

  // Generate a key based on pinned columns to force AG Grid to remount
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

  // Combine class names
  const combinedClassName = [className, containerClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <Box
      ref={containerRef}
      className={combinedClassName || undefined}
      sx={{
        // Use flex: 1 and minHeight: 0 for proper sizing in flex containers
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
        "& .ag-cell": {
          borderRight: "1px solid var(--ag-border-color)",
        },
        "& .ag-header-cell": {
          borderRight: "1px solid var(--ag-border-color)",
        },
        // Diff cell styling - theme-aware colors
        "& .diff-cell-added": {
          backgroundColor: isDark ? "#1a4d1a !important" : "#cefece !important",
          color: "var(--mui-palette-text-primary)",
        },
        "& .diff-cell-removed": {
          backgroundColor: isDark ? "#5c1f1f !important" : "#ffc5c5 !important",
          color: "var(--mui-palette-text-primary)",
        },
        "& .diff-cell-modified": {
          backgroundColor: isDark ? "#713F12 !important" : "#FEF3C7 !important",
          color: "var(--mui-palette-text-primary)",
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
        "& .diff-header-modified": {
          backgroundColor: "#f59e0b !important",
          color: "white",
        },
        // Index column styling
        "& .index-column": {
          color: "var(--mui-palette-text-secondary)",
          textAlign: "right",
        },
        // Frozen/pinned column styling
        "& .ag-pinned-left-cols-container .ag-cell": {
          backgroundColor: isDark ? "#2d2d2d" : "#f5f5f5",
        },
      }}
    >
      <AgGridReact<TData>
        key={gridKey}
        theme={gridTheme}
        columnDefs={resolvedColumnDefs}
        rowData={resolvedRowData}
        getRowId={resolvedGetRowId}
        rowHeight={rowHeight}
        headerHeight={headerHeight}
        defaultColDef={mergedDefaultColDef}
        suppressCellFocus={true}
        suppressRowHoverHighlight={false}
        animateRows={false}
        rowClass={rowClassName}
        noRowsOverlayComponent={noRowsOverlayComponent}
        onGridReady={(event) => {
          gridApiRef.current = event.api;
        }}
        {...props}
      />
    </Box>
  );
}

export const ScreenshotDataGrid = forwardRef(_ScreenshotDataGrid) as <
  TData = DataGridRow,
>(
  props: ScreenshotDataGridProps<TData> & { ref?: Ref<DataGridHandle> },
) => React.ReactNode;

// Re-export AG Grid types for convenience
export type { ColDef, ColGroupDef, GetRowIdParams, GridReadyEvent };

// For backward compatibility
export type { DataGridHandle as RecceDataGridHandle };
