import { mergeKeysWithStatus } from "@/lib/mergeKeys";
import { NodeData } from "../lineage/lineage";
import { Column, ColumnOrColumnGroup, RenderCellProps } from "react-data-grid";

import "./style.css";

interface SchemaDiffRow {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}

interface SchemaDiff {
  [key: string]: SchemaDiffRow;
}

export function mergeColumns(
  baseColumns: NodeData["columns"] = {},
  currentColumns: NodeData["columns"] = {}
): SchemaDiff {
  const result: SchemaDiff = {};
  const mergedStatus = mergeKeysWithStatus(
    Object.keys(baseColumns),
    Object.keys(currentColumns)
  );

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

export function toDataGrid(schemaDiff: SchemaDiff) {
  function columnIndexCellClass(row: SchemaDiffRow) {
    if (row.baseIndex === undefined) {
      return "column-index-added";
    } else if (row.currentIndex === undefined) {
      return "column-index-removed";
    } else if (row.reordered === true) {
      return "column-index-reordered";
    } else {
      return "column-index-normal";
    }
  }

  function columnNameCellClass(row: SchemaDiffRow) {
    if (row.baseIndex === undefined) {
      return "column-body-added";
    } else if (row.currentIndex === undefined) {
      return "column-body-removed";
    } else if (row.reordered === true) {
      return "column-body-reordered";
    } else {
      return "column-body-normal";
    }
  }

  function columnTypeCellClass(row: SchemaDiffRow) {
    if (row.baseIndex === undefined) {
      return "column-body-added";
    } else if (row.currentIndex === undefined) {
      return "column-body-removed";
    } else if (row.baseType !== row.currentType) {
      return "column-body-type-changed";
    } else if (row.reordered === true) {
      return "column-body-reordered";
    } else {
      return "column-body-normal";
    }
  }

  const columns: ColumnOrColumnGroup<SchemaDiffRow>[] = [
    {
      key: "baseIndex",
      name: "",
      resizable: true,
      minWidth: 35,
      cellClass: columnIndexCellClass,
      // colSpan: (args) => (args.type === "HEADER" ? 2 : 1),
    },
    {
      key: "currentIndex",
      name: "",
      resizable: true,
      minWidth: 35,
      cellClass: columnIndexCellClass,

      // colSpan: (args) => (args.type === "HEADER" ? 2 : 1),
    },
    {
      key: "name",
      name: "Name",
      resizable: true,
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
