import _ from "lodash";
import React from "react";
import {
  CalculatedColumn,
  ColumnOrColumnGroup,
  RenderCellProps,
  textEditor,
} from "react-data-grid";
import "./styles.css";
import {
  Box,
  Flex,
  Icon,
  IconButton,
  Menu,
  Portal,
  Text,
} from "@chakra-ui/react";
import {
  VscClose,
  VscKebabVertical,
  VscKey,
  VscPin,
  VscPinned,
} from "react-icons/vsc";
import { columnPrecisionSelectOptions } from "@/components/valuediff/shared";
import {
  ColumnRenderMode,
  ColumnType,
  DataFrame,
  RowObjectType,
} from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { formatNumber } from "@/utils/formatters";
import { dataFrameToRowObjects, keyToNumber } from "@/utils/transforms";
import { DiffText } from "./DiffText";

interface MergeColumnMap {
  baseColumnKey: string;
  currentColumnKey: string;
  status?: string;
  colType: ColumnType;
  key: string;
}

function _getColumnMap(
  base: DataFrame,
  current: DataFrame,
): Record<string, MergeColumnMap> {
  const result: Record<string, MergeColumnMap> = {};

  const mapStatus = mergeKeysWithStatus(
    base.columns.map((col) => col.key),
    current.columns.map((col) => col.key),
  ) as Record<string, string>;

  Object.entries(mapStatus).map(([key, status]) => {
    const baseColumn = base.columns.find((c) => c.key === key);
    const currentColumn = current.columns.find((c) => c.key === key);
    result[key] = {
      status,
      baseColumnKey: baseColumn?.key ?? "unknown",
      currentColumnKey: currentColumn?.key ?? "unknown",
      colType: base.columns.find((c) => c.key === key)?.type ?? "unknown",
      key: baseColumn?.key ?? "unknown",
    };
  });

  return result;
}

function _getPrimaryKeyKeys(
  columns: DataFrame["columns"],
  primaryKeys: string[],
): string[] {
  const keys: string[] = [];
  for (const key of primaryKeys) {
    const index = columns.findIndex((col) => col.key === key);
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
      const colOrNone = columns.find((c) => c.key === key);
      if (colOrNone == null) {
        throw new Error(`Primary Column ${key} not found`);
      }
      result.push(`${colOrNone.name}=${row[key]}`);
    }
    return result.join("|");
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
  onColumnRenderModeChanged?: (
    colNam: string,
    renderAs: ColumnRenderMode,
  ) => void;
} & QueryDataDiffGridOptions) {
  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];
  const isPK = primaryKeys.includes(name);
  const isPinned = pinnedColumns.includes(name);
  const canBePk = columnStatus !== "added" && columnStatus !== "removed";

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

  const handleRemovePk = () => {
    const newPrimaryKeys = primaryKeys.filter((item) => item !== name);

    if (onPrimaryKeyChange) {
      onPrimaryKeyChange(newPrimaryKeys);
    }
  };

  const handleAddPk = () => {
    const newPrimaryKeys = [
      ...primaryKeys.filter((item) => item !== "index"),
      name,
    ];

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
      <Box
        flex={1}
        overflow="hidden"
        textOverflow="ellipsis"
        whiteSpace="nowrap"
      >
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
    renderedValue = formatNumber(value, locale, {
      style: "percent",
      maximumFractionDigits: 2,
    });
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
      renderedValue = value;
    }
  }

  return [renderedValue, grayOut];
};

export const defaultRenderCell = ({
  row,
  column,
}: RenderCellProps<RowObjectType>) => {
  // Add the potential addition of columnType
  const { columnType, columnRenderMode } =
    column as unknown as CalculatedColumn<RowObjectType> & {
      columnType?: ColumnType;
      columnRenderMode?: ColumnRenderMode;
    };

  const [renderedValue, grayOut] = toRenderedValue(
    row,
    column.key,
    columnType,
    columnRenderMode,
  );
  return (
    <Text style={{ color: grayOut ? "gray" : "inherit" }}>{renderedValue}</Text>
  );
};

export const inlineRenderCell = ({
  row,
  column,
}: RenderCellProps<RowObjectType>) => {
  // Add the potential addition of columnType
  const { columnType, columnRenderMode } =
    column as unknown as CalculatedColumn<RowObjectType> & {
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
    return (
      <Text style={{ color: currentGrayOut ? "gray" : "inherit" }}>
        {currentValue}
      </Text>
    );
  }

  return (
    <Flex gap="5px" alignItems="center" lineHeight="normal" height="100%">
      {hasBase && (
        <DiffText value={baseValue} colorPalette="red" grayOut={baseGrayOut} />
      )}
      {hasCurrent && (
        <DiffText
          value={currentValue}
          colorPalette="green"
          grayOut={currentGrayOut}
        />
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

  const baseData = dataFrameToRowObjects(base);
  const currentData = dataFrameToRowObjects(current);

  const columns: (ColumnOrColumnGroup<RowObjectType> & {
    columnType?: ColumnType;
    columnRenderMode?: ColumnRenderMode;
  })[] = [];
  const columnMap = _getColumnMap(base, current);

  // merge row
  const baseMap: Record<string, RowObjectType> = {};
  const currentMap: Record<string, RowObjectType> = {};
  let invalidPKeyBase = false;
  let invalidPKeyCurrent = false;

  if (primaryKeys.length === 0) {
    baseData.forEach((row) => {
      baseMap[String(row._index)] = row;
    });

    currentData.forEach((row) => {
      currentMap[String(row._index)] = row;
    });
  } else {
    let primaryKeyKeys = _getPrimaryKeyKeys(base.columns, primaryKeys);

    baseData.forEach((row) => {
      const key = _getPrimaryKeyValue(base.columns, primaryKeyKeys, row);
      if (key in baseMap) {
        invalidPKeyBase = true;
      }
      baseMap[key] = row;
    });

    primaryKeyKeys = _getPrimaryKeyKeys(current.columns, primaryKeys);
    currentData.forEach((row) => {
      const key = _getPrimaryKeyValue(current.columns, primaryKeyKeys, row);
      if (key in currentMap) {
        invalidPKeyCurrent = true;
      }
      currentMap[key] = row;
    });
  }

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
    const baseRow = baseMap[key] as RowObjectType | undefined;
    const currentRow = currentMap[key] as RowObjectType | undefined;
    const row: RowObjectType = {
      _index: keyToNumber(key),
      __status: undefined,
    };

    if (baseRow) {
      base.columns.forEach((col) => {
        if (primaryKeys.includes(col.key)) {
          // add the primary key value directly (not prefixed with base__ or current__)
          row[col.key] = baseRow[col.key];
          return;
        }
        row[`base__${col.key}`] = baseRow[col.key];
      });
    }

    if (currentRow) {
      current.columns.forEach((col) => {
        if (primaryKeys.includes(col.key)) {
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
      for (const [name, mergedColumn] of Object.entries(columnMap)) {
        if (name === "index") {
          continue;
        }

        if (primaryKeys.includes(name)) {
          continue;
        }

        if (
          mergedColumn.baseColumnKey === "unknown" ||
          mergedColumn.currentColumnKey === "unknown"
        ) {
          continue;
        }

        if (
          !_.isEqual(
            baseRow[mergedColumn.baseColumnKey],
            currentRow[mergedColumn.currentColumnKey],
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

    columns.push(
      toColumn(name, columnStatus, columnType, columnsRenderMode[name]),
    );
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
      if (
        columnStatus !== "added" &&
        columnStatus !== "removed" &&
        columnStatus !== "modified"
      ) {
        return;
      }
    }
    columns.push(
      toColumn(name, columnStatus, columnType, columnsRenderMode[name]),
    );
  });

  return {
    columns,
    rows,
    invalidPKeyBase,
    invalidPKeyCurrent,
  };
}
