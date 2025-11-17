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
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import {
  dataFrameToRowObjects,
  getCaseInsensitive,
  includesIgnoreCase,
  keyToNumber,
} from "@/utils/transforms";
import {
  defaultRenderCell,
  inlineRenderCell,
  QueryDataDiffGridOptions,
} from "../query/querydiff";
import { columnPrecisionSelectOptions } from "./shared";

function _getColumnMap(df: DataFrame) {
  const result: Record<
    string,
    {
      key: string;
      index: number;
      status?: string;
      colType: ColumnType;
    }
  > = {};

  df.columns.map((col, index) => {
    // Normalize special column names to uppercase
    const normalizedColName =
      col.name.toLowerCase() === "in_a"
        ? "IN_A"
        : col.name.toLowerCase() === "in_b"
          ? "IN_B"
          : col.name;
    const normalizedColKey =
      col.key.toLowerCase() === "in_a"
        ? "IN_A"
        : col.key.toLowerCase() === "in_b"
          ? "IN_B"
          : col.key;

    result[normalizedColName] = {
      key: normalizedColKey,
      index,
      colType: col.type,
    };
  });

  return result;
}

function _getPrimaryKeyKeys(
  columns: DataFrame["columns"],
  primaryKeys: string[],
) {
  const keys: string[] = [];
  for (const key of primaryKeys) {
    const index = columns.findIndex((col) =>
      includesIgnoreCase([col.key], key),
    );
    if (index < 0) {
      throw new Error(`Column ${key} not found`);
    }

    keys.push(key);
  }
  return keys;
}

function _getPrimaryKeyValue(
  columns: DataFrame["columns"],
  primaryKeys: string[],
  row: RowObjectType,
): string {
  // just make a concatenated string rather than a JSON string
  const result: string[] = [];

  if (primaryKeys.length === 0) {
    return String(row._index);
  } else {
    for (const key of primaryKeys) {
      const colOrNone = columns.find((c) => includesIgnoreCase([c.key], key));
      if (colOrNone == null) {
        throw new Error(`Primary Column ${key} not found`);
      }
      result.push(`${colOrNone.name}=${getCaseInsensitive(row, key) ?? ""}`);
    }
    return result.join("|");
  }
}

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
  const isPK = includesIgnoreCase(primaryKeys, name);
  const isPinned = includesIgnoreCase(pinnedColumns, name);

  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(
      name,
      onColumnsRenderModeChanged,
    );
  }

  if (name === "index") {
    return <></>;
  }

  const handleUnpin = () => {
    const newPinnedColumns = pinnedColumns.filter((item) => item !== name);

    if (onPinnedColumnsChange) {
      onPinnedColumnsChange(newPinnedColumns);
    }
  };

  const handlePin = () => {
    const newPinnedColumns = [...pinnedColumns, name];

    if (onPinnedColumnsChange) {
      onPinnedColumnsChange(newPinnedColumns);
    }
  };

  return (
    <Flex alignItems="center" gap="10px" className="grid-header">
      {isPK && <Icon as={VscKey} />}
      <Box
        flex={1}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
        {name}
      </Box>
      {!isPK && onPinnedColumnsChange && (
        <Icon
          className={isPinned ? "unpin-icon" : "pin-icon"}
          display={isPinned ? "block" : "none"}
          cursor="pointer"
          as={isPinned ? VscPinned : VscPin}
          onClick={isPinned ? handleUnpin : handlePin}
        />
      )}
      {!isPK && columnType === "number" && (
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
                  <Menu.Item value={o.value} key={o.value} onClick={o.onClick}>
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
  const columnMap = _getColumnMap(df);

  // "in_a" and "in_b" are special columns used in the query template, columns are in uppercase in snowflake
  if ("IN_A" in columnMap) {
    primaryKeys = primaryKeys.map((key) => key.toUpperCase());
  }

  // merge row
  const baseMap: Record<string, RowObjectType | undefined> = {};
  const currentMap: Record<string, RowObjectType | undefined> = {};
  if (primaryKeys.length === 0) {
    throw new Error("Primary keys are required");
  }

  const primaryKeyKeys = _getPrimaryKeyKeys(df.columns, primaryKeys);
  const inBaseIndex = columnMap.IN_A.key;
  const inCurrentIndex = columnMap.IN_B.key;

  transformedData.forEach((row) => {
    const key = _getPrimaryKeyValue(df.columns, primaryKeyKeys, row);
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
          // add the primary key value directly (not prefixed with base__ or current__)
          row[col.key] = baseRow[col.key];
          return;
        }
        row[`base__${col.key}`] = baseRow[col.key];
      });
    }

    if (currentRow) {
      df.columns.forEach((col) => {
        if (includesIgnoreCase(primaryKeys, col.key)) {
          // add the primary key value directly (not prefixed with base__ or current__)
          row[col.key] = currentRow[col.key];
          return;
        }
        row[`current__${col.key}`] = currentRow[col.key];
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

  // merge columns
  const toColumn = (
    name: string,
    columnStatus: string,
    columnType: ColumnType,
    columnRenderMode: ColumnRenderMode = "raw",
  ): ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  } => {
    const headerCellClass =
      columnStatus === "added"
        ? "diff-header-added"
        : columnStatus === "removed"
          ? "diff-header-removed"
          : undefined;

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

  // merges columns: primary keys
  primaryKeys.forEach((name) => {
    const lowercaseName = name.toLowerCase();
    const columnStatus = columnMap[lowercaseName].status ?? "";
    const columnType = columnMap[lowercaseName].colType;

    columns.push({
      key: lowercaseName,
      name: (
        <DataFrameColumnGroupHeader
          name={lowercaseName}
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
      columnRenderMode: columnsRenderMode[lowercaseName],
    });
  });

  // merges columns: pinned columns
  pinnedColumns.forEach((name) => {
    const lowercaseName = name.toLowerCase();
    const columnStatus = columnMap[lowercaseName].status ?? "";
    const columnType = columnMap[lowercaseName].colType;

    if (includesIgnoreCase(primaryKeys, lowercaseName)) {
      return;
    }

    columns.push(
      toColumn(
        lowercaseName,
        columnStatus,
        columnType,
        columnsRenderMode[lowercaseName],
      ),
    );
  });

  // merges columns: other columns
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status ?? "";

    if (name === "IN_A" || name === "IN_B") {
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
        name.toLowerCase(),
        columnStatus,
        mergedColumn.colType,
        columnsRenderMode[name.toLowerCase()],
      ),
    );
  });

  return {
    columns,
    rows,
  };
}
