import "react-data-grid/lib/styles.css";
import DataGrid, { ColumnOrColumnGroup, textEditor } from "react-data-grid";
import { DataFrame, DataFrameField, DataFrameRow } from "@/lib/api/types";
import _ from "lodash";

function _getPrimaryKeyValue(row: DataFrameRow, primaryKey: string): string {
  const result: Record<string, any> = {};
  result[primaryKey] = row[primaryKey];
  return JSON.stringify(result);
}

export function toDataDiffGrid(base?: DataFrame, current?: DataFrame) {
  // primary key: "column_name" is per dbt_profiler package design
  const primaryKey: string = "column_name";
  const empty: DataFrame = {
    schema: {
      fields: [],
      primaryKey: [],
    },
    data: [],
  };

  if (!base && current) {
    base = empty;
  } else if (!current && base) {
    current = empty;
  } else if (base && current) {
    // do nothing
  } else {
    return { rows: [], columns: [] };
  }

  const columns: ColumnOrColumnGroup<any, any>[] = [];
  const pkColumn: ColumnOrColumnGroup<any, any> = {
    key: primaryKey,
    name: primaryKey,
    frozen: true,
  };

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

  Object.keys(columnMap).forEach((name) => {
    if (name === "index" || name === primaryKey || name === "profiled_at") {
      return;
    }

    const cellClass = (row: any) => {
      if (!_.isEqual(row[`base__${name}`], row[`current__${name}`])) {
        return "diff-cell-modified";
      }

      return undefined;
    };

    columns.push({
      name: name,
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
  });

  // merge row
  current.data.forEach((row) => {
    const key = _getPrimaryKeyValue(row, primaryKey);
    rowMap[key] = {};
    rowMap[key].current = row;
  });

  base.data.forEach((row) => {
    const key = _getPrimaryKeyValue(row, primaryKey);
    if (!rowMap[key]) {
      rowMap[key] = {};
    }
    rowMap[key].base = row;
  });

  const rows = Object.entries(rowMap).map(([key, { base, current }]) => {
    const row = JSON.parse(key);

    if (base) {
      Object.keys(base).forEach((key) => {
        if (key === primaryKey) {
          return;
        }
        row[`base__${key}`] =
          typeof base[key] === "boolean" ? base[key].toString() : base[key];
      });
    }

    if (current) {
      Object.keys(current).forEach((key) => {
        if (key === primaryKey) {
          return;
        }

        row[`current__${key}`] =
          typeof current[key] === "boolean"
            ? current[key].toString()
            : current[key];
      });
    }

    return row;
  });

  return {
    columns: [pkColumn, ...columns],
    rows,
  };
}
