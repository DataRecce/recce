/**
 * @file DataFrameColumnGroupHeader.tsx
 * @description Column group header component for DataGrid with pin/primary key controls
 *
 * Provides interactive column header with:
 * - Primary key indicator and toggle
 * - Pin/unpin column functionality
 * - Number column precision options menu
 */

import { Box, Flex, Icon, IconButton, Menu, Portal } from "@/components/ui/mui";
import React from "react";
import {
  VscClose,
  VscKebabVertical,
  VscKey,
  VscPin,
  VscPinned,
} from "react-icons/vsc";
import { columnPrecisionSelectOptions } from "@/components/valuediff/shared";
import { ColumnRenderMode, ColumnType } from "@/lib/api/types";

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
 *
 * @example
 * // Value diff mode (display-only PK indicator)
 * <DataFrameColumnGroupHeader
 *   name="user_id"
 *   columnStatus="modified"
 *   columnType="number"
 *   primaryKeys={['user_id']}
 *   pinnedColumns={[]}
 *   onPinnedColumnsChange={setPinnedColumns}
 * />
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
    <Flex alignItems="center" gap="10px" className="grid-header">
      {/* Primary key icon */}
      {isPK && <Icon as={VscKey} />}

      {/* Column name */}
      <Box
        flex={1}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {name}
      </Box>

      {/* Primary key toggle (only when onPrimaryKeyChange is provided) */}
      {canBePk && onPrimaryKeyChange && (
        <Icon
          className={isPK ? "close-icon" : "key-icon"}
          display={isPK ? "block" : "none"}
          cursor="pointer"
          as={isPK ? VscClose : VscKey}
          onClick={isPK ? handleRemovePk : handleAddPk}
        />
      )}

      {/* Pin/unpin toggle (only for non-PK columns when callback is provided) */}
      {!isPK && onPinnedColumnsChange && (
        <Icon
          className={isPinned ? "unpin-icon" : "pin-icon"}
          display={isPinned ? "block" : "none"}
          cursor="pointer"
          as={isPinned ? VscPinned : VscPin}
          onClick={isPinned ? handleUnpin : handlePin}
        />
      )}

      {/* Precision menu for number columns (only for non-PK columns) */}
      {!isPK && columnType === "number" && selectOptions.length > 0 && (
        <Menu.Root>
          <Menu.Trigger asChild>
            <IconButton
              aria-label="Options"
              variant="plain"
              className="!size-4 !min-w-4"
            >
              <VscKebabVertical />
            </IconButton>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                {selectOptions.map((o) => (
                  <Menu.Item key={o.value} value={o.value} onClick={o.onClick}>
                    {o.value}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
    </Flex>
  );
}
