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
  createProfileDistributionRenderer,
  createSchemaColumnNameRenderer,
  createSingleEnvColumnNameRenderer,
  renderIndexCell,
} from "../../../components/ui/dataGrid/schemaCells";
import type { ColumnDistribution } from "../../../hooks/useInlineProfile";
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
   * How to render inline-profile data within the grid. Strip (UI label:
   * "Compact") shows only the distribution column. "grid" is handled by
   * the caller (SchemaGalleryView), but still passes through for type
   * transparency.
   */
  profileMode?: "strip" | "grid";
  /**
   * Optional per-column distribution data, keyed by lower-cased column name.
   * Independent of profileByColumn so the schema grid can render paired-
   * histogram cells in surfaces where inline-profile stats aren't available
   * (e.g. backends that don't yet implement profile_diff). Distribution
   * column is added when this map is non-empty OR pendingDistributionColumns
   * is non-empty (so the column appears with spinners while loading).
   */
  distributionByName?: Map<string, ColumnDistribution>;
  /**
   * Lower-cased names of columns whose distribution is being fetched. The
   * cell renders a spinner for these instead of an empty slot — gives
   * a visible "we're working on it" cue without inventing data.
   */
  pendingDistributionColumns?: Set<string>;
}

export interface SchemaDataGridResult {
  columns: (ColDef<SchemaDiffRow> | ColGroupDef<SchemaDiffRow>)[];
  rows: SchemaDiffRow[];
}

export interface SingleEnvSchemaDataGridResult {
  columns: (ColDef<SchemaRow> | ColGroupDef<SchemaRow>)[];
  rows: SchemaRow[];
}

// Inline-profile stats hydrated onto each row as base__*/current__* fields.
// Consumers (e.g. SchemaGalleryView) read these to render per-column stats.
const PROFILE_STAT_FIELDS = [
  "not_null_proportion",
  "min",
  "max",
  "avg",
  "is_unique",
  "row_count",
] as const;

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

  // Hydrate row-level stat fields so downstream consumers (SchemaGalleryView)
  // can read them. Distribution data lives off-row in `distributionByName`
  // because the SchemaDiffRow index signature only allows primitive values.
  const profileMode = options.profileMode ?? "strip";
  const distributionByName = new Map<string, ColumnDistribution>(
    options.distributionByName ?? [],
  );

  if (options.profileByColumn) {
    for (const row of rows) {
      const entry = options.profileByColumn.get(row.name.toLowerCase());
      if (!entry) continue;
      for (const field of PROFILE_STAT_FIELDS) {
        const baseVal = entry.base?.[field];
        const currentVal = entry.current?.[field];
        if (baseVal !== undefined) {
          (row as Record<string, unknown>)[`base__${field}`] = baseVal;
        }
        if (currentVal !== undefined) {
          (row as Record<string, unknown>)[`current__${field}`] = currentVal;
        }
      }
      const dist = (entry.current?.distribution ?? entry.base?.distribution) as
        | ColumnDistribution
        | null
        | undefined;
      if (dist) {
        distributionByName.set(row.name.toLowerCase(), dist);
      }
    }
  }

  // Distribution column (DRC-3390). Appears in compact mode whenever we have
  // distribution data, OR while a fetch is pending so the column shows up
  // populated-with-spinners rather than popping in late.
  const pending = options.pendingDistributionColumns ?? new Set<string>();
  if (
    (distributionByName.size > 0 || pending.size > 0) &&
    profileMode !== "grid"
  ) {
    columns.push({
      field: "__profile_distribution",
      headerName: "Distribution",
      width: 160,
      minWidth: 140,
      resizable: false,
      cellRenderer: createProfileDistributionRenderer(
        distributionByName,
        pending,
      ),
      cellClass: "schema-column schema-column-profile-distribution",
    });
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
