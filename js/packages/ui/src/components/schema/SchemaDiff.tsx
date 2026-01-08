/**
 * @file SchemaDiff.tsx
 * @module @datarecce/ui/primitives
 * @description Pure presentation component for comparing schemas between two environments.
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
 * Schema diff row status
 */
export type SchemaDiffStatus = "added" | "removed" | "modified" | "unchanged";

/**
 * Schema diff row data
 */
export interface SchemaDiffRow {
  /** Column name */
  name: string;
  /** Whether column was reordered */
  reordered?: boolean;
  /** Index in current environment */
  currentIndex?: number;
  /** Index in base environment */
  baseIndex?: number;
  /** Data type in current environment */
  currentType?: string;
  /** Data type in base environment */
  baseType?: string;
  /** Row status */
  __status?: SchemaDiffStatus;
  /** Row key */
  __rowKey?: string;
}

/**
 * Handle for accessing grid API
 */
export interface SchemaDiffHandle {
  /** AG Grid API */
  api: GridReadyEvent["api"] | null;
  /** DOM element for screenshots */
  element: HTMLElement | null;
}

/**
 * Props for the SchemaDiff component
 */
export interface SchemaDiffProps {
  /** Schema diff rows */
  rows: SchemaDiffRow[];
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
  nameRenderer?: (params: { value: string; data: SchemaDiffRow }) => ReactNode;
  /** Custom cell renderer for index columns */
  indexRenderer?: (params: {
    value: number | undefined;
    data: SchemaDiffRow;
  }) => ReactNode;
  /** Custom cell renderer for type columns */
  typeRenderer?: (params: {
    value: string | undefined;
    data: SchemaDiffRow;
  }) => ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * Merge base and current columns into diff rows
 */
export function mergeSchemaColumns(
  baseColumns: Record<string, { index: number; type?: string }>,
  currentColumns: Record<string, { index: number; type?: string }>,
): SchemaDiffRow[] {
  const allNames = new Set([
    ...Object.keys(baseColumns),
    ...Object.keys(currentColumns),
  ]);

  const rows: SchemaDiffRow[] = [];

  for (const name of allNames) {
    const base = baseColumns[name];
    const current = currentColumns[name];

    let status: SchemaDiffStatus = "unchanged";
    if (!base) {
      status = "added";
    } else if (!current) {
      status = "removed";
    } else if (base.type !== current.type || base.index !== current.index) {
      status = "modified";
    }

    rows.push({
      name,
      baseIndex: base?.index,
      currentIndex: current?.index,
      baseType: base?.type,
      currentType: current?.type,
      reordered: base && current && base.index !== current.index,
      __status: status,
      __rowKey: name,
    });
  }

  // Sort by current index (added columns at end), then by base index
  return rows.sort((a, b) => {
    const aIndex = a.currentIndex ?? a.baseIndex ?? Number.MAX_SAFE_INTEGER;
    const bIndex = b.currentIndex ?? b.baseIndex ?? Number.MAX_SAFE_INTEGER;
    return aIndex - bIndex;
  });
}

/**
 * SchemaDiff Component
 *
 * A pure presentation component for displaying schema differences
 * between base and current environments.
 *
 * @example Basic usage
 * ```tsx
 * import { SchemaDiff, mergeSchemaColumns } from '@datarecce/ui/primitives';
 *
 * function SchemaDiffPanel({ baseSchema, currentSchema }) {
 *   const rows = mergeSchemaColumns(
 *     Object.fromEntries(baseSchema.map((c, i) => [c.name, { index: i, type: c.type }])),
 *     Object.fromEntries(currentSchema.map((c, i) => [c.name, { index: i, type: c.type }])),
 *   );
 *
 *   return (
 *     <SchemaDiff
 *       rows={rows}
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
 * <SchemaDiff
 *   rows={diffRows}
 *   selectedColumn={selectedColumn}
 *   onColumnClick={setSelectedColumn}
 * />
 * ```
 */
function SchemaDiffComponent(
  {
    rows,
    selectedColumn,
    onColumnClick,
    warningMessage,
    rowHeight = 35,
    emptyMessage = "No schema columns",
    theme = "light",
    columnDefs: customColumnDefs,
    nameRenderer,
    indexRenderer,
    typeRenderer,
    className,
  }: SchemaDiffProps,
  ref: Ref<SchemaDiffHandle>,
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

  // Build AG Grid column definitions
  const agColumnDefs = useMemo<ColDef[]>(() => {
    if (customColumnDefs) return customColumnDefs;

    return [
      {
        field: "baseIndex",
        headerName: "Base #",
        width: 70,
        minWidth: 50,
        maxWidth: 90,
        sortable: true,
        cellRenderer: indexRenderer
          ? (params: { value: number | undefined; data: SchemaDiffRow }) =>
              indexRenderer(params)
          : undefined,
      },
      {
        field: "currentIndex",
        headerName: "Curr #",
        width: 70,
        minWidth: 50,
        maxWidth: 90,
        sortable: true,
        cellRenderer: indexRenderer
          ? (params: { value: number | undefined; data: SchemaDiffRow }) =>
              indexRenderer(params)
          : undefined,
      },
      {
        field: "name",
        headerName: "Column",
        flex: 1,
        minWidth: 120,
        sortable: true,
        cellRenderer: nameRenderer
          ? (params: { value: string; data: SchemaDiffRow }) =>
              nameRenderer(params)
          : undefined,
      },
      {
        field: "baseType",
        headerName: "Base Type",
        width: 120,
        minWidth: 80,
        sortable: true,
        cellRenderer: typeRenderer
          ? (params: { value: string | undefined; data: SchemaDiffRow }) =>
              typeRenderer(params)
          : undefined,
      },
      {
        field: "currentType",
        headerName: "Curr Type",
        width: 120,
        minWidth: 80,
        sortable: true,
        cellRenderer: typeRenderer
          ? (params: { value: string | undefined; data: SchemaDiffRow }) =>
              typeRenderer(params)
          : undefined,
      },
    ];
  }, [customColumnDefs, nameRenderer, indexRenderer, typeRenderer]);

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
    () => (params: { data: SchemaDiffRow }) => {
      return params.data.__rowKey ?? params.data.name;
    },
    [],
  );

  // Row class for status styling and selection
  const getRowClass = (params: RowClassParams<SchemaDiffRow>) => {
    const row = params.data;
    if (!row) return "";

    const classes: string[] = [];

    // Status-based styling
    switch (row.__status) {
      case "added":
        classes.push("schema-diff-row-added");
        break;
      case "removed":
        classes.push("schema-diff-row-removed");
        break;
      case "modified":
        classes.push("schema-diff-row-modified");
        break;
      default:
        classes.push("schema-diff-row-unchanged");
    }

    // Selection styling
    if (row.name === selectedColumn) {
      classes.push("schema-diff-row-selected");
    }

    // Clickable styling (removed columns not clickable)
    if (onColumnClick && row.__status !== "removed") {
      classes.push("schema-diff-row-selectable");
    }

    return classes.join(" ");
  };

  // Empty state
  if (rows.length === 0) {
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
          // Row status styling
          "& .schema-diff-row-added": {
            backgroundColor: isDark ? "#1a4d1a" : "#cefece",
          },
          "& .schema-diff-row-removed": {
            backgroundColor: isDark ? "#5c1f1f" : "#ffc5c5",
            opacity: 0.7,
          },
          "& .schema-diff-row-modified": {
            backgroundColor: isDark ? "#5c4b1f" : "#fff3c5",
          },
          // Selection and clickable styling
          "& .schema-diff-row-selectable": {
            cursor: "pointer",
          },
          "& .schema-diff-row-selected": {
            outline: `2px solid ${isDark ? "#90cdf4" : "#3182ce"}`,
            outlineOffset: "-2px",
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
            const row = event.data;
            // Don't allow clicking removed rows
            if (row && row.__status !== "removed" && onColumnClick) {
              onColumnClick(row.name);
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

export const SchemaDiff = forwardRef(SchemaDiffComponent);
SchemaDiff.displayName = "SchemaDiff";
