/**
 * @file DataFrameColumnGroupHeader.tsx
 * @description Column group header component for DataGrid with pin/primary key controls
 *
 * Provides interactive column header with:
 * - Primary key indicator and toggle
 * - Pin/unpin column functionality
 * - Number column precision options menu
 */

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { type MouseEvent, useState } from "react";
import {
  VscClose,
  VscKebabVertical,
  VscKey,
  VscPin,
  VscPinned,
} from "react-icons/vsc";
import type { ColumnRenderMode, ColumnType } from "../../../api";
import { columnPrecisionSelectOptions } from "../../../utils/dataGrid/columnPrecisionOptions";

/**
 * Props for the DataFrameColumnGroupHeader component
 */
export interface DataFrameColumnGroupHeaderProps {
  /** Column name to display */
  name: string;
  /** Column diff status: 'added', 'removed', 'modified', or empty string */
  columnStatus: string;
  /** Column data type for determining available options */
  columnType: ColumnType;
  /** List of current primary key column names */
  primaryKeys?: string[];
  /** Callback when primary keys change (enables PK toggle functionality) */
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  /** List of currently pinned column names */
  pinnedColumns?: string[];
  /** Callback when pinned columns change */
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  /** Callback when column render mode changes */
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

/**
 * Column group header with interactive controls
 *
 * @description Renders a column header with:
 * - Primary key icon (VscKey) when column is a primary key
 * - Primary key add/remove toggle (when onPrimaryKeyChange is provided and column can be a PK)
 * - Pin/unpin toggle (when onPinnedColumnsChange is provided and column is not a PK)
 * - Precision options menu for number columns
 *
 * Uses exact string matching for primary keys and pinned columns.
 * Backend normalization ensures column names match user-specified keys.
 *
 * @example
 * ```tsx
 * // Query diff mode with PK toggle
 * <DataFrameColumnGroupHeader
 *   name="user_id"
 *   columnStatus=""
 *   columnType="number"
 *   primaryKeys={['user_id']}
 *   onPrimaryKeyChange={setPrimaryKeys}
 *   pinnedColumns={[]}
 *   onPinnedColumnsChange={setPinnedColumns}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Value diff mode (display-only PK indicator)
 * <DataFrameColumnGroupHeader
 *   name="user_id"
 *   columnStatus="modified"
 *   columnType="number"
 *   primaryKeys={['user_id']}
 *   pinnedColumns={[]}
 *   onPinnedColumnsChange={setPinnedColumns}
 * />
 * ```
 */
export function DataFrameColumnGroupHeader({
  name,
  columnStatus,
  columnType,
  primaryKeys = [],
  onPrimaryKeyChange,
  pinnedColumns = [],
  onPinnedColumnsChange,
  onColumnsRenderModeChanged,
}: DataFrameColumnGroupHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Skip rendering for index column
  if (name === "index") {
    return <></>;
  }

  // Determine if column is a primary key or pinned (exact matching)
  const isPK = primaryKeys.includes(name);
  const isPinned = pinnedColumns.includes(name);

  // Column can be a PK only if it's not added/removed (for diff scenarios)
  const canBePk = columnStatus !== "added" && columnStatus !== "removed";

  // Build precision options for number columns
  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(
      name,
      onColumnsRenderModeChanged,
    );
  }

  // Primary key handlers
  const handleRemovePk = () => {
    if (!onPrimaryKeyChange) return;
    const newPrimaryKeys = primaryKeys.filter((item) => item !== name);
    onPrimaryKeyChange(newPrimaryKeys);
  };

  const handleAddPk = () => {
    if (!onPrimaryKeyChange) return;
    const newPrimaryKeys = [
      ...primaryKeys.filter((item) => item !== "index"),
      name,
    ];
    onPrimaryKeyChange(newPrimaryKeys);
  };

  // Pin/unpin handlers
  const handleUnpin = () => {
    if (!onPinnedColumnsChange) return;
    const newPinnedColumns = pinnedColumns.filter((item) => item !== name);
    onPinnedColumnsChange(newPinnedColumns);
  };

  const handlePin = () => {
    if (!onPinnedColumnsChange) return;
    const newPinnedColumns = [...pinnedColumns, name];
    onPinnedColumnsChange(newPinnedColumns);
  };

  return (
    <Box
      sx={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}
      className="grid-header"
    >
      {/* Primary key icon */}
      {isPK && <VscKey />}

      {/* Column name */}
      <Box
        sx={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </Box>

      {/* Primary key toggle (only when onPrimaryKeyChange is provided) */}
      {canBePk && onPrimaryKeyChange && (
        <Box
          component={isPK ? VscClose : VscKey}
          className={isPK ? "close-icon" : "key-icon"}
          sx={{
            display: isPK ? "block" : "none",
            cursor: "pointer",
          }}
          onClick={isPK ? handleRemovePk : handleAddPk}
        />
      )}

      {/* Pin/unpin toggle (only for non-PK columns when callback is provided) */}
      {!isPK && onPinnedColumnsChange && (
        <Box
          component={isPinned ? VscPinned : VscPin}
          className={isPinned ? "unpin-icon" : "pin-icon"}
          sx={{
            display: isPinned ? "block" : "none",
            cursor: "pointer",
          }}
          onClick={isPinned ? handleUnpin : handlePin}
        />
      )}

      {/* Precision menu for number columns (only for non-PK columns) */}
      {!isPK && columnType === "number" && selectOptions.length > 0 && (
        <>
          <IconButton
            aria-label="Options"
            size="small"
            className="!size-4 !min-w-4"
            onClick={handleMenuClick}
          >
            <VscKebabVertical />
          </IconButton>
          <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
            {selectOptions.map((o) => (
              <MenuItem
                key={o.value}
                onClick={() => {
                  o.onClick();
                  handleMenuClose();
                }}
              >
                {o.value}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </Box>
  );
}
