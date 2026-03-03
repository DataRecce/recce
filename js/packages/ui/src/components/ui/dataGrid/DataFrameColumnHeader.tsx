/**
 * @file DataFrameColumnHeader.tsx
 * @description Column header component for standard DataGrid columns
 *
 * Provides interactive column header with:
 * - Pin/unpin column functionality
 * - Number column precision options menu
 */

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { type MouseEvent, useState } from "react";
import { PiDotsThreeVertical } from "react-icons/pi";
import { VscPin, VscPinned } from "react-icons/vsc";
import type { ColumnRenderMode, ColumnType } from "../../../api";
import { columnPrecisionSelectOptions } from "../../../utils/dataGrid/columnPrecisionOptions";

/**
 * Props for the DataFrameColumnHeader component
 */
export interface DataFrameColumnHeaderProps {
  /** Column name to display */
  name: string;
  /** Column data type for determining available options */
  columnType: ColumnType;
  /** List of currently pinned column names */
  pinnedColumns?: string[];
  /** Callback when pinned columns change */
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  /** Callback when column render mode changes */
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
}

/**
 * Column header with interactive controls for standard columns
 *
 * @description Renders a column header with:
 * - Pin/unpin toggle (when onPinnedColumnsChange is provided)
 * - Precision options menu for number columns
 *
 * @example
 * ```tsx
 * <DataFrameColumnHeader
 *   name="price"
 *   columnType="number"
 *   pinnedColumns={['id']}
 *   onPinnedColumnsChange={setPinnedColumns}
 *   onColumnsRenderModeChanged={setRenderModes}
 * />
 * ```
 */
export function DataFrameColumnHeader({
  name,
  pinnedColumns = [],
  onPinnedColumnsChange = () => {
    return void 0;
  },
  columnType,
  onColumnsRenderModeChanged,
}: DataFrameColumnHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(
      name,
      onColumnsRenderModeChanged,
    );
  }

  const isPinned = pinnedColumns.includes(name);

  const handleUnpin = () => {
    const newPinnedColumns = pinnedColumns.filter((item) => item !== name);
    onPinnedColumnsChange(newPinnedColumns);
  };

  const handlePin = () => {
    const newPinnedColumns = [...pinnedColumns, name];
    onPinnedColumnsChange(newPinnedColumns);
  };

  return (
    <Box
      sx={{ display: "flex", alignItems: "center", width: "100%" }}
      className="grid-header"
    >
      <Box sx={{ flex: 1 }}>{name}</Box>

      <Box
        component={isPinned ? VscPinned : VscPin}
        className={isPinned ? "unpin-icon" : "pin-icon"}
        sx={{
          display: isPinned ? "block" : "none",
          cursor: "pointer",
        }}
        onClick={isPinned ? handleUnpin : handlePin}
      />
      {columnType === "number" && (
        <>
          <IconButton
            aria-label="Options"
            size="small"
            className="size-6!"
            sx={{
              p: 0,
            }}
            onClick={handleMenuClick}
          >
            <PiDotsThreeVertical />
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
