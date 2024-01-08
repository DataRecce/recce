import { ColumnOrColumnGroup, textEditor } from "react-data-grid";
import _ from "lodash";
import "./styles.css";
import { Box, Flex, Icon } from "@chakra-ui/react";
import { VscClose, VscKey } from "react-icons/vsc";
import { DataFrame, DataFrameField, DataFrameRow } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";

function _getPrimaryKeyValue(row: DataFrameRow, primaryKeys: string[]): string {
  const result: Record<string, any> = {};
  for (const key of primaryKeys) {
    result[key] = row[key];
  }
  return JSON.stringify(result);
}

interface DataFrameColumnGroupHeaderProps {
  name: string;
  primaryKeys: string[];
  onPrimaryKeyChange?: (primaryKeys: string[]) => void;
}

function DataFrameColumnGroupHeader({
  name,
  primaryKeys,
  onPrimaryKeyChange,
}: DataFrameColumnGroupHeaderProps) {
  if (name === "index") {
    return <></>;
  }

  if (primaryKeys.includes(name)) {
    return (
      <Flex alignItems="center">
        <Box flex={1}>{name}</Box>
        {onPrimaryKeyChange && (
          <Icon
            cursor="pointer"
            as={VscClose}
            onClick={() => {
              const newPrimaryKeys = primaryKeys.filter(
                (item) => item !== name
              );

              onPrimaryKeyChange(newPrimaryKeys);
            }}
          />
        )}
      </Flex>
    );
  } else {
    return (
      <Flex alignItems="center">
        <Box flex={1}>{name}</Box>
        {onPrimaryKeyChange && (
          <Icon
            cursor="pointer"
            as={VscKey}
            onClick={() => {
              const newPrimaryKeys = [
                ...primaryKeys.filter((item) => item !== "index"),
                name,
              ];

              onPrimaryKeyChange(newPrimaryKeys);
            }}
          />
        )}
      </Flex>
    );
  }
}

export function toDataDiffGrid(
  base?: DataFrame,
  current?: DataFrame,
  primaryKeys: string[] = [],
  onPrimaryKeyChange?: (primaryKeys: string[]) => void
) {
  const empty: DataFrame = {
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
  const pkColumns: ColumnOrColumnGroup<any, any>[] = [];
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

  const rows = Object.entries(mergedMap)
    .map(([key, status]) => {
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
    })
    .filter(
      (row) =>
        row["status"] === "added" ||
        row["status"] === "removed" ||
        row["status"] === "modified"
    );

  // merge columns
  Object.entries(columnMap).forEach(([name, columnStatus]) => {
    if (primaryKeys.includes(name)) {
      pkColumns.push({
        key: `${name}`,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            primaryKeys={primaryKeys}
            onPrimaryKeyChange={onPrimaryKeyChange}
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
    } else {
      if (name === "index") {
        return;
      }

      if (
        columnStatus !== "added" &&
        columnStatus !== "removed" &&
        columnStatus !== "modified"
      ) {
        return;
      }

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

      const canBePk = columnStatus !== "added" && columnStatus !== "removed";

      columns.push({
        headerCellClass,
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            primaryKeys={primaryKeys}
            onPrimaryKeyChange={canBePk ? onPrimaryKeyChange : undefined}
          ></DataFrameColumnGroupHeader>
        ),
        children: [
          {
            key: `base__${name}`,
            name: "Base",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass,
          },
          {
            key: `current__${name}`,
            name: "Current",
            renderEditCell: textEditor,
            headerCellClass,
            cellClass,
          },
        ],
      });
    }
  });

  return {
    columns: [...pkColumns, ...columns],
    rows,
  };
}
