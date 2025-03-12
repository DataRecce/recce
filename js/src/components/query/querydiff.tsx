import { ColumnOrColumnGroup, RenderCellProps, textEditor } from "react-data-grid";
import _ from "lodash";
import "./styles.css";
import {
  Badge,
  Box,
  Center,
  Flex,
  Icon,
  IconButton,
  Text,
  Tooltip,
  useClipboard,
} from "@chakra-ui/react";
import { VscClose, VscKey, VscPin, VscPinned } from "react-icons/vsc";
import { DataFrame } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { CopyIcon } from "@chakra-ui/icons";
import { useState } from "react";
import { string } from "node_modules/yaml/dist/schema/common/string";

function _getColumnMap(base: DataFrame, current: DataFrame) {
  const result: Record<
    string,
    {
      baseColumnIndex: number;
      currentColumnIndex: number;
      status?: string;
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
  changedOnly?: boolean;
  baseTitle?: string;
  currentTitle?: string;
  displayMode?: "side_by_side" | "inline";
}

function DataFrameColumnGroupHeader({
  name,
  columnStatus,
  onPrimaryKeyChange,
  onPinnedColumnsChange,
  ...options
}: { name: string; columnStatus: string } & QueryDataDiffGridOptions) {
  const primaryKeys = options.primaryKeys || [];
  const pinnedColumns = options.pinnedColumns || [];
  const isPK = primaryKeys.includes(name);
  const isPinned = pinnedColumns.includes(name);
  const canBePk = columnStatus !== "added" && columnStatus !== "removed";

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
    </Flex>
  );
}

const toRenderedValue = (row: any, key: string): [any, boolean] => {
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
  } else {
    // convert to string
    renderedValue = value;
  }

  return [renderedValue, grayOut];
};

export const defaultRenderCell = ({ row, column }: RenderCellProps<any, any>) => {
  const [renderedValue, grayOut] = toRenderedValue(row, column.key);
  return <Text style={{ color: grayOut ? "gray" : "inherit" }}>{renderedValue}</Text>;
};

interface CopyableBadgeProps {
  value: string;
  colorScheme: string;
  grayOut?: boolean;
  noCopy?: boolean;
  fontSize?: string;
}

export const DiffText = ({ value, colorScheme, grayOut, noCopy, fontSize }: CopyableBadgeProps) => {
  const { onCopy, hasCopied } = useClipboard(value);
  const [isHovered, setIsHovered] = useState(false);

  const CopyControl = () => {
    if (noCopy || grayOut) {
      return <></>;
    }

    if (hasCopied) {
      return <>Copied</>;
    }

    if (!isHovered) {
      return <></>;
    }

    return (
      <IconButton
        aria-label="Copy"
        icon={<CopyIcon boxSize="10px" />}
        size="xs"
        minW="10px"
        h="10px"
        variant="unstyled"
        onClick={onCopy}
        display="flex"
        alignItems="center"
        justifyContent="center"
      />
    );
  };

  return (
    <Flex
      p="2px 5px"
      minWidth="30px"
      maxWidth="200px"
      overflow="hidden"
      textOverflow="ellipsis"
      color={`${colorScheme}.800`}
      backgroundColor={`${colorScheme}.100`}
      alignItems="center"
      gap="2px"
      rounded="md"
      fontSize={fontSize}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}>
      <Box overflow="hidden" textOverflow="ellipsis" color={grayOut ? "gray" : "inherit"}>
        {value}
      </Box>

      <CopyControl />
    </Flex>
  );
};

export const inlineRenderCell = ({ row, column }: RenderCellProps<any, any>) => {
  const baseKey = `base__${column.key}`;
  const currentKey = `current__${column.key}`;

  if (!Object.hasOwn(row, baseKey) && !Object.hasOwn(row, currentKey)) {
    // should not happen
    return "-";
  }

  const hasBase = Object.hasOwn(row, baseKey);
  const hasCurrent = Object.hasOwn(row, currentKey);
  const [baseValue, baseGrayOut] = toRenderedValue(row, `base__${column.key}`);
  const [currentValue, currentGrayOut] = toRenderedValue(row, `current__${column.key}`);

  if (row[baseKey] === row[currentKey]) {
    // no change
    return <Text style={{ color: currentGrayOut ? "gray" : "inherit" }}>{currentValue}</Text>;
  }

  return (
    <Flex gap="5px" alignItems="center" lineHeight="normal" height="100%">
      {hasBase && <DiffText value={baseValue} colorScheme="red" grayOut={baseGrayOut} />}
      {hasCurrent && <DiffText value={currentValue} colorScheme="green" grayOut={currentGrayOut} />}
    </Flex>
  );
};

export function toDataDiffGrid(
  _base?: DataFrame,
  _current?: DataFrame,
  options?: QueryDataDiffGridOptions,
) {
  const base = _base || { columns: [], data: [] };
  const current = _current || { columns: [], data: [] };
  const primaryKeys = options?.primaryKeys || [];
  const pinnedColumns = options?.pinnedColumns || [];
  const changedOnly = options?.changedOnly || false;
  const displayMode = options?.displayMode || "side_by_side";

  const columns: ColumnOrColumnGroup<any, any>[] = [];
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
    const baseRow = baseMap[key];
    const currentRow = currentMap[key];
    const row = JSON.parse(key);

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
  const toColumn = (name: string, columnStatus: string) => {
    const headerCellClass =
      columnStatus === "added"
        ? "diff-header-added"
        : columnStatus === "removed"
          ? "diff-header-removed"
          : undefined;

    const cellClass = (row: any) => {
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
        return "diff-cell-modified";
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
            {...options}></DataFrameColumnGroupHeader>
        ),
        key: name,
        renderCell: inlineRenderCell,
        size: "auto",
      };
    } else {
      return {
        headerCellClass,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            columnStatus={columnStatus}
            {...options}></DataFrameColumnGroupHeader>
        ),
        children: [
          {
            key: `base__${name}`,
            name: options?.baseTitle || "Base",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass,
            renderCell: defaultRenderCell,
            size: "auto",
          },
          {
            key: `current__${name}`,
            name: options?.currentTitle || "Current",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass,
            renderCell: defaultRenderCell,
            size: "auto",
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
      const columnStatus = columnMap[name].status || "";
      columns.push({
        key: name,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            columnStatus={columnStatus}
            {...options}></DataFrameColumnGroupHeader>
        ),
        frozen: true,
        cellClass: (row: any) => {
          if (row.__status) {
            return `diff-header-${row.__status}`;
          }
          return undefined;
        },
        renderCell: defaultRenderCell,
      });
    });
  }

  // merges columns: pinned columns
  pinnedColumns.forEach((name) => {
    const columnStatus = columnMap[name].status || "";

    if (name === "index") {
      return;
    }

    if (primaryKeys.includes(name)) {
      return;
    }

    columns.push(toColumn(name, columnStatus));
  });

  // merges columns: other columns
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status || "";

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
    columns.push(toColumn(name, columnStatus));
  });

  return {
    columns,
    rows,
    invalidPKeyBase,
    invalidPKeyCurrent,
  };
}
