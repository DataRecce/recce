"use client";

import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { ColDef, ColGroupDef, GridReadyEvent } from "ag-grid-community";
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
 * Display mode for diff view
 */
export type DiffDisplayMode = "inline" | "side-by-side";

/**
 * Column definition for diff results
 */
export interface DiffColumn {
  /** Column field name */
  field: string;
  /** Display header */
  headerName?: string;
  /** Column width */
  width?: number;
  /** Minimum width */
  minWidth?: number;
  /** Pin column to left */
  pinned?: "left" | "right" | null;
  /** Whether this is a primary key column */
  isPrimaryKey?: boolean;
  /** CSS class for cells */
  cellClass?: string | string[];
}

/**
 * Row data for diff results
 */
export interface DiffRow {
  /** Unique row key */
  __rowKey?: string | number;
  /** Row change status */
  __status?: "added" | "removed" | "modified" | "unchanged";
  /** Row data */
  [key: string]: unknown;
}

/**
 * Handle for accessing grid API
 */
export interface QueryDiffViewHandle {
  /** AG Grid API */
  api: GridReadyEvent["api"] | null;
  /** DOM element for screenshots */
  element: HTMLElement | null;
}

/**
 * Props for the QueryDiffView component
 */
export interface QueryDiffViewProps {
  /** Column definitions */
  columns: DiffColumn[];
  /** Row data with diff status */
  rows: DiffRow[];
  /** Display mode (inline or side-by-side) */
  displayMode?: DiffDisplayMode;
  /** Callback when display mode changes */
  onDisplayModeChange?: (mode: DiffDisplayMode) => void;
  /** Show only changed rows */
  changedOnly?: boolean;
  /** Callback when changed only filter changes */
  onChangedOnlyChange?: (changedOnly: boolean) => void;
  /** Primary keys for matching rows */
  primaryKeys?: string[];
  /** Callback when primary keys change */
  onPrimaryKeysChange?: (keys: string[]) => void;
  /** Warning messages */
  warnings?: string[];
  /** Base environment label */
  baseLabel?: string;
  /** Current environment label */
  currentLabel?: string;
  /** Row height in pixels */
  rowHeight?: number;
  /** Empty state message */
  emptyMessage?: string;
  /** No changes message */
  noChangesMessage?: string;
  /** Additional toolbar content */
  toolbarContent?: ReactNode;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Optional CSS class */
  className?: string;
}

/**
 * Display mode toggle component
 */
interface DisplayModeToggleProps {
  value: DiffDisplayMode;
  onChange: (mode: DiffDisplayMode) => void;
}

const DisplayModeToggle = memo(function DisplayModeToggle({
  value,
  onChange,
}: DisplayModeToggleProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_e, newValue) => newValue && onChange(newValue)}
      size="small"
      sx={{ height: 28 }}
    >
      <ToggleButton value="inline" sx={{ px: 1.5 }}>
        Inline
      </ToggleButton>
      <ToggleButton value="side-by-side" sx={{ px: 1.5 }}>
        Side by Side
      </ToggleButton>
    </ToggleButtonGroup>
  );
});

/**
 * Changed only checkbox component
 */
interface ChangedOnlyCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ChangedOnlyCheckbox = memo(function ChangedOnlyCheckbox({
  checked,
  onChange,
}: ChangedOnlyCheckboxProps) {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          size="small"
        />
      }
      label="Changed only"
      slotProps={{
        typography: { variant: "body2" },
      }}
    />
  );
});

/**
 * QueryDiffView Component
 *
 * A pure presentation component for displaying diff results between
 * base and current query outputs. Supports inline and side-by-side views.
 *
 * @example Basic usage
 * ```tsx
 * import { QueryDiffView } from '@datarecce/ui/primitives';
 *
 * function DiffPanel({ diffData }) {
 *   const [displayMode, setDisplayMode] = useState('inline');
 *   const [changedOnly, setChangedOnly] = useState(false);
 *
 *   return (
 *     <QueryDiffView
 *       columns={diffData.columns}
 *       rows={diffData.rows}
 *       displayMode={displayMode}
 *       onDisplayModeChange={setDisplayMode}
 *       changedOnly={changedOnly}
 *       onChangedOnlyChange={setChangedOnly}
 *       primaryKeys={['id']}
 *     />
 *   );
 * }
 * ```
 *
 * @example With warnings
 * ```tsx
 * <QueryDiffView
 *   columns={columns}
 *   rows={rows}
 *   warnings={[
 *     'Primary key is not unique in base environment',
 *     'Results limited to 10,000 rows',
 *   ]}
 * />
 * ```
 */
function QueryDiffViewComponent(
  {
    columns,
    rows,
    displayMode = "inline",
    onDisplayModeChange,
    changedOnly = false,
    onChangedOnlyChange,
    primaryKeys = [],
    onPrimaryKeysChange,
    warnings = [],
    baseLabel = "Base",
    currentLabel = "Current",
    rowHeight = 32,
    emptyMessage = "No data",
    noChangesMessage = "No changes detected",
    toolbarContent,
    theme = "light",
    className,
  }: QueryDiffViewProps,
  ref: Ref<QueryDiffViewHandle>,
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

  // Filter rows if changedOnly
  const filteredRows = useMemo(() => {
    if (!changedOnly) return rows;
    return rows.filter((row) => row.__status !== "unchanged");
  }, [rows, changedOnly]);

  // Convert to AG Grid column defs with diff styling
  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(() => {
    return columns.map((col) => ({
      field: col.field,
      headerName: col.headerName ?? col.field,
      width: col.width,
      minWidth: col.minWidth ?? 35,
      maxWidth: 800,
      resizable: true,
      sortable: true,
      pinned: col.pinned ?? (col.isPrimaryKey ? "left" : null),
      cellClass: (params: { data: DiffRow }) => {
        const classes: string[] = [];
        if (col.cellClass) {
          if (Array.isArray(col.cellClass)) {
            classes.push(...col.cellClass);
          } else {
            classes.push(col.cellClass);
          }
        }
        // Add diff status class
        if (params.data?.__status) {
          classes.push(`diff-cell-${params.data.__status}`);
        }
        return classes;
      },
      headerClass: col.isPrimaryKey ? "diff-header-pkey" : undefined,
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
    () => (params: { data: DiffRow }) => {
      if (params.data?.__rowKey !== undefined) {
        return String(params.data.__rowKey);
      }
      return String(Math.random());
    },
    [],
  );

  const isDark = theme === "dark";

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

  // No changes state (when filtering)
  if (changedOnly && filteredRows.length === 0 && rows.length > 0) {
    return (
      <Box
        ref={containerRef}
        className={className}
        sx={{
          display: "flex",
          flexDirection: "column",
          bgcolor: isDark ? "grey.900" : "grey.50",
          height: "100%",
        }}
      >
        {/* Toolbar */}
        <Stack
          direction="row"
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            alignItems: "center",
            gap: 2,
            px: 2,
            py: 1,
          }}
        >
          {onDisplayModeChange && (
            <DisplayModeToggle
              value={displayMode}
              onChange={onDisplayModeChange}
            />
          )}
          {onChangedOnlyChange && (
            <ChangedOnlyCheckbox
              checked={changedOnly}
              onChange={onChangedOnlyChange}
            />
          )}
          <Box sx={{ flexGrow: 1 }} />
          {toolbarContent}
        </Stack>

        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography color="text.secondary">{noChangesMessage}</Typography>
        </Box>
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
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      {/* Toolbar */}
      <Stack
        direction="row"
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          alignItems: "center",
          gap: 2,
          px: 2,
          py: 1,
          flexWrap: "wrap",
        }}
      >
        {onDisplayModeChange && (
          <DisplayModeToggle
            value={displayMode}
            onChange={onDisplayModeChange}
          />
        )}
        {onChangedOnlyChange && (
          <ChangedOnlyCheckbox
            checked={changedOnly}
            onChange={onChangedOnlyChange}
          />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {toolbarContent}
      </Stack>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Stack
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: isDark ? "warning.dark" : "warning.light",
            px: 2,
            py: 0.5,
          }}
        >
          {warnings.map((warning) => (
            <Typography
              key={warning}
              variant="body2"
              sx={{ color: isDark ? "warning.contrastText" : "warning.dark" }}
            >
              ⚠ {warning}
            </Typography>
          ))}
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
          // Diff cell styling
          "& .diff-cell-added": {
            backgroundColor: isDark ? "#1a4d1a" : "#cefece",
          },
          "& .diff-cell-removed": {
            backgroundColor: isDark ? "#5c1f1f" : "#ffc5c5",
          },
          "& .diff-cell-modified": {
            backgroundColor: isDark ? "#5c4b1f" : "#fff3c5",
          },
          // Primary key header
          "& .diff-header-pkey": {
            backgroundColor: isDark ? "#2d4a5c" : "#d4e8f5",
            fontWeight: "bold",
          },
        }}
      >
        <AgGridReact
          columnDefs={columnDefs}
          rowData={filteredRows}
          getRowId={getRowId}
          rowHeight={rowHeight}
          headerHeight={36}
          defaultColDef={defaultColDef}
          suppressCellFocus={true}
          suppressRowHoverHighlight={false}
          animateRows={false}
          onGridReady={(event) => {
            gridApiRef.current = event.api;
          }}
        />
      </Box>
    </Box>
  );
}

export const QueryDiffView = forwardRef(QueryDiffViewComponent);
QueryDiffView.displayName = "QueryDiffView";
