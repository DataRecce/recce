import { mergeKeysWithStatus } from "@/lib/mergeKeys";

import { ColumnOrColumnGroup } from "react-data-grid";

import "./style.css";
import { NodeData } from "@/lib/api/info";
import { ColumnNameCell } from "./ColumnNameCell";

export interface SchemaDiffRow {
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
    if (row.baseIndex !== undefined && row.currentIndex !== undefined && row.reordered === true) {
      return "column-index-reordered schema-column schema-column-index";
    }
    return "schema-column schema-column-index";
  }

  function columnNameCellClass() {
    return "schema-column";
  }

  function columnTypeCellClass(row: SchemaDiffRow) {
    if (
      row.baseIndex !== undefined &&
      row.currentIndex !== undefined &&
      row.baseType !== row.currentType
    ) {
      return "column-body-type-changed schema-column";
    }
    return "schema-column";
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
export function toSingleEnvDataGrid(
  nodeColumns: NodeData["columns"] = {},
  node?: NodeData,
  cllRunningMap?: Map<string, boolean>,
) {
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
      cellClass: "column-index-normal schema-cell",
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
            cllRunning={cllRunningMap?.get(row.name) ?? false}
            singleEnv
          />
        ) : (
          row.name
        );
      },
      cellClass: "column-body-normal schema-cell",
    },
    {
      key: "type",
      name: "Type",
      resizable: true,
      cellClass: "column-body-normal schema-cell",
    },
  ];

  return { columns, rows };
}
