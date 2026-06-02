/**
 * @file toSchemaDataGrid.ts
 * @description Grid generator for schema diff and single-environment schema views
 *
 * This file is intentionally .ts (not .tsx) - all JSX rendering is delegated
 * to schemaCells.tsx via render functions.
 */

import "../../../components/schema/style.css";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import {
  type NodeColumnData,
  type NodeData,
  type RowObjectType,
} from "../../../api";
import {
  createDistributionCellRenderer,
  createSchemaColumnNameRenderer,
  createSingleEnvColumnNameRenderer,
  renderIndexCell,
  type SchemaDistributionData,
} from "../../../components/ui/dataGrid/schemaCells";
import { mergeKeysWithStatus } from "../../../utils";

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
  /** True when the column's SQL definition changed but name/type stayed the same */
  definitionChanged?: boolean;
  /**
   * True when the analyzer couldn't determine the column's change status
   * (e.g., CTE-internal column with missing parent schema). Mutually exclusive
   * with definitionChanged.
   */
  changeUnknown?: boolean;
  /** True when the column traces upstream to a changed column via CLL parent_map */
  isImpacted?: boolean;
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
  /** Per-column change status from breaking change analysis */
  columnChanges?: Record<
    string,
    "added" | "removed" | "modified" | "unknown"
  > | null;
  /** Callback when user clicks a definition-changed badge to view SQL diff */
  onViewCode?: () => void;
  /** Set of impacted column IDs from CLL parent_map walk (e.g. "model.jaffle_shop.orders_STATUS") */
  impactedColumns?: Set<string>;
  /** Node unique_id, used to build column IDs for impacted lookup */
  nodeId?: string;
  /**
   * Inline paired-distribution data (DRC-3390 Stage C). When present, a
   * "Distribution" column is appended to the schema-diff grid. Omitted when
   * the `inline_profile` flag is off or the adapter is unsupported.
   */
  distribution?: SchemaDistributionData;
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
 * Selects the columns of a node that are *changed* — for scoping the inline
 * paired-distribution run to just what diverged, rather than every column
 * (DRC-3390 Stage C, gated on the new-CLL experience).
 *
 * A column counts as changed when it is added (current-only), removed
 * (base-only), type-changed, flagged by breaking-change analysis
 * (``columnChanges``), or impacted downstream via the CLL parent_map
 * (``impactedColumns``, keyed ``${nodeId}_${name}``). Pure reorders are NOT
 * a data change and are excluded.
 *
 * Returns the changed column names. An empty result means "no per-column
 * change found" — the caller decides whether that's a whole-model change
 * (profile all) or nothing to do.
 */
export function selectChangedColumns(args: {
  base?: NodeData["columns"];
  current?: NodeData["columns"];
  columnChanges?: Record<
    string,
    "added" | "removed" | "modified" | "unknown"
  > | null;
  impactedColumns?: Set<string>;
  nodeId?: string;
}): string[] {
  const baseCols = args.base ?? {};
  const currentCols = args.current ?? {};
  const names = new Set<string>([
    ...Object.keys(baseCols),
    ...Object.keys(currentCols),
  ]);

  const changed: string[] = [];
  for (const name of names) {
    const inBase = baseCols[name] != null;
    const inCurrent = currentCols[name] != null;
    const typeChanged =
      inBase && inCurrent && baseCols[name]?.type !== currentCols[name]?.type;
    const flagged = args.columnChanges?.[name] != null;
    const impacted =
      args.nodeId != null &&
      (args.impactedColumns?.has(`${args.nodeId}_${name}`) ?? false);
    if (!inBase || !inCurrent || typeChanged || flagged || impacted) {
      changed.push(name);
    }
  }
  return changed;
}

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
// Main Generator Functions
// ============================================================================

/**
 * Generates grid configuration for schema diff view
 * Uses merged columns: Index (merged base/current), Name (with inline DataTypeIcon)
 */
export function toSchemaDataGrid(
  schemaDiff: SchemaDiff,
  options: SchemaDataGridOptions = {},
): SchemaDataGridResult {
  const {
    node,
    cllRunningMap,
    showMenu,
    columnChanges,
    onViewCode,
    impactedColumns,
    nodeId,
    distribution,
  } = options;

  const columns: ColDef<SchemaDiffRow>[] = [
    {
      field: "index",
      headerName: "",
      resizable: true,
      minWidth: 35,
      width: 35,
      cellRenderer: renderIndexCell,
      cellClass: "schema-column schema-column-index",
    },
    {
      field: "name",
      headerName: "Name",
      resizable: true,
      cellRenderer: node
        ? createSchemaColumnNameRenderer(
            node,
            cllRunningMap,
            showMenu,
            onViewCode,
          )
        : undefined,
      cellClass: "schema-column",
      // Include definitionChanged, isImpacted, and changeUnknown in the value
      // so ag-grid re-renders the cell when the badge/background state changes
      valueGetter: (params) => {
        const row = params.data;
        return row
          ? `${row.name}|${row.definitionChanged ?? false}|${row.isImpacted ?? false}|${row.changeUnknown ?? false}`
          : "";
      },
    },
  ];

  // Inline paired-distribution column (DRC-3390 Stage C). Appended only when
  // the caller threaded distribution data through (flag on + supported
  // adapter). Not a real row field, so it keys off colId + a cellRenderer.
  if (distribution) {
    columns.push({
      colId: "distribution",
      headerName: "Distribution",
      resizable: true,
      sortable: false,
      minWidth: 150,
      width: 160,
      cellRenderer: createDistributionCellRenderer(distribution),
      cellClass: "schema-column schema-column-profile-distribution",
    });
  }

  const rows = Object.values(schemaDiff);

  // Mark columns whose SQL definition changed but have no other visible change
  if (columnChanges) {
    for (const row of rows) {
      const isAdded = row.baseIndex === undefined;
      const isRemoved = row.currentIndex === undefined;
      const isTypeChanged =
        !isAdded && !isRemoved && row.baseType !== row.currentType;
      const changeStatus = columnChanges[row.name];

      if (
        changeStatus === "modified" &&
        !isAdded &&
        !isRemoved &&
        !isTypeChanged &&
        !row.reordered
      ) {
        row.definitionChanged = true;
      } else if (
        changeStatus === "unknown" &&
        !isAdded &&
        !isRemoved &&
        !isTypeChanged &&
        !row.reordered
      ) {
        row.changeUnknown = true;
      }
    }
  }

  // Mark columns that trace upstream to a changed column via CLL parent_map
  if (impactedColumns && nodeId) {
    for (const row of rows) {
      const columnId = `${nodeId}_${row.name}`;
      if (impactedColumns.has(columnId)) {
        row.isImpacted = true;
      }
    }
  }

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
  ];

  return { columns, rows };
}
