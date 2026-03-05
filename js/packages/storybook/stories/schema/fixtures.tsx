import type {
  CellClassParams,
  ColDef,
  RowClassParams,
} from "ag-grid-community";
import type React from "react";

// Import schema CSS for row-added/row-removed/row-normal classes + type badges
import "../../../ui/src/components/schema/style.css";

// ============================================================================
// Row Type (matches the app's SchemaDiffRow from toSchemaDataGrid.ts)
// ============================================================================

export interface SchemaDiffRow {
  name: string;
  reordered?: boolean;
  currentIndex?: number;
  baseIndex?: number;
  currentType?: string;
  baseType?: string;
  definitionChanged?: boolean;
  __status?: string;
  __rowKey?: string;
  [key: string]: unknown;
}

// ============================================================================
// Row factory
// ============================================================================

export function createRow(
  overrides: Partial<SchemaDiffRow> & { name: string },
): SchemaDiffRow {
  return {
    __rowKey: overrides.name,
    ...overrides,
  };
}

// ============================================================================
// Column defs — mirrors toSchemaDataGrid output (Index, Name, Type)
// ============================================================================

function getIndexCellClass(params: CellClassParams): string {
  const row = params.data as SchemaDiffRow | undefined;
  if (
    row?.baseIndex !== undefined &&
    row?.currentIndex !== undefined &&
    row?.reordered === true
  ) {
    return "column-index-reordered schema-column schema-column-index";
  }
  return "schema-column schema-column-index";
}

export const schemaColumns: ColDef[] = [
  {
    field: "index",
    headerName: "",
    resizable: true,
    minWidth: 35,
    width: 35,
    cellClass: getIndexCellClass,
    // Merged index: show currentIndex normally, baseIndex for removed rows
    cellRenderer: (params: { data: SchemaDiffRow }) => {
      const row = params.data;
      if (!row) return null;
      const isRemoved = row.currentIndex === undefined;
      const value = isRemoved
        ? (row.baseIndex ?? "-")
        : (row.currentIndex ?? "-");
      return <span>{value}</span>;
    },
  },
  {
    field: "name",
    headerName: "Name",
    resizable: true,
    cellClass: "schema-column",
  },
  {
    field: "type",
    headerName: "Type",
    resizable: true,
    cellClass: "schema-column",
    // Merged type: show badges when type changed, plain text otherwise
    cellRenderer: (params: { data: SchemaDiffRow }) => {
      const row = params.data;
      if (!row) return null;
      const { baseType, currentType, baseIndex, currentIndex } = row;
      const isAdded = baseIndex === undefined;
      const isRemoved = currentIndex === undefined;
      const isTypeChanged = !isAdded && !isRemoved && baseType !== currentType;

      if (isTypeChanged) {
        return (
          <span>
            <span
              className="type-badge type-badge-removed"
              title={`Base type: ${baseType}`}
            >
              {baseType}
            </span>
            <span
              className="type-badge type-badge-added"
              title={`Current type: ${currentType}`}
            >
              {currentType}
            </span>
          </span>
        );
      }
      return <span>{isRemoved ? baseType : currentType}</span>;
    },
  },
];

// ============================================================================
// Row class — mirrors SchemaView.getRowClass
// ============================================================================

export function getRowClass(params: RowClassParams): string {
  const row = params.data as SchemaDiffRow | undefined;
  if (!row) return "row-normal";

  if (row.baseIndex === undefined) return "row-added";
  if (row.currentIndex === undefined) return "row-removed";
  return "row-normal";
}

// ============================================================================
// Fixture data
// ============================================================================

/** All columns unchanged */
export const unchangedRows: SchemaDiffRow[] = [
  createRow({
    name: "id",
    baseIndex: 1,
    currentIndex: 1,
    baseType: "INTEGER",
    currentType: "INTEGER",
  }),
  createRow({
    name: "name",
    baseIndex: 2,
    currentIndex: 2,
    baseType: "VARCHAR(100)",
    currentType: "VARCHAR(100)",
  }),
  createRow({
    name: "email",
    baseIndex: 3,
    currentIndex: 3,
    baseType: "VARCHAR(255)",
    currentType: "VARCHAR(255)",
  }),
  createRow({
    name: "created_at",
    baseIndex: 4,
    currentIndex: 4,
    baseType: "TIMESTAMP",
    currentType: "TIMESTAMP",
  }),
];

/**
 * Mix of added, removed, modified, reordered, unchanged.
 *
 * Scenario:
 *   Base:    [id, user_id, status, amount, created_at, updated_at, notes]
 *   Current: [id, status, user_id, total_amount, created_at, updated_at, region]
 *
 * Changes: user_id moved (reordered), status type widened, amount→total_amount
 *          (removed+added), notes removed, region added.
 */
export const mixedDiffRows: SchemaDiffRow[] = [
  createRow({
    name: "id",
    baseIndex: 1,
    currentIndex: 1,
    baseType: "INTEGER",
    currentType: "INTEGER",
  }),
  createRow({
    name: "status",
    baseIndex: 3,
    currentIndex: 2,
    baseType: "VARCHAR(50)",
    currentType: "VARCHAR(100)",
  }),
  createRow({
    name: "user_id",
    baseIndex: 2,
    currentIndex: 3,
    baseType: "INTEGER",
    currentType: "INTEGER",
    reordered: true,
  }),
  createRow({
    name: "total_amount",
    currentIndex: 4,
    currentType: "DECIMAL(12,2)",
  }), // added
  createRow({
    name: "created_at",
    baseIndex: 5,
    currentIndex: 5,
    baseType: "TIMESTAMP",
    currentType: "TIMESTAMP",
  }),
  createRow({
    name: "updated_at",
    baseIndex: 6,
    currentIndex: 6,
    baseType: "TIMESTAMP",
    currentType: "TIMESTAMP",
  }),
  createRow({ name: "region", currentIndex: 7, currentType: "VARCHAR(20)" }), // added
  createRow({ name: "notes", baseIndex: 7, baseType: "TEXT" }), // removed
  createRow({ name: "amount", baseIndex: 4, baseType: "DECIMAL(10,2)" }), // removed
];

/**
 * Mix of definition-changed and normal columns.
 *
 * Scenario: same column names and types, but some SQL definitions changed.
 * e.g. `revenue` was `price * quantity` → `price * quantity * (1 - discount)`
 */
export const definitionChangedRows: SchemaDiffRow[] = [
  createRow({
    name: "id",
    baseIndex: 1,
    currentIndex: 1,
    baseType: "INTEGER",
    currentType: "INTEGER",
  }),
  createRow({
    name: "revenue",
    baseIndex: 2,
    currentIndex: 2,
    baseType: "DECIMAL(18,4)",
    currentType: "DECIMAL(18,4)",
    definitionChanged: true,
  }),
  createRow({
    name: "customer_name",
    baseIndex: 3,
    currentIndex: 3,
    baseType: "VARCHAR(255)",
    currentType: "VARCHAR(255)",
  }),
  createRow({
    name: "is_active",
    baseIndex: 4,
    currentIndex: 4,
    baseType: "BOOLEAN",
    currentType: "BOOLEAN",
    definitionChanged: true,
  }),
  createRow({
    name: "created_at",
    baseIndex: 5,
    currentIndex: 5,
    baseType: "TIMESTAMP",
    currentType: "TIMESTAMP",
  }),
  createRow({
    name: "category",
    baseIndex: 6,
    currentIndex: 6,
    baseType: "VARCHAR(50)",
    currentType: "VARCHAR(100)",
  }), // type change (not definitionChanged — already visually indicated)
  createRow({
    name: "region",
    currentIndex: 7,
    currentType: "VARCHAR(20)",
  }), // added
];

/** Name column renderer that shows ~ badge for definitionChanged rows */
export function renderNameWithDefinitionBadge(params: {
  data: SchemaDiffRow;
}): React.ReactNode {
  const row = params.data;
  if (!row) return null;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {row.definitionChanged && (
        <button
          type="button"
          title="Column definition changed — click to view code"
          onClick={(e) => {
            e.stopPropagation();
            console.log("View code clicked for:", row.name);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.65rem",
            fontWeight: 700,
            lineHeight: 1,
            width: 16,
            height: 16,
            borderRadius: 4,
            backgroundColor: "rgba(255, 173, 21, 0.2)",
            color: "rgb(180, 120, 0)",
            flexShrink: 0,
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          ~
        </button>
      )}
      <span>{row.name}</span>
    </span>
  );
}

/** Schema columns with definition-changed badge in name column */
export const schemaColumnsWithDefinitionBadge: ColDef[] = schemaColumns.map(
  (col) =>
    col.field === "name"
      ? { ...col, cellRenderer: renderNameWithDefinitionBadge }
      : col,
);

/** Wide schema (stress test) */
export function generateWideSchema(count: number): SchemaDiffRow[] {
  return Array.from({ length: count }, (_, i) =>
    createRow({
      name: `column_${i}`,
      baseIndex: i + 1,
      currentIndex: i + 1,
      baseType:
        i % 3 === 0 ? "INTEGER" : i % 3 === 1 ? "VARCHAR(255)" : "BOOLEAN",
      currentType:
        i % 3 === 0 ? "INTEGER" : i % 3 === 1 ? "VARCHAR(255)" : "BOOLEAN",
    }),
  );
}
