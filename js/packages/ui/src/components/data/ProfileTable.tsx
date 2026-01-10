"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { ColDef, GridReadyEvent } from "ag-grid-community";
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
 * Display mode for profile diff view
 */
export type ProfileDisplayMode = "inline" | "side-by-side";

/**
 * Column render mode
 */
export type ColumnRenderMode = "raw" | "percent" | "abbreviated";

/**
 * Profile column definition
 */
export interface ProfileColumn {
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
  /** Whether this is a metric column */
  isMetric?: boolean;
  /** Render mode for this column */
  renderMode?: ColumnRenderMode;
  /** CSS class for cells */
  cellClass?: string | string[];
  /** CSS class for header */
  headerClass?: string | string[];
}

/**
 * Profile row data
 */
export interface ProfileRow {
  /** Column name */
  column?: string;
  /** Row key */
  __rowKey?: string | number;
  /** Diff status */
  __status?: "added" | "removed" | "modified" | "unchanged";
  /** Row data */
  [key: string]: unknown;
}

/**
 * Handle for accessing grid API
 */
export interface ProfileTableHandle {
  /** AG Grid API */
  api: GridReadyEvent["api"] | null;
  /** DOM element for screenshots */
  element: HTMLElement | null;
}

/**
 * Props for the ProfileTable component
 */
export interface ProfileTableProps {
  /** Column definitions */
  columns: ProfileColumn[];
  /** Row data */
  rows: ProfileRow[];
  /** Display mode for diff view */
  displayMode?: ProfileDisplayMode;
  /** Callback when display mode changes */
  onDisplayModeChange?: (mode: ProfileDisplayMode) => void;
  /** Pinned column fields */
  pinnedColumns?: string[];
  /** Callback when pinned columns change */
  onPinnedColumnsChange?: (columns: string[]) => void;
  /** Column render modes */
  columnRenderModes?: Record<string, ColumnRenderMode>;
  /** Callback when column render modes change */
  onColumnRenderModesChange?: (modes: Record<string, ColumnRenderMode>) => void;
  /** Row height in pixels */
  rowHeight?: number;
  /** Show display mode toggle */
  showDisplayModeToggle?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Additional toolbar content */
  toolbarContent?: ReactNode;
  /** Optional CSS class */
  className?: string;
}

/**
 * Display mode toggle component
 */
interface DisplayModeToggleProps {
  value: ProfileDisplayMode;
  onChange: (mode: ProfileDisplayMode) => void;
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
 * ProfileTable Component
 *
 * A pure presentation component for displaying profile data (column statistics)
 * in a tabular format using AG Grid.
 *
 * @example Basic usage
 * ```tsx
 * import { ProfileTable } from '@datarecce/ui/primitives';
 *
 * function ProfilePanel({ profileData }) {
 *   return (
 *     <ProfileTable
 *       columns={[
 *         { field: 'column', headerName: 'Column', pinned: 'left' },
 *         { field: 'dtype', headerName: 'Type' },
 *         { field: 'count', headerName: 'Count', isMetric: true },
 *         { field: 'nulls', headerName: 'Nulls', isMetric: true },
 *         { field: 'distinct', headerName: 'Distinct', isMetric: true },
 *       ]}
 *       rows={profileData.rows}
 *     />
 *   );
 * }
 * ```
 *
 * @example With diff display mode
 * ```tsx
 * const [displayMode, setDisplayMode] = useState('inline');
 *
 * <ProfileTable
 *   columns={columns}
 *   rows={rows}
 *   displayMode={displayMode}
 *   onDisplayModeChange={setDisplayMode}
 *   showDisplayModeToggle
 * />
 * ```
 */
function ProfileTableComponent(
  {
    columns,
    rows,
    displayMode = "inline",
    onDisplayModeChange,
    pinnedColumns = [],
    onPinnedColumnsChange,
    columnRenderModes = {},
    onColumnRenderModesChange,
    rowHeight = 32,
    showDisplayModeToggle = false,
    emptyMessage = "No profile data",
    theme = "light",
    toolbarContent,
    className,
  }: ProfileTableProps,
  ref: Ref<ProfileTableHandle>,
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

  // Convert to AG Grid column defs
  const columnDefs = useMemo<ColDef[]>(() => {
    return columns.map((col) => ({
      field: col.field,
      headerName: col.headerName ?? col.field,
      width: col.width,
      minWidth: col.minWidth ?? 35,
      maxWidth: 800,
      resizable: true,
      sortable: true,
      pinned: col.pinned ?? (pinnedColumns.includes(col.field) ? "left" : null),
      cellClass: (params: { data?: ProfileRow }) => {
        const classes: string[] = [];
        if (col.cellClass) {
          if (Array.isArray(col.cellClass)) {
            classes.push(...col.cellClass);
          } else {
            classes.push(col.cellClass);
          }
        }
        if (params.data?.__status) {
          classes.push(`profile-cell-${params.data.__status}`);
        }
        return classes;
      },
      headerClass: col.headerClass,
    }));
  }, [columns, pinnedColumns]);

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
    () => (params: { data: ProfileRow }) => {
      if (params.data?.__rowKey !== undefined) {
        return String(params.data.__rowKey);
      }
      if (params.data?.column !== undefined) {
        return String(params.data.column);
      }
      return String(Math.random());
    },
    [],
  );

  const showToolbar = showDisplayModeToggle || toolbarContent;

  // Empty state
  if (columns.length === 0 || rows.length === 0) {
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
        bgcolor: isDark ? "grey.900" : "grey.50",
        height: "100%",
      }}
    >
      {/* Toolbar */}
      {showToolbar && (
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
          {showDisplayModeToggle && onDisplayModeChange && (
            <DisplayModeToggle
              value={displayMode}
              onChange={onDisplayModeChange}
            />
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
          // Diff cell styling
          "& .profile-cell-added": {
            backgroundColor: isDark ? "#1a4d1a" : "#cefece",
          },
          "& .profile-cell-removed": {
            backgroundColor: isDark ? "#5c1f1f" : "#ffc5c5",
          },
          "& .profile-cell-modified": {
            backgroundColor: isDark ? "#5c4b1f" : "#fff3c5",
          },
        }}
      >
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rows}
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

export const ProfileTable = forwardRef(ProfileTableComponent);
ProfileTable.displayName = "ProfileTable";
