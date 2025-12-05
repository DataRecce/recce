/**
 * @file valuediff.tsx
 * @description Value diff grid generation for joined data (with IN_A/IN_B columns)
 *
 * REFACTORED: Now uses shared utilities from @/lib/dataGrid/shared
 */

import _ from "lodash";
import { ColumnOrColumnGroup, textEditor } from "react-data-grid";
import "../query/styles.css";
import { Box, Flex, Icon, IconButton, Menu, Portal } from "@chakra-ui/react";
import React from "react";
import { VscKebabVertical, VscKey, VscPin, VscPinned } from "react-icons/vsc";
import {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowObjectType,
} from "@/lib/api/types";
// ============================================================================
// Import shared utilities
// ============================================================================
import {
  buildJoinedColumnMap,
  getHeaderCellClass,
  getPrimaryKeyValue,
  validatePrimaryKeys,
} from "@/lib/dataGrid/shared";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import {
  dataFrameToRowObjects,
  getCaseInsensitive,
  getValueAtPath,
  includesIgnoreCase,
  keyToNumber,
} from "@/utils/transforms";
import {
  defaultRenderCell,
  inlineRenderCell,
  QueryDataDiffGridOptions,
} from "../query/querydiff";
import { columnPrecisionSelectOptions } from "./shared";

// ============================================================================
// React Components (must stay in this file)
// ============================================================================

function DataFrameColumnGroupHeader({
  name,
  columnStatus,
  onPrimaryKeyChange,
  onPinnedColumnsChange,
  columnType,
  onColumnsRenderModeChanged,
  ...options
}: {
  name: string;
  columnStatus: string;
  columnType: ColumnType;
  onColumnRenderModeChanged?: (
    colNam: string,
    renderAs: ColumnRenderMode,
  ) => void;
} & QueryDataDiffGridOptions) {
  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];

  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(
      name,
      onColumnsRenderModeChanged,
    );
  }

  const isPrimaryKey = includesIgnoreCase(primaryKeys, name);
  const isPinned = includesIgnoreCase(pinnedColumns, name);

  const handleUnpin = () => {
    const newPinnedColumns = pinnedColumns.filter(
      (item) => item.toLowerCase() !== name.toLowerCase(),
    );
    onPinnedColumnsChange?.(newPinnedColumns);
  };

  const handlePin = () => {
    const newPinnedColumns = [...pinnedColumns, name];
    onPinnedColumnsChange?.(newPinnedColumns);
  };

  return (
    <Flex className="grid-header" alignItems="center">
      <Box flex={1}>
        {isPrimaryKey && (
          <Icon as={VscKey} style={{ marginRight: "5px" }}></Icon>
        )}
        {name}
      </Box>

      <Icon
        className={isPinned ? "unpin-icon" : "pin-icon"}
        display={isPinned ? "block" : "none"}
        cursor="pointer"
        as={isPinned ? VscPinned : VscPin}
        onClick={isPinned ? handleUnpin : handlePin}
      />
      {columnType === "number" && (
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

// ============================================================================
// Main Grid Generation Function
// ============================================================================

export function toValueDiffGrid(
  df: DataFrame,
  primaryKeys: string[],
  options?: QueryDataDiffGridOptions,
) {
  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "inline";
  const columnsRenderMode = options?.columnsRenderMode ?? {};
  const transformedData = dataFrameToRowObjects(df);

  const columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[] = [];

  // REFACTORED: Use shared utility for column map
  const columnMap = buildJoinedColumnMap(df);

  // Build row maps based on IN_A/IN_B columns
  const baseMap: Record<string, RowObjectType | undefined> = {};
  const currentMap: Record<string, RowObjectType | undefined> = {};

  if (primaryKeys.length === 0) {
    throw new Error("Primary keys are required");
  }

  // REFACTORED: Use shared utility for PK validation
  const primaryKeyKeys = validatePrimaryKeys(df.columns, primaryKeys, true);
  const inBaseIndex = columnMap.IN_A.key;
  const inCurrentIndex = columnMap.IN_B.key;

  transformedData.forEach((row) => {
    // REFACTORED: Use shared utility for PK value generation
    const key = getPrimaryKeyValue(df.columns, primaryKeyKeys, row, true);

    if (getCaseInsensitive(row, inBaseIndex)) {
      baseMap[key.toLowerCase()] = row;
    }

    if (getCaseInsensitive(row, inCurrentIndex)) {
      currentMap[key.toLowerCase()] = row;
    }
  });

  const mergedMap = mergeKeysWithStatus(
    Object.keys(baseMap),
    Object.keys(currentMap),
  );

  const rowStats = {
    added: 0,
    removed: 0,
    modified: 0,
  };

  let rows = Object.entries(mergedMap).map(([key]) => {
    const baseRow = baseMap[key];
    const currentRow = currentMap[key];
    const row: RowObjectType = {
      _index: keyToNumber(key),
      __status: undefined,
    };

    if (baseRow) {
      df.columns.forEach((col) => {
        if (includesIgnoreCase(primaryKeys, col.key)) {
          // Add the primary key value directly (not prefixed with base__/current__)
          row[String(col.key).toLowerCase()] = baseRow[col.key];
          return;
        }
        row[`base__${col.key}`.toLowerCase()] = baseRow[col.key];
      });
    }

    if (currentRow) {
      df.columns.forEach((col) => {
        if (includesIgnoreCase(primaryKeys, col.key)) {
          // Add the primary key value directly (not prefixed with base__/current__)
          row[String(col.key).toLowerCase()] = currentRow[col.key];
          return;
        }
        row[`current__${col.key}`.toLowerCase()] = currentRow[col.key];
      });
    }

    // Check if row is added, removed, or modified
    if (!baseRow) {
      row.__status = "added";
      rowStats.added++;
    } else if (!currentRow) {
      row.__status = "removed";
      rowStats.removed++;
    } else {
      for (const [name, column] of Object.entries(columnMap)) {
        if (name === "index") {
          continue;
        }

        if (includesIgnoreCase(primaryKeys, name)) {
          continue;
        }

        if (!_.isEqual(baseRow[column.key], currentRow[column.key])) {
          row.__status = "modified";
          column.status = "modified";
        }
      }
    }

    if (row.__status === "modified") {
      rowStats.modified++;
    }

    return row;
  });

  if (changedOnly) {
    rows = rows.filter(
      (row) =>
        row.__status === "added" ||
        row.__status === "removed" ||
        row.__status === "modified",
    );
  }

  // Column builder helper
  const toColumn = (
    name: string,
    columnStatus: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ): ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } => {
    // REFACTORED: Use shared utility for header cell class
    const headerCellClass = getHeaderCellClass(columnStatus);

    const cellClassBase = (row: RowObjectType) => {
      const rowStatus = row.__status;
      if (rowStatus === "removed") {
        return "diff-cell-removed";
      } else if (rowStatus === "added") {
        return "diff-cell-added";
      } else if (columnStatus === "added") {
        return undefined;
      } else if (columnStatus === "removed") {
        return undefined;
      } else if (!_.isEqual(row[`base__${name}`], row[`current__${name}`])) {
        return "diff-cell-removed";
      }

      return undefined;
    };

    const cellClassCurrent = (row: RowObjectType) => {
      const rowStatus = row.__status;
      if (rowStatus === "removed") {
        return "diff-cell-removed";
      } else if (rowStatus === "added") {
        return "diff-cell-added";
      } else if (columnStatus === "added") {
        return undefined;
      } else if (columnStatus === "removed") {
        return undefined;
      } else if (!_.isEqual(row[`base__${name}`], row[`current__${name}`])) {
        return "diff-cell-added";
      }

      return undefined;
    };

    if (displayMode === "inline") {
      return {
        headerCellClass,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            columnStatus={columnStatus}
            primaryKeys={primaryKeys}
            columnType={columnType}
            {...options}
          />
        ),
        key: name,
        renderCell: inlineRenderCell,
        columnType,
        columnRenderMode,
      };
    } else {
      return {
        headerCellClass,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            columnStatus={columnStatus}
            primaryKeys={primaryKeys}
            columnType={columnType}
            {...options}
          />
        ),
        children: [
          {
            key: `base__${name}`,
            name: options?.baseTitle ?? "Base",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass: cellClassBase,
            renderCell: defaultRenderCell,
            // @ts-expect-error Unable to patch children type, just pass it through
            columnType,
            columnRenderMode,
          },
          {
            key: `current__${name}`,
            name: options?.currentTitle ?? "Current",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass: cellClassCurrent,
            renderCell: defaultRenderCell,
            // @ts-expect-error Unable to patch children type, just pass it through
            columnType,
            columnRenderMode,
          },
        ],
      };
    }
  };

  // Build columns: primary keys
  primaryKeys.forEach((name) => {
    const col = getValueAtPath(columnMap, name);
    if (!col) {
      throw new Error(`Primary column ${name} not found in DataFrame`);
    }
    const columnStatus = col.status ?? "";
    const columnType = col.colType;

    columns.push({
      key: name,
      name: (
        <DataFrameColumnGroupHeader
          name={name}
          columnStatus={columnStatus}
          primaryKeys={primaryKeys.map((k) => k.toLowerCase())}
          columnType={"unknown"}
          {...options}
        />
      ),
      frozen: true,
      cellClass: (row: RowObjectType) => {
        if (row.__status) {
          return `diff-header-${row.__status}`;
        }
        return undefined;
      },
      renderCell: defaultRenderCell,
      columnType,
      columnRenderMode: columnsRenderMode[name],
    });
  });

  // Build columns: pinned columns
  pinnedColumns.forEach((name) => {
    const col = getValueAtPath(columnMap, name);
    if (!col) {
      throw new Error(`Pinned column ${name} not found in DataFrame`);
    }
    const columnStatus = col.status ?? "";
    const columnType = col.colType;

    if (includesIgnoreCase(primaryKeys, name)) {
      return;
    }

    columns.push(
      toColumn(name, columnStatus, columnType, columnsRenderMode[name]),
    );
  });

  // Build columns: other columns (excluding IN_A/IN_B and already added)
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status ?? "";

    // Skip IN_A/IN_B columns
    if (includesIgnoreCase(["in_a", "IN_A", "in_b", "IN_B"], name)) {
      return;
    }

    if (includesIgnoreCase(primaryKeys, name)) {
      return;
    }

    if (includesIgnoreCase(pinnedColumns, name)) {
      return;
    }

    if (changedOnly && rowStats.modified > 0) {
      if (
        columnStatus !== "added" &&
        columnStatus !== "removed" &&
        columnStatus !== "modified"
      ) {
        return;
      }
    }

    columns.push(
      toColumn(
        name,
        columnStatus,
        mergedColumn.colType,
        columnsRenderMode[name],
      ),
    );
  });

  return {
    columns,
    rows,
  };
}
