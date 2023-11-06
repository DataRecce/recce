import { ColumnOrColumnGroup } from "react-data-grid";
import _ from "lodash";

interface DataFrameField {
  name: string;
  type: string;
}

type DataFrameRow = Record<string, any>;

interface DataFrame {
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

export function queryDiff(base: DataFrame, current: DataFrame) {
  const columns: ColumnOrColumnGroup<any, any>[] = [];
  const pkColumns: ColumnOrColumnGroup<any, any>[] = [];
  const columnMap: Record<
    string,
    { base?: DataFrameField; current?: DataFrameField }
  > = {};
  const rowMap: Record<any, { base?: DataFrameRow; current?: DataFrameRow }> =
    {};

  if (!_.isEqual(base.schema.primaryKey, current.schema.primaryKey)) {
    throw new Error(
      `primary key mismatch! ${base.schema.primaryKey} != ${current.schema.primaryKey}`
    );
  }
  const primaryKeys = base.schema.primaryKey;

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
        name: name,
      });
    } else {
      columns.push({
        name: name,
        children: [
          {
            key: `base__${name}`,
            name: "Base",
          },
          {
            key: `current__${name}`,
            name: "Current",
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

  // return base;
}
