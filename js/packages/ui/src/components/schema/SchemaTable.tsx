/**
 * @file SchemaTable.tsx
 * @module @datarecce/ui/primitives
 * @description Pure presentation component for displaying schema columns in a single environment.
 *
 * **Architecture Note:** This component is part of @datarecce/ui's public API intended
 * for external consumers (e.g., recce-cloud). It is intentionally NOT used in the OSS
 * Recce application, which uses a context-based architecture in SchemaView.tsx instead.
 * Schema views get data from `lineageGraph.nodes` context rather than `Run.result`,
 * making them architecturally different from other result views.
 *
 * @see docs/plans/schema-audit-report.md for detailed architecture documentation
 */

"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ColDef, GridReadyEvent, RowClassParams } from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  forwardRef,
  memo,
  type ReactNode,
  type Ref,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

// Register AG Grid modules once
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Schema column data
 */
export interface SchemaColumnData {
  /** Column name */
  name: string;
  /** Column index/position */
  index: number;
  /** Data type */
  type?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Single environment schema row
 */
export interface SchemaRow {
  /** Column name */
  name: string;
  /** Column index/position */
  index: number;
  /** Data type */
  type?: string;
  /** Row key */
  __rowKey?: string;
}

/**
 * Handle for accessing grid API
 */
export interface SchemaTableHandle {
  /** AG Grid API */
  api: GridReadyEvent["api"] | null;
  /** DOM element for screenshots */
  element: HTMLElement | null;
}

/**
 * Props for the SchemaTable component
 */
export interface SchemaTableProps {
  /** Schema columns data */
  columns: SchemaColumnData[];
  /** Selected column name */
  selectedColumn?: string | null;
  /** Callback when a column is clicked */
  onColumnClick?: (columnName: string) => void;
  /** Warning message to display */
  warningMessage?: string;
  /** Row height in pixels */
  rowHeight?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Custom column definitions override */
  columnDefs?: ColDef[];
  /** Custom cell renderer for name column */
  nameRenderer?: (params: { value: string; data: SchemaRow }) => ReactNode;
  /** Custom cell renderer for type column */
  typeRenderer?: (params: {
    value: string | undefined;
    data: SchemaRow;
  }) => ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * SchemaTable Component
 *
 * A pure presentation component for displaying database schema columns
 * in a single environment (not diff mode).
 *
 * @example Basic usage
 * ```tsx
 * import { SchemaTable } from '@datarecce/ui/primitives';
 *
 * function SchemaPanel({ schemaData }) {
 *   return (
 *     <SchemaTable
 *       columns={schemaData.columns.map((col, index) => ({
 *         name: col.name,
 *         index,
 *         type: col.data_type,
 *       }))}
 *       onColumnClick={(name) => console.log('Clicked', name)}
 *     />
 *   );
 * }
 * ```
 *
 * @example With selection
 * ```tsx
 * const [selectedColumn, setSelectedColumn] = useState(null);
 *
 * <SchemaTable
 *   columns={columns}
 *   selectedColumn={selectedColumn}
 *   onColumnClick={setSelectedColumn}
 * />
 * ```
 */
function SchemaTableComponent(
  {
    columns,
    selectedColumn,
    onColumnClick,
    warningMessage,
    rowHeight = 35,
    emptyMessage = "No schema columns",
    theme = "light",
    columnDefs: customColumnDefs,
    nameRenderer,
    typeRenderer,
    className,
  }: SchemaTableProps,
  ref: Ref<SchemaTableHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridApiRef = useRef<GridReadyEvent["api"] | null>(null);
  const isDark = theme === "dark";

  useImperativeHandle(
    ref,
    () => ({
      api: gridApiRef.current,
      element: containerRef.current,
    }),
    [],
  );

  // Convert columns to row data
  const rows = useMemo<SchemaRow[]>(() => {
    return columns.map((col, index) => ({
      name: col.name,
      index: col.index ?? index,
      type: col.type,
      __rowKey: col.name,
    }));
  }, [columns]);

  // Build AG Grid column definitions
  const agColumnDefs = useMemo<ColDef[]>(() => {
    if (customColumnDefs) return customColumnDefs;

    return [
      {
        field: "index",
        headerName: "#",
        width: 60,
        minWidth: 50,
        maxWidth: 80,
        sortable: true,
        pinned: "left",
      },
      {
        field: "name",
        headerName: "Column",
        flex: 1,
        minWidth: 120,
        sortable: true,
        cellRenderer: nameRenderer
          ? (params: { value: string; data: SchemaRow }) => nameRenderer(params)
          : undefined,
      },
      {
        field: "type",
        headerName: "Type",
        width: 150,
        minWidth: 100,
        sortable: true,
        cellRenderer: typeRenderer
          ? (params: { value: string | undefined; data: SchemaRow }) =>
              typeRenderer(params)
          : undefined,
      },
    ];
  }, [customColumnDefs, nameRenderer, typeRenderer]);

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
    () => (params: { data: SchemaRow }) => {
      return params.data.__rowKey ?? params.data.name;
    },
    [],
  );

  // Row class for selection and styling
  const getRowClass = (params: RowClassParams<SchemaRow>) => {
    const classes = ["schema-row"];
    if (params.data?.name === selectedColumn) {
      classes.push("schema-row-selected");
    }
    if (onColumnClick) {
      classes.push("schema-row-selectable");
    }
    return classes.join(" ");
  };

  // Empty state
  if (columns.length === 0) {
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
    <Box
      ref={containerRef}
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Warning message */}
      {warningMessage && (
        <Alert severity="warning" sx={{ fontSize: "12px", p: 1 }}>
          {warningMessage}
        </Alert>
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
          "& .schema-row-selectable": {
            cursor: "pointer",
          },
          "& .schema-row-selected": {
            backgroundColor: isDark ? "#2d4a5c" : "#d4e8f5",
          },
        }}
      >
        <AgGridReact
          columnDefs={agColumnDefs}
          rowData={rows}
          getRowId={getRowId}
          getRowClass={getRowClass}
          rowHeight={rowHeight}
          headerHeight={36}
          defaultColDef={defaultColDef}
          suppressCellFocus={true}
          suppressRowHoverHighlight={false}
          animateRows={false}
          rowSelection={{ mode: "singleRow" }}
          onRowClicked={(event) => {
            if (event.data && onColumnClick) {
              onColumnClick(event.data.name);
            }
          }}
          onGridReady={(event) => {
            gridApiRef.current = event.api;
            // Select initial row if specified
            if (selectedColumn) {
              const rowNode = event.api.getRowNode(selectedColumn);
              if (rowNode) {
                rowNode.setSelected(true);
              }
            }
          }}
        />
      </Box>
    </Box>
  );
}

export const SchemaTable = forwardRef(SchemaTableComponent);
SchemaTable.displayName = "SchemaTable";
