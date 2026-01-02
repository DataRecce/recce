"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { ColDef, ColGroupDef, GridReadyEvent } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  forwardRef,
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

// Register AG Grid modules once
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Column definition for query results
 */
export interface QueryResultsColumn {
  /** Column field name */
  field: string;
  /** Display header */
  headerName?: string;
  /** Column width */
  width?: number;
  /** Minimum width */
  minWidth?: number;
  /** Maximum width */
  maxWidth?: number;
  /** Whether column is resizable */
  resizable?: boolean;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Pin column to left or right */
  pinned?: "left" | "right" | null;
  /** CSS class for cells */
  cellClass?: string | string[];
  /** CSS class for header */
  headerClass?: string | string[];
  /** Custom cell renderer */
  cellRenderer?: (params: { value: unknown }) => ReactNode;
}

/**
 * Row data type for query results
 */
export interface QueryResultsRow {
  /** Unique row key */
  __rowKey?: string | number;
  /** Row data */
  [key: string]: unknown;
}

/**
 * Handle for accessing grid API
 */
export interface QueryResultsHandle {
  /** AG Grid API */
  api: GridReadyEvent["api"] | null;
  /** DOM element for screenshots */
  element: HTMLElement | null;
}

/**
 * Props for the QueryResults component
 */
export interface QueryResultsProps {
  /** Column definitions */
  columns: QueryResultsColumn[];
  /** Row data */
  rows: QueryResultsRow[];
  /** Row height in pixels */
  rowHeight?: number;
  /** Header height in pixels */
  headerHeight?: number;
  /** Show warning message (e.g., row limit) */
  warning?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Enable row hover highlighting */
  rowHoverHighlight?: boolean;
  /** Toolbar content (buttons, filters, etc.) */
  toolbarContent?: ReactNode;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Optional CSS class */
  className?: string;
}

/**
 * Empty state component for no rows
 */
function EmptyRowsOverlay({ message }: { message: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}

/**
 * QueryResults Component
 *
 * A pure presentation component for displaying query results in a data grid.
 * Wraps AG Grid with default configurations suitable for SQL query output.
 *
 * @example Basic usage
 * ```tsx
 * import { QueryResults } from '@datarecce/ui/primitives';
 *
 * function ResultsPanel({ data }) {
 *   const columns = data.columns.map(col => ({
 *     field: col.name,
 *     headerName: col.name,
 *   }));
 *
 *   return (
 *     <QueryResults
 *       columns={columns}
 *       rows={data.rows}
 *       warning={data.truncated ? 'Results limited to 10,000 rows' : undefined}
 *     />
 *   );
 * }
 * ```
 *
 * @example With toolbar
 * ```tsx
 * <QueryResults
 *   columns={columns}
 *   rows={rows}
 *   toolbarContent={
 *     <Button onClick={addToChecklist}>Add to Checklist</Button>
 *   }
 * />
 * ```
 *
 * @example Dark theme
 * ```tsx
 * <QueryResults
 *   columns={columns}
 *   rows={rows}
 *   theme="dark"
 * />
 * ```
 */
function QueryResultsComponent(
  {
    columns,
    rows,
    rowHeight = 32,
    headerHeight = 36,
    warning,
    emptyMessage = "No data",
    rowHoverHighlight = false,
    toolbarContent,
    theme = "light",
    className,
  }: QueryResultsProps,
  ref: Ref<QueryResultsHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridApiRef = useRef<GridReadyEvent["api"] | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      api: gridApiRef.current,
      element: containerRef.current,
    }),
    [],
  );

  // Convert simple column format to AG Grid ColDef
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    return columns.map((col) => ({
      field: col.field,
      headerName: col.headerName ?? col.field,
      width: col.width,
      minWidth: col.minWidth ?? 35,
      maxWidth: col.maxWidth ?? 800,
      resizable: col.resizable ?? true,
      sortable: col.sortable ?? true,
      pinned: col.pinned,
      cellClass: col.cellClass,
      headerClass: col.headerClass,
      cellRenderer: col.cellRenderer,
    }));
  }, [columns]);

  // Default column options
  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
      suppressMovable: true,
    }),
    [],
  );

  // Generate row ID
  const getRowId = useMemo(
    () => (params: { data: QueryResultsRow }) => {
      if (params.data?.__rowKey !== undefined) {
        return String(params.data.__rowKey);
      }
      return String(Math.random());
    },
    [],
  );

  // Empty state component
  const noRowsOverlayComponent = useMemo(
    () => () => <EmptyRowsOverlay message={emptyMessage} />,
    [emptyMessage],
  );

  const isDark = theme === "dark";

  if (columns.length === 0 && rows.length === 0) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Stack
      ref={containerRef}
      className={className}
      sx={{
        height: "100%",
        bgcolor: isDark ? "grey.900" : "grey.50",
      }}
    >
      {/* Warning/Toolbar bar */}
      {(warning || toolbarContent) && (
        <Stack
          direction="row"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.5,
            bgcolor: warning
              ? isDark
                ? "warning.dark"
                : "warning.light"
              : "inherit",
          }}
        >
          {warning && (
            <Typography
              variant="body2"
              sx={{
                color: isDark ? "warning.contrastText" : "warning.dark",
              }}
            >
              ⚠ {warning}
            </Typography>
          )}
          <Box sx={{ flexGrow: 1 }} />
          {toolbarContent}
        </Stack>
      )}

      {/* Data grid */}
      <Box
        sx={{
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
        }}
      >
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rows}
          getRowId={getRowId}
          rowHeight={rowHeight}
          headerHeight={headerHeight}
          defaultColDef={defaultColDef}
          suppressCellFocus={true}
          suppressRowHoverHighlight={!rowHoverHighlight}
          animateRows={false}
          noRowsOverlayComponent={noRowsOverlayComponent}
          onGridReady={(event) => {
            gridApiRef.current = event.api;
          }}
        />
      </Box>
    </Stack>
  );
}

export const QueryResults = forwardRef(QueryResultsComponent);
QueryResults.displayName = "QueryResults";
