import { mergeKeysWithStatus } from "@/lib/mergeKeys";

import { ColumnOrColumnGroup } from "react-data-grid";

import "./style.css";
import { NodeData } from "@/lib/api/info";
import { ColumnNameCell } from "./ColumnNameCell";

interface SchemaDiffRow {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}

type SchemaDiff = Record<string, SchemaDiffRow>;

interface SchemaRow {
  name: string;
  index: number;
  type?: string;
}

export function mergeColumns(
  baseColumns: NodeData["columns"] = {},
  currentColumns: NodeData["columns"] = {},
): SchemaDiff {
  const result: SchemaDiff = {};
  const mergedStatus = mergeKeysWithStatus(Object.keys(baseColumns), Object.keys(currentColumns));

  Object.entries(mergedStatus).forEach(([name, status]) => {
    result[name] = {
      name,
      reordered: status === "reordered",
    };
  });

  Object.entries(baseColumns).map(([name, column], index) => {
    result[name].baseIndex = index + 1;
    result[name].baseType = column.type;
  });

  Object.entries(currentColumns).map(([name, column], index) => {
    result[name].currentIndex = index + 1;
    result[name].currentType = column.type;
  });

  return result;
}

export function toDataGrid(
  schemaDiff: SchemaDiff,
  node?: NodeData,
  cllRunningMap?: Map<string, boolean>,
) {
  function columnIndexCellClass(row: SchemaDiffRow) {
    let className = "";
    if (row.baseIndex === undefined) {
      className = "column-index-added";
    } else if (row.currentIndex === undefined) {
      className = "column-index-removed";
    } else if (row.reordered === true) {
      className = "column-index-reordered";
    } else {
      className = "column-index-normal";
    }
    return className + " schema-cell";
  }

  function columnNameCellClass(row: SchemaDiffRow) {
    let className = "";
    if (row.baseIndex === undefined) {
      className = "column-body-added";
    } else if (row.currentIndex === undefined) {
      className = "column-body-removed";
    } else if (row.reordered === true) {
      className = "column-body-reordered";
    } else {
      className = "column-body-normal";
    }
    return className + " schema-cell";
  }

  function columnTypeCellClass(row: SchemaDiffRow) {
    let className = "";
    if (row.baseIndex === undefined) {
      className = "column-body-added";
    } else if (row.currentIndex === undefined) {
      className = "column-body-removed";
    } else if (row.baseType !== row.currentType) {
      className = "column-body-type-changed";
    } else if (row.reordered === true) {
      className = "column-body-reordered";
    } else {
      className = "column-body-normal";
    }
    return className + " schema-cell";
  }

  const columns: ColumnOrColumnGroup<SchemaDiffRow>[] = [
    {
      key: "baseIndex",
      name: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: columnIndexCellClass,
      // colSpan: (args) => (args.type === "HEADER" ? 2 : 1),
    },
    {
      key: "currentIndex",
      name: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: columnIndexCellClass,

      // colSpan: (args) => (args.type === "HEADER" ? 2 : 1),
    },
    {
      key: "name",
      name: "Name",
      resizable: true,
      renderCell: ({ row, column }) => {
        return node ? (
          <ColumnNameCell
            model={node}
            name={row.name}
            baseType={row.baseType}
            currentType={row.currentType}
            cllRunning={cllRunningMap?.get(row.name) ?? false}
          />
        ) : (
          row.name
        );
      },
      cellClass: columnNameCellClass,
    },
    {
      key: "baseType",
      name: "Base Type",
      resizable: true,
      cellClass: columnTypeCellClass,
    },
    {
      key: "currentType",
      name: "Current Type",
      resizable: true,
      cellClass: columnTypeCellClass,
    },
  ];
  const rows = Object.values(schemaDiff);

  return { columns, rows };
}
export function toSingleEnvDataGrid(nodeColumns: NodeData["columns"] = {}, node?: NodeData) {
  const rows: SchemaRow[] = Object.entries(nodeColumns).map(([name, column], index) => ({
    name,
    index: index + 1,
    type: column.type,
  }));

  const columns: ColumnOrColumnGroup<SchemaRow>[] = [
    {
      key: "index",
      name: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: "column-index-normal",
    },
    {
      key: "name",
      name: "Name",
      resizable: true,
      renderCell: ({ row, column }) => {
        return node ? <ColumnNameCell model={node} name={row.name} singleEnv /> : row.name;
      },
      cellClass: "column-body-normal",
    },
    {
      key: "type",
      name: "Type",
      resizable: true,
      cellClass: "column-body-normal",
    },
  ];

  return { columns, rows };
}
