import { ColumnOrColumnGroup, textEditor } from "react-data-grid";
import _ from "lodash";
import "./styles.css";
import { Box, Flex, Icon } from "@chakra-ui/react";
import { VscClose, VscKey } from "react-icons/vsc";

interface DataFrameField {
  name: string;
  type: string;
}

type DataFrameRow = Record<string, any>;

export interface DataFrame {
  schema: {
    fields: Array<DataFrameField>;
    primaryKey: string[];
  };
  pandas_version?: string;
  data: Array<DataFrameRow>;
}

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

export function toDataGrid(
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
  const columnMap: Record<
    string,
    { base?: DataFrameField; current?: DataFrameField }
  > = {};
  const rowMap: Record<any, { base?: DataFrameRow; current?: DataFrameRow }> =
    {};

  current.schema.fields.forEach((field) => {
    columnMap[field.name] = {};
    columnMap[field.name].current = field;
  });

  base.schema.fields.forEach((field) => {
    if (!columnMap[field.name]) {
      columnMap[field.name] = {};
    }
    columnMap[field.name].base = field;
  });

  Object.entries(columnMap).forEach(([name, { base, current }]) => {
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
      });
    } else {
      if (name === "index") {
        return;
      }

      const cellClass = (row: any) => {
        if (!_.isEqual(row[`base__${name}`], row[`current__${name}`])) {
          return "diff-cell";
        }

        return undefined;
      };

      columns.push({
        name: (
          <DataFrameColumnGroupHeader
            name={name}
            primaryKeys={primaryKeys}
            onPrimaryKeyChange={onPrimaryKeyChange}
          ></DataFrameColumnGroupHeader>
        ),
        children: [
          {
            key: `base__${name}`,
            name: "Base",
            renderEditCell: textEditor,
            cellClass,
          },
          {
            key: `current__${name}`,
            name: "Current",
            renderEditCell: textEditor,
            cellClass,
          },
        ],
      });
    }
  });

  // merge row
  current.data.forEach((row) => {
    const key = _getPrimaryKeyValue(row, primaryKeys);
    rowMap[key] = {};
    rowMap[key].current = row;
  });

  base.data.forEach((row) => {
    const key = _getPrimaryKeyValue(row, primaryKeys);
    if (!rowMap[key]) {
      rowMap[key] = {};
    }
    rowMap[key].base = row;
  });

  const rows = Object.entries(rowMap).map(([key, { base, current }]) => {
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

    return row;
  });

  return {
    columns: [...pkColumns, ...columns],
    rows,
  };
}
