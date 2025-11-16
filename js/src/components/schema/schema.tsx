import { ColumnOrColumnGroup } from "react-data-grid";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";

import "./style.css";
import { NodeColumnData, NodeData } from "@/lib/api/info";
import { RowObjectType } from "@/lib/api/types";
import { ColumnNameCell } from "./ColumnNameCell";

export interface SchemaDiffRow extends RowObjectType {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}

type SchemaDiff = Record<string, SchemaDiffRow>;

export interface SchemaRow extends RowObjectType {
  name: string;
  index: number;
  type?: string;
}

export function mergeColumns(
  baseColumns: NodeData["columns"] = {},
  currentColumns: NodeData["columns"] = {},
): SchemaDiff {
  const result: SchemaDiff = {};
  const mergedStatus = mergeKeysWithStatus(
    Object.keys(baseColumns),
    Object.keys(currentColumns),
  );

  Object.entries(mergedStatus).forEach(([name, status]) => {
    result[name] = {
      name,
      reordered: status === "reordered",
      __status: undefined,
    };
  });

  let filteredIndex = 0;
  Object.entries(baseColumns).forEach(([name, column]) => {
    if (column != null) {
      result[name].baseIndex = filteredIndex += 1;
      result[name].baseType = column.type;
    }
  });

  // reset filteredIndex
  filteredIndex = 0;
  Object.entries(currentColumns).forEach(([name, column]) => {
    if (column != null) {
      result[name].currentIndex = filteredIndex += 1;
      result[name].currentType = column.type;
    }
  });

  return result;
}

export function toSchemaDataGrid(
  schemaDiff: SchemaDiff,
  node?: NodeData,
  cllRunningMap?: Map<string, boolean>,
) {
  function columnIndexCellClass(row: SchemaDiffRow) {
    if (
      row.baseIndex !== undefined &&
      row.currentIndex !== undefined &&
      row.reordered === true
    ) {
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
            row={row}
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
  // Filter out any `nodeColumns` with an undefined column
  const nodeColumnList = Object.entries(nodeColumns).filter(
    ([_, column]) => column != null,
  ) as [string, NodeColumnData][];
  const rows: SchemaRow[] = nodeColumnList.map(([name, column], index) => ({
    name,
    index: index + 1,
    type: column.type,
    __status: undefined,
  }));

  const columns: ColumnOrColumnGroup<SchemaRow>[] = [
    {
      key: "index",
      name: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: "schema-column schema-column-index",
    },
    {
      key: "name",
      name: "Name",
      resizable: true,
      renderCell: ({ row }) => {
        return node ? (
          <ColumnNameCell
            model={node}
            row={row}
            cllRunning={cllRunningMap?.get(row.name) ?? false}
            singleEnv
          />
        ) : (
          row.name
        );
      },
      cellClass: "schema-column",
    },
    {
      key: "type",
      name: "Type",
      resizable: true,
      cellClass: "schema-column",
    },
  ];

  return { columns, rows };
}
