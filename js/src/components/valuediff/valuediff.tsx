import { ColumnOrColumnGroup, RenderCellProps, textEditor } from "react-data-grid";
import _ from "lodash";
import "../query/styles.css";
import { Box, Flex, Icon } from "@chakra-ui/react";
import { VscKey, VscPin, VscPinned } from "react-icons/vsc";
import { DataFrame } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { defaultRenderCell, inlineRenderCell, QueryDataDiffGridOptions } from "../query/querydiff";

function _getColumnMap(df: DataFrame) {
  const result: Record<
    string,
    {
      index: number;
      status?: string;
    }
  > = {};

  df.columns.map((col, index) => {
    result[col.name] = {
      index,
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

function DataFrameColumnGroupHeader({
  name,
  columnStatus,
  onPrimaryKeyChange,
  onPinnedColumnsChange,
  ...options
}: { name: string; columnStatus: string } & QueryDataDiffGridOptions) {
  const primaryKeys = options.primaryKeys ?? [];
  const pinnedColumns = options.pinnedColumns ?? [];
  const isPK = primaryKeys.includes(name);
  const isPinned = pinnedColumns.includes(name);

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
      <Box flex={1} overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
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

  const columns: ColumnOrColumnGroup<any, any>[] = [];
  const columnMap = _getColumnMap(df);

  // merge row
  const baseMap: Record<string, any> = {};
  const currentMap: Record<string, any> = {};
  if (primaryKeys.length === 0) {
    throw new Error("Primary keys are required");
  }

  const primaryIndexes = _getPrimaryKeyIndexes(df.columns, primaryKeys);
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const inBaseIndex = (columnMap.in_a || columnMap.IN_A).index;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const inCurrentIndex = (columnMap.in_b || columnMap.IN_B).index;

  df.data.forEach((row, index) => {
    const key = _getPrimaryKeyValue(df.columns, primaryIndexes, row);
    if (row[inBaseIndex]) {
      baseMap[key] = row;
    }

    if (row[inCurrentIndex]) {
      currentMap[key] = row;
    }
  });

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
      df.columns.forEach((col, index) => {
        if (primaryKeys.includes(col.name)) {
          return;
        }
        row[`base__${col.name}`] = baseRow[index];
      });
    }

    if (currentRow) {
      df.columns.forEach((col, index) => {
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
      for (const [name, column] of Object.entries(columnMap)) {
        if (name === "index") {
          continue;
        }

        if (primaryKeys.includes(name)) {
          continue;
        }

        if (!_.isEqual(baseRow[column.index], currentRow[column.index])) {
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

    const cellClassBase = (row: any) => {
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

    const cellClassCurrent = (row: any) => {
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
            primaryKeys={primaryKeys}
            {...options}></DataFrameColumnGroupHeader>
        ),
        children: [
          {
            key: `base__${name}`,
            name: options?.baseTitle ?? "Base",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass: cellClassBase,
            renderCell: defaultRenderCell,
            size: "auto",
          },
          {
            key: `current__${name}`,
            name: options?.currentTitle ?? "Current",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass: cellClassCurrent,
            renderCell: defaultRenderCell,
            size: "auto",
          },
        ],
      };
    }
  };

  // merges columns: primary keys
  primaryKeys.forEach((name) => {
    const columnStatus = columnMap[name].status ?? "";
    columns.push({
      key: name,
      name: (
        <DataFrameColumnGroupHeader
          name={name}
          columnStatus={columnStatus}
          primaryKeys={primaryKeys}
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

  // merges columns: pinned columns
  pinnedColumns.forEach((name) => {
    const columnStatus = columnMap[name].status ?? "";

    if (primaryKeys.includes(name)) {
      return;
    }

    columns.push(toColumn(name, columnStatus));
  });

  // merges columns: other columns
  Object.entries(columnMap).forEach(([name, mergedColumn]) => {
    const columnStatus = mergedColumn.status ?? "";

    if (name === "in_a" || name === "in_b") {
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
  };
}
