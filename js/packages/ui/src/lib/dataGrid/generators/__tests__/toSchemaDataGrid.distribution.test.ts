/**
 * @file toSchemaDataGrid.distribution.test.ts
 * @description DRC-3390 Stage C — the schema-diff grid appends a
 * "Distribution" column only when distribution data is threaded in.
 */

import type { ColDef } from "ag-grid-community";
import { describe, expect, it } from "vitest";
import type { SchemaDistributionData } from "../../../../components/ui/dataGrid/schemaCells";
import { type SchemaDiffRow, toSchemaDataGrid } from "../toSchemaDataGrid";

const schemaDiff: Record<string, SchemaDiffRow> = {
  amount: {
    name: "amount",
    baseIndex: 1,
    currentIndex: 1,
    baseType: "DOUBLE",
    currentType: "DOUBLE",
    __status: undefined,
  },
  status: {
    name: "status",
    baseIndex: 2,
    currentIndex: 2,
    baseType: "VARCHAR",
    currentType: "VARCHAR",
    __status: undefined,
  },
};

const distribution: SchemaDistributionData = {
  payloads: {
    amount: {
      kind: "histogram",
      base_bin_edges: [0, 1],
      current_bin_edges: [0, 1],
      base_density: [1],
      current_density: [1],
      base_total: 10,
      current_total: 10,
    },
  },
  baseTotal: 10,
  currentTotal: 10,
  isLoading: false,
  hasError: false,
};

const colId = (c: ColDef<SchemaDiffRow>) => c.colId ?? c.field;

describe("toSchemaDataGrid — distribution column", () => {
  it("omits the Distribution column when no distribution data is provided", () => {
    const { columns } = toSchemaDataGrid(schemaDiff, {});
    expect(columns.map(colId)).not.toContain("distribution");
  });

  it("appends the Distribution column when distribution data is provided", () => {
    const { columns } = toSchemaDataGrid(schemaDiff, { distribution });
    const distCol = columns.find((c) => colId(c) === "distribution");
    expect(distCol).toBeDefined();
    expect((distCol as ColDef<SchemaDiffRow>).headerName).toBe("Distribution");
    // Appended after index + name, so it's the last column.
    expect(colId(columns[columns.length - 1])).toBe("distribution");
  });

  it("keeps the Distribution column non-sortable with a renderer", () => {
    const { columns } = toSchemaDataGrid(schemaDiff, { distribution });
    const distCol = columns.find(
      (c) => colId(c) === "distribution",
    ) as ColDef<SchemaDiffRow>;
    expect(distCol.sortable).toBe(false);
    expect(typeof distCol.cellRenderer).toBe("function");
    expect(distCol.cellClass).toContain("schema-column-profile-distribution");
  });
});
