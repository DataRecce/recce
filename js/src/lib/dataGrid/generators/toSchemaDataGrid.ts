/**
 * @file toSchemaDataGrid.ts
 * @description Grid generator for schema diff and single-environment schema views
 *
 * This file is intentionally .ts (not .tsx) - all JSX rendering is delegated
 * to schemaCells.tsx via render functions.
 */

import type { CellClassParams, ColDef, ColGroupDef } from "ag-grid-community";
import {
  createColumnNameRenderer,
  createSingleEnvColumnNameRenderer,
} from "@/components/ui/dataGrid/schemaCells";
import { NodeColumnData, NodeData } from "@/lib/api/info";
import { RowObjectType } from "@/lib/api/types";
import { mergeKeysWithStatus } from "@/lib/mergeKeys";

// ============================================================================
// Types
// ============================================================================

export interface SchemaDiffRow extends RowObjectType {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
}

export interface SchemaRow extends RowObjectType {
  name: string;
  index: number;
  type?: string;
}

type SchemaDiff = Record<string, SchemaDiffRow>;

export interface SchemaDataGridOptions {
  /** Node data for context menu actions */
  node?: NodeData;
  /** Map of column names to CLL loading state */
  cllRunningMap?: Map<string, boolean>;
  /** Whether to show the column action menu (default: true) */
  showMenu?: boolean;
}

export interface SchemaDataGridResult {
  columns: (ColDef<SchemaDiffRow> | ColGroupDef<SchemaDiffRow>)[];
  rows: SchemaDiffRow[];
}

export interface SingleEnvSchemaDataGridResult {
  columns: (ColDef<SchemaRow> | ColGroupDef<SchemaRow>)[];
  rows: SchemaRow[];
}

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Merges base and current column schemas into a diff structure
 */
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

  filteredIndex = 0;
  Object.entries(currentColumns).forEach(([name, column]) => {
    if (column != null) {
      result[name].currentIndex = filteredIndex += 1;
      result[name].currentType = column.type;
    }
  });

  return result;
}

// ============================================================================
// Cell Class Functions
// ============================================================================

function getColumnIndexCellClass(
  params: CellClassParams<SchemaDiffRow>,
): string {
  const row = params.data;
  if (
    row?.baseIndex !== undefined &&
    row?.currentIndex !== undefined &&
    row?.reordered === true
  ) {
    return "column-index-reordered schema-column schema-column-index";
  }
  return "schema-column schema-column-index";
}

function getColumnNameCellClass(): string {
  return "schema-column";
}

function getColumnTypeCellClass(
  params: CellClassParams<SchemaDiffRow>,
): string {
  const row = params.data;
  if (
    row?.baseIndex !== undefined &&
    row?.currentIndex !== undefined &&
    row?.baseType !== row?.currentType
  ) {
    return "column-body-type-changed schema-column";
  }
  return "schema-column";
}

// ============================================================================
// Main Generator Functions
// ============================================================================

/**
 * Generates grid configuration for schema diff view
 */
export function toSchemaDataGrid(
  schemaDiff: SchemaDiff,
  options: SchemaDataGridOptions = {},
): SchemaDataGridResult {
  const { node, cllRunningMap, showMenu } = options;

  const columns: ColDef<SchemaDiffRow>[] = [
    {
      field: "baseIndex",
      headerName: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: getColumnIndexCellClass,
    },
    {
      field: "currentIndex",
      headerName: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: getColumnIndexCellClass,
    },
    {
      field: "name",
      headerName: "Name",
      resizable: true,
      cellRenderer: node
        ? createColumnNameRenderer(node, cllRunningMap, showMenu)
        : undefined,
      cellClass: getColumnNameCellClass,
    },
    {
      field: "baseType",
      headerName: "Base Type",
      resizable: true,
      cellClass: getColumnTypeCellClass,
    },
    {
      field: "currentType",
      headerName: "Current Type",
      resizable: true,
      cellClass: getColumnTypeCellClass,
    },
  ];

  const rows = Object.values(schemaDiff);

  return { columns, rows };
}

/**
 * Generates grid configuration for single-environment schema view
 */
export function toSingleEnvDataGrid(
  nodeColumns: NodeData["columns"] = {},
  options: SchemaDataGridOptions = {},
): SingleEnvSchemaDataGridResult {
  const { node, cllRunningMap, showMenu } = options;

  const nodeColumnList = Object.entries(nodeColumns).filter(
    ([_, column]) => column != null,
  ) as [string, NodeColumnData][];

  const rows: SchemaRow[] = nodeColumnList.map(([name, column], index) => ({
    name,
    index: index + 1,
    type: column.type,
    __status: undefined,
  }));

  const columns: ColDef<SchemaRow>[] = [
    {
      field: "index",
      headerName: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellClass: "schema-column schema-column-index",
    },
    {
      field: "name",
      headerName: "Name",
      resizable: true,
      cellRenderer: node
        ? createSingleEnvColumnNameRenderer(node, cllRunningMap, showMenu)
        : undefined,
      cellClass: "schema-column",
    },
    {
      field: "type",
      headerName: "Type",
      resizable: true,
      cellClass: "schema-column",
    },
  ];

  return { columns, rows };
}
