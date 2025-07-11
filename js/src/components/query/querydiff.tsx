import React from "react";
import {
  CalculatedColumn,
  ColumnOrColumnGroup,
  RenderCellProps,
  textEditor,
} from "react-data-grid";
import _ from "lodash";
import "./styles.css";
import { Box, Flex, Icon, IconButton, Menu, Portal, Text } from "@chakra-ui/react";
import { VscClose, VscKebabVertical, VscKey, VscPin, VscPinned } from "react-icons/vsc";
import { ColumnType, ColumnRenderMode, DataFrame, RowObjectType } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { DiffText } from "./DiffText";
import { formatNumber } from "@/utils/formatters";
import { columnPrecisionSelectOptions } from "@/components/valuediff/shared";

function _getColumnMap(base: DataFrame, current: DataFrame) {
  const result: Record<
    string,
    {
      baseColumnIndex: number;
      currentColumnIndex: number;
      status?: string;
      colType: ColumnType;
    }
  > = {};

  const mapStatus = mergeKeysWithStatus(
    base.columns.map((col) => col.name),
    current.columns.map((col) => col.name),
  ) as Record<string, string>;

  Object.entries(mapStatus).map(([key, status]) => {
    result[key] = {
      status,
      baseColumnIndex: base.columns.findIndex((col) => col.name === key),
      currentColumnIndex: current.columns.findIndex((col) => col.name === key),
      colType: base.columns.find((c) => c.name === key)?.type ?? "unknown",
    };
  });

  return result;
}

function _getPrimaryKeyIndexes(columns: DataFrame["columns"], primaryKeys: string[]) {
  const indexes: number[] = [];
  for (const key of primaryKeys) {
    const index = columns.findIndex((col) => col.name === key);
    if (index < 0) {
      throw new Error(`Column ${key} not found`);
    }

    indexes.push(index);
  }
  return indexes;
}

function _getPrimaryKeyValue(
  columns: DataFrame["columns"],
  primaryIndexes: number[],
  row: DataFrame["data"][number],
): string {
  const result: Record<string, any> = {};

  if (primaryIndexes.length === 0) {
    const row_data = row as any;

    return JSON.stringify({ _index: row_data._index });
  } else {
    for (const index of primaryIndexes) {
      const col = columns[index];
      result[col.name] = row[index];
    }
    return JSON.stringify(result);
  }
}

export interface QueryDataDiffGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  columnsRenderMode?: Record<string, ColumnRenderMode>;
  onColumnsRenderModeChanged?: (col: Record<string, ColumnRenderMode>) => void;
  changedOnly?: boolean;
  baseTitle?: string;
  currentTitle?: string;
  displayMode?: "side_by_side" | "inline";
}

export function DataFrameColumnGroupHeader({
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
  onColumnRenderModeChanged?: (colNam: string, renderAs: ColumnRenderMode) => void;
} & QueryDataDiffGridOptions) {
  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];
  const isPK = primaryKeys.includes(name);
  const isPinned = pinnedColumns.includes(name);
  const canBePk = columnStatus !== "added" && columnStatus !== "removed";

  let selectOptions: { value: string; onClick: () => void }[] = [];
  if (onColumnsRenderModeChanged) {
    selectOptions = columnPrecisionSelectOptions(name, onColumnsRenderModeChanged);
  }

  if (name === "index") {
    return <></>;
  }

  const handleRemovePk = () => {
    const newPrimaryKeys = primaryKeys.filter((item) => item !== name);

    if (onPrimaryKeyChange) {
      onPrimaryKeyChange(newPrimaryKeys);
    }
  };

  const handleAddPk = () => {
    const newPrimaryKeys = [...primaryKeys.filter((item) => item !== "index"), name];

    if (onPrimaryKeyChange) {
      onPrimaryKeyChange(newPrimaryKeys);
    }
  };

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
      <Box flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
        {name}
      </Box>
      {canBePk && onPrimaryKeyChange && (
        <Icon
          className={isPK ? "close-icon" : "key-icon"}
          display={isPK ? "block" : "none"}
          cursor="pointer"
          as={isPK ? VscClose : VscKey}
          onClick={isPK ? handleRemovePk : handleAddPk}
        />
      )}
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
            <IconButton aria-label="Options" variant="plain" className="!size-4 !min-w-4">
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

function columnRenderedValue(
  value: number,
  renderAs: "raw" | "percent" | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): string {
  const locale = "en-US";
  let renderedValue: string | undefined;
  if (typeof renderAs === "number") {
    renderedValue = formatNumber(value, locale, {
      maximumFractionDigits: renderAs,
      minimumFractionDigits: renderAs,
    });
  } else if (renderAs === "percent") {
    renderedValue = formatNumber(value, locale, { style: "percent", maximumFractionDigits: 2 });
  } else {
    renderedValue = String(value);
  }

  return renderedValue ?? "";
}

const toRenderedValue = (
  row: RowObjectType,
  key: string,
  columnType?: ColumnType,
  columnRenderMode: ColumnRenderMode = "raw",
): [string, boolean] => {
  if (!Object.hasOwn(row, key)) {
    return ["-", true];
  }
  const value = row[key];

  let renderedValue: string;
  let grayOut = false;

  if (typeof value === "boolean") {
    // workaround for https://github.com/adazzle/react-data-grid/issues/882
    renderedValue = value.toString();
  } else if (value === "") {
    renderedValue = "(empty)";
    grayOut = true;
  } else if (value === undefined || value === null) {
    renderedValue = "(null)";
    grayOut = true;
  } else if (typeof value === "number") {
    renderedValue = String(value);
  } else {
    if (columnType && columnType === "number") {
      // Add formatting for numerical values if required
      renderedValue = columnRenderedValue(parseFloat(value), columnRenderMode);
    } else {
      // convert to string
      renderedValue = String(value);
    }
  }

  return [renderedValue, grayOut];
};

export const defaultRenderCell = ({ row, column }: RenderCellProps<RowObjectType>) => {
  // Add the potential addition of columnType
  const { columnType, columnRenderMode } = column as unknown as CalculatedColumn<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  };

  const [renderedValue, grayOut] = toRenderedValue(row, column.key, columnType, columnRenderMode);
  return <Text style={{ color: grayOut ? "gray" : "inherit" }}>{renderedValue}</Text>;
};

export const inlineRenderCell = ({ row, column }: RenderCellProps<RowObjectType>) => {
  // Add the potential addition of columnType
  const { columnType, columnRenderMode } = column as unknown as CalculatedColumn<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  };
  const baseKey = `base__${column.key}`;
  const currentKey = `current__${column.key}`;

  if (!Object.hasOwn(row, baseKey) && !Object.hasOwn(row, currentKey)) {
    // should not happen
    return "-";
  }

  const hasBase = Object.hasOwn(row, baseKey);
  const hasCurrent = Object.hasOwn(row, currentKey);
  const [baseValue, baseGrayOut] = toRenderedValue(
    row,
    `base__${column.key}`,
    columnType,
    columnRenderMode,
  );
  const [currentValue, currentGrayOut] = toRenderedValue(
    row,
    `current__${column.key}`,
    columnType,
    columnRenderMode,
  );

  if (row[baseKey] === row[currentKey]) {
    // no change
    return <Text style={{ color: currentGrayOut ? "gray" : "inherit" }}>{currentValue}</Text>;
  }

  return (
    <Flex gap="5px" alignItems="center" lineHeight="normal" height="100%">
      {hasBase && <DiffText value={baseValue} colorPalette="red" grayOut={baseGrayOut} />}
      {hasCurrent && (
        <DiffText value={currentValue} colorPalette="green" grayOut={currentGrayOut} />
      )}
    </Flex>
  );
};

export function toDataDiffGrid(
  _base?: DataFrame,
  _current?: DataFrame,
  options?: QueryDataDiffGridOptions,
) {
  const base = _base ?? { columns: [], data: [] };
  const current = _current ?? { columns: [], data: [] };
  const primaryKeys = options?.primaryKeys ?? [];
  const pinnedColumns = options?.pinnedColumns ?? [];
  const changedOnly = options?.changedOnly ?? false;
  const displayMode = options?.displayMode ?? "side_by_side";
  const columnsRenderMode = options?.columnsRenderMode ?? {};

  const columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[] = [];
  const columnMap = _getColumnMap(base, current);

  // merge row
  const baseMap: Record<string, any> = {};
  const currentMap: Record<string, any> = {};
  let invalidPKeyBase = false;
  let invalidPKeyCurrent = false;

  if (primaryKeys.length === 0) {
    base.data.forEach((row, index) => {
      const row_data = row as any;
      row_data._index = index + 1;
      baseMap[JSON.stringify({ _index: index + 1 })] = row;
    });

    current.data.forEach((row, index) => {
      const row_data = row as any;
      row_data._index = index + 1;
      currentMap[JSON.stringify({ _index: index + 1 })] = row;
    });
  } else {
    let primaryIndexes = _getPrimaryKeyIndexes(base.columns, primaryKeys);

    base.data.forEach((row, index) => {
      const key = _getPrimaryKeyValue(base.columns, primaryIndexes, row);
      if (key in baseMap) {
        invalidPKeyBase = true;
      }
      baseMap[key] = row;
    });

    primaryIndexes = _getPrimaryKeyIndexes(current.columns, primaryKeys);
    current.data.forEach((row, index) => {
      const key = _getPrimaryKeyValue(current.columns, primaryIndexes, row);
      if (key in currentMap) {
        invalidPKeyCurrent = true;
      }
      currentMap[key] = row;
    });
  }

  const mergedMap = mergeKeysWithStatus(Object.keys(baseMap), Object.keys(currentMap));

  const rowStats = {
    added: 0,
    removed: 0,
    modified: 0,
  };

  let rows = Object.entries(mergedMap).map(([key, status]) => {
    const baseRow = baseMap[key] as RowObjectType | undefined;
    const currentRow = currentMap[key] as RowObjectType | undefined;
    const row = JSON.parse(key) as RowObjectType;

    if (baseRow) {
      base.columns.forEach((col, index) => {
        if (primaryKeys.includes(col.name)) {
          return;
        }
        row[`base__${col.name}`] = baseRow[index];
      });
    }

    if (currentRow) {
      current.columns.forEach((col, index) => {
        if (primaryKeys.includes(col.name)) {
          return;
        }
        row[`current__${col.name}`] = currentRow[index];
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
      for (const [name, mergedColumn] of Object.entries(columnMap)) {
        if (name === "index") {
          continue;
        }

        if (primaryKeys.includes(name)) {
          continue;
        }

        if (mergedColumn.baseColumnIndex < 0 || mergedColumn.currentColumnIndex < 0) {
          continue;
        }

        if (
          !_.isEqual(
            baseRow[mergedColumn.baseColumnIndex],
            currentRow[mergedColumn.currentColumnIndex],
          )
        ) {
          row.__status = "modified";
          mergedColumn.status = "modified";
        }
      }
      if (row.__status === "modified") {
        rowStats.modified++;
      }
    }

    return row;
  });

  if (changedOnly) {
    rows = rows.filter(
      (row) =>
        row.__status === "added" || row.__status === "removed" || row.__status === "modified",
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
  if (primaryKeys.length === 0) {
    columns.push({
      key: "_index",
      width: 50,
      maxWidth: 100,
      name: "",
      cellClass: "index-column",
    });
  } else {
    primaryKeys.forEach((name) => {
      const columnStatus = columnMap[name].status ?? "";
      const columnType = columnMap[name].colType;

      columns.push({
        key: name,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            columnStatus={columnStatus}
            columnType={columnType}
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
  }

  // merges columns: pinned columns
  pinnedColumns.forEach((name) => {
    const columnStatus = columnMap[name].status ?? "";
    const columnType = columnMap[name].colType;

    if (name === "index") {
      return;
    }

    if (primaryKeys.includes(name)) {
      return;
    }

    columns.push(toColumn(name, columnStatus, columnType, columnsRenderMode[name]));
  });

  // merges columns: other columns
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status ?? "";
    const columnType = columnMap[name].colType;

    if (name === "index") {
      return;
    }

    if (primaryKeys.includes(name)) {
      return;
    }

    if (pinnedColumns.includes(name)) {
      return;
    }

    if (changedOnly && rowStats.modified > 0) {
      if (columnStatus !== "added" && columnStatus !== "removed" && columnStatus !== "modified") {
        return;
      }
    }
    columns.push(toColumn(name, columnStatus, columnType, columnsRenderMode[name]));
  });

  return {
    columns,
    rows,
    invalidPKeyBase,
    invalidPKeyCurrent,
  };
}
