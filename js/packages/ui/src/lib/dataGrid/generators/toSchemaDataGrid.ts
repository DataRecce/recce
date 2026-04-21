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
  createProfileStripRenderer,
  createSchemaColumnNameRenderer,
  createSingleEnvColumnNameRenderer,
  renderIndexCell,
} from "../../../components/ui/dataGrid/schemaCells";
import { mergeKeysWithStatus } from "../../../utils";
import { toDiffColumnConfigured } from "../../../utils/dataGrid/configured";

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
  columnChanges?: Record<string, "added" | "removed" | "modified"> | null;
  /** Callback when user clicks a definition-changed badge to view SQL diff */
  onViewCode?: () => void;
  /** Set of impacted column IDs from CLL parent_map walk (e.g. "model.jaffle_shop.orders_STATUS") */
  impactedColumns?: Set<string>;
  /** Node unique_id, used to build column IDs for impacted lookup */
  nodeId?: string;
  /**
   * Per-column profile stats keyed by lower-cased column name. When provided,
   * toSchemaDataGrid appends five stat column defs and populates base__* /
   * current__* fields on each row.
   */
  profileByColumn?: Map<
    string,
    {
      base?: Record<string, unknown>;
      current?: Record<string, unknown>;
    }
  >;
  /**
   * How to render inline-profile data. Wide (default) appends 5 base/current
   * stat diff columns. Strip appends one compact "profile" column with a
   * 5-square indicator + popover. Ignored when profileByColumn is undefined.
   */
  profileMode?: "wide" | "strip";
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
      // Include definitionChanged and isImpacted in the value so ag-grid
      // re-renders the cell when the badge/background state changes
      valueGetter: (params) => {
        const row = params.data;
        return row
          ? `${row.name}|${row.definitionChanged ?? false}|${row.isImpacted ?? false}`
          : "";
      },
    },
  ];

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

  // Populate row-level stat fields regardless of mode — strip cell renderer
  // reads the same base__*/current__* fields the wide columns would use.
  if (options.profileByColumn) {
    const STAT_FIELDS = [
      "not_null_proportion",
      "min",
      "max",
      "avg",
      "is_unique",
    ] as const;
    for (const row of rows) {
      const entry = options.profileByColumn.get(row.name.toLowerCase());
      if (!entry) continue;
      for (const field of STAT_FIELDS) {
        const baseVal = entry.base?.[field];
        const currentVal = entry.current?.[field];
        if (baseVal !== undefined) {
          (row as Record<string, unknown>)[`base__${field}`] = baseVal;
        }
        if (currentVal !== undefined) {
          (row as Record<string, unknown>)[`current__${field}`] = currentVal;
        }
      }
    }

    const profileMode = options.profileMode ?? "wide";

    if (profileMode === "strip") {
      columns.push({
        field: "__profile_strip",
        headerName: "Profile",
        width: 100,
        minWidth: 90,
        resizable: false,
        cellRenderer: createProfileStripRenderer(),
        cellClass: "schema-column schema-column-profile-strip",
      });
    } else {
      // Wide (default) — keep existing 5-column diff layout
      const statSpecs = [
        {
          field: "not_null_proportion",
          header: "% non-null",
          columnType: "number" as const,
          columnRenderMode: "percent" as const,
        },
        { field: "min", header: "min", columnType: "text" as const },
        { field: "max", header: "max", columnType: "text" as const },
        { field: "avg", header: "avg", columnType: "number" as const },
        { field: "is_unique", header: "unique", columnType: "boolean" as const },
      ];

      for (const spec of statSpecs) {
        const col = toDiffColumnConfigured({
          name: spec.field,
          columnStatus: "",
          columnType: spec.columnType,
          columnRenderMode: spec.columnRenderMode,
          displayMode: "inline",
        });
        columns.push({
          ...(col as ColDef<SchemaDiffRow>),
          headerName: spec.header,
        });
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
