import {
  ColumnOrColumnGroup,
  RenderCellProps,
  textEditor,
} from "react-data-grid";
import _ from "lodash";
import "./styles.css";
import { Box, Flex, Icon } from "@chakra-ui/react";
import { VscClose, VscKey, VscPin, VscPinned } from "react-icons/vsc";
import { PandasDataFrame, PandasDataFrameRow } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";

function _getPrimaryKeyValue(
  row: PandasDataFrameRow,
  primaryKeys: string[]
): string {
  const result: Record<string, any> = {};
  for (const key of primaryKeys) {
    result[key] = row[key];
  }
  return JSON.stringify(result);
}

interface QueryDataDiffGridOptions {
  primaryKeys?: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
  pinnedColumns?: string[];
  onPinnedColumnsChange?: (pinnedColumns: string[]) => void;
  changedOnly?: boolean;
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
    </Flex>
  );
}

export const defaultRenderCell = ({
  row,
  column,
}: RenderCellProps<any, any>) => {
  // workaround for https://github.com/adazzle/react-data-grid/issues/882
  const value = row[column.key];
  return <>{typeof value === "boolean" ? value.toString() : value}</>;
};

export function toDataDiffGrid(
  base?: PandasDataFrame,
  current?: PandasDataFrame,
  options?: QueryDataDiffGridOptions
) {
  let primaryKeys = options?.primaryKeys || [];
  const pinnedColumns = options?.pinnedColumns || [];
  const changedOnly = options?.changedOnly || false;

  const empty: PandasDataFrame = {
    schema: {
      fields: [],
      primaryKey: [],
    },
    data: [],
  };

  if (!base && current) {
    base = empty;

    if (primaryKeys.length === 0) {
      primaryKeys = current.schema.primaryKey;
    }
  } else if (!current && base) {
    current = empty;

    if (primaryKeys.length === 0) {
      primaryKeys = base.schema.primaryKey;
    }
  } else if (base && current) {
    if (!_.isEqual(base.schema.primaryKey, current.schema.primaryKey)) {
      throw new Error(
        `primary key mismatch! ${base.schema.primaryKey} != ${current.schema.primaryKey}`
      );
    }

    if (primaryKeys.length === 0) {
      primaryKeys = base.schema.primaryKey;
    }
  } else {
    return { rows: [], columns: [] };
  }

  const columns: ColumnOrColumnGroup<any, any>[] = [];
  const columnMap = mergeKeysWithStatus(
    base.schema.fields.map((field) => field.name),
    current.schema.fields.map((field) => field.name)
  ) as Record<string, string>;

  // merge row
  const baseMap: Record<string, any> = {};
  base.data.forEach((row) => {
    baseMap[_getPrimaryKeyValue(row, primaryKeys)] = row;
  });

  const currentMap: Record<string, any> = {};
  current.data.forEach((row) => {
    currentMap[_getPrimaryKeyValue(row, primaryKeys)] = row;
  });

  const mergedMap = mergeKeysWithStatus(
    Object.keys(baseMap),
    Object.keys(currentMap)
  );

  let rows = Object.entries(mergedMap).map(([key, status]) => {
    const base = baseMap[key];
    const current = currentMap[key];
    const row = JSON.parse(key);

    if (base) {
      Object.keys(base).forEach((key) => {
        if (primaryKeys.includes(key)) {
          return;
        }
        row[`base__${key}`] = base[key];
      });
    }

    if (current) {
      Object.keys(current).forEach((key) => {
        if (primaryKeys.includes(key)) {
          return;
        }

        row[`current__${key}`] = current[key];
      });
    }

    // Check if row is added, removed, or modified
    if (!base) {
      row["status"] = "added";
    } else if (!current) {
      row["status"] = "removed";
    } else {
      for (const [column, columnStatus] of Object.entries(columnMap)) {
        if (column === "index") {
          continue;
        }

        if (primaryKeys.includes(column)) {
          continue;
        }

        if (columnStatus === "added" || columnStatus === "removed") {
          continue;
        }

        if (!_.isEqual(base[column], current[column])) {
          row["status"] = "modified";
          columnMap[column] = "modified";
        }
      }
    }

    return row;
  });

  if (changedOnly) {
    rows = rows.filter(
      (row) =>
        row["status"] === "added" ||
        row["status"] === "removed" ||
        row["status"] === "modified"
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
      const rowStatus = row["status"];
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

    return {
      headerCellClass,
      name: (
        <DataFrameColumnGroupHeader
          name={name}
          columnStatus={columnStatus}
          {...options}
        ></DataFrameColumnGroupHeader>
      ),
      children: [
        {
          key: `base__${name}`,
          name: "Base",
          renderEditCell: textEditor,
          headerCellClass,
          cellClass,
          renderCell: defaultRenderCell,
          size: "auto",
        },
        {
          key: `current__${name}`,
          name: "Current",
          renderEditCell: textEditor,
          headerCellClass,
          cellClass,
          renderCell: defaultRenderCell,
          size: "auto",
        },
      ],
    };
  };

  // merges columns: primary keys
  primaryKeys.forEach((name) => {
    const columnStatus = columnMap[name];

    if (!primaryKeys.includes(name)) {
      return;
    }

    columns.push({
      key: `${name}`,
      name: (
        <DataFrameColumnGroupHeader
          name={name}
          columnStatus={columnStatus}
          {...options}
        ></DataFrameColumnGroupHeader>
      ),
      frozen: true,
      cellClass: (row: any) => {
        if (name === "index") {
          return "index-column";
        }

        if (row["status"]) {
          return `diff-header-${row["status"]}`;
        }

        return undefined;
      },
    });
  });

  // merges columns: pinned columns
  pinnedColumns.forEach((name) => {
    const columnStatus = columnMap[name];

    if (name === "index") {
      return;
    }

    if (primaryKeys.includes(name)) {
      return;
    }

    columns.push(toColumn(name, columnStatus));
  });

  // merges columns: other columns
  Object.entries(columnMap).forEach(([name, columnStatus]) => {
    if (name === "index") {
      return;
    }

    if (primaryKeys.includes(name)) {
      return;
    }

    if (pinnedColumns.includes(name)) {
      return;
    }

    if (changedOnly) {
      if (
        columnStatus !== "added" &&
        columnStatus !== "removed" &&
        columnStatus !== "modified"
      ) {
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
