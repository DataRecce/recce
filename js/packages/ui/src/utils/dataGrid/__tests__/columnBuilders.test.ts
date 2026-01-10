/**
 * @file columnBuilders.test.ts
 * @description Tests for column configuration utilities
 *
 * Tests cover:
 * - buildColumnOrder: Column ordering with PKs, pinned, and remaining columns
 * - shouldIncludeColumn: Column filtering based on changedOnly
 * - isPrimaryKeyColumn / isPinnedColumn / isExcludedColumn: Column classification helpers
 * - getDisplayColumns: Full column configuration for diff grids
 * - getSimpleDisplayColumns: Column configuration for simple grids
 */

import type { ColumnType } from "../../../api";
import {
  buildColumnOrder,
  GridColumnsConfig,
  getDisplayColumns,
  getSimpleDisplayColumns,
  isExcludedColumn,
  isPinnedColumn,
  isPrimaryKeyColumn,
  shouldIncludeColumn,
} from "../columnBuilders";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a standard column map for testing
 */
const createColumnMap = (
  columns: Array<{
    name: string;
    key?: string;
    type?: ColumnType;
    status?: string;
  }>,
): GridColumnsConfig["columnMap"] => {
  const map: GridColumnsConfig["columnMap"] = {};
  columns.forEach((col) => {
    map[col.name] = {
      key: col.key ?? col.name,
      colType: col.type ?? "text",
      status: col.status,
    };
  });
  return map;
};

// Standard fixture with various column types
const standardColumnMap = createColumnMap([
  { name: "id", type: "integer" },
  { name: "name", type: "text" },
  { name: "value", type: "number" },
  { name: "active", type: "boolean" },
  { name: "created_at", type: "datetime" },
]);

// ============================================================================
// buildColumnOrder Tests
// ============================================================================

describe("buildColumnOrder", () => {
  test("orders primary keys first", () => {
    const result = buildColumnOrder({
      primaryKeys: ["id"],
      pinnedColumns: [],
      allColumns: ["name", "value", "id"],
    });

    expect(result[0]).toBe("id");
    expect(result).toHaveLength(3);
  });

  test("orders pinned columns after primary keys", () => {
    const result = buildColumnOrder({
      primaryKeys: ["id"],
      pinnedColumns: ["name"],
      allColumns: ["value", "name", "id", "active"],
    });

    expect(result[0]).toBe("id");
    expect(result[1]).toBe("name");
    expect(result.slice(2)).toContain("value");
    expect(result.slice(2)).toContain("active");
  });

  test("maintains order within each category", () => {
    const result = buildColumnOrder({
      primaryKeys: ["region", "product"],
      pinnedColumns: ["sales", "revenue"],
      allColumns: ["id", "region", "product", "sales", "revenue", "cost"],
    });

    expect(result[0]).toBe("region");
    expect(result[1]).toBe("product");
    expect(result[2]).toBe("sales");
    expect(result[3]).toBe("revenue");
  });

  test("excludes specified columns", () => {
    const result = buildColumnOrder({
      primaryKeys: ["id"],
      pinnedColumns: [],
      allColumns: ["id", "name", "in_a", "in_b", "value"],
      excludeColumns: ["in_a", "in_b"],
    });

    expect(result).not.toContain("in_a");
    expect(result).not.toContain("in_b");
    expect(result).toHaveLength(3);
  });

  test("does not duplicate columns that appear in multiple categories", () => {
    const result = buildColumnOrder({
      primaryKeys: ["id"],
      pinnedColumns: ["id"], // Same as PK
      allColumns: ["id", "name", "value"],
    });

    const idCount = result.filter((c) => c === "id").length;
    expect(idCount).toBe(1);
  });

  test("handles empty inputs", () => {
    const result = buildColumnOrder({
      primaryKeys: [],
      pinnedColumns: [],
      allColumns: [],
    });

    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// shouldIncludeColumn Tests
// ============================================================================

describe("shouldIncludeColumn", () => {
  test("includes all columns when changedOnly is false", () => {
    expect(shouldIncludeColumn(undefined, false, true)).toBe(true);
    expect(shouldIncludeColumn("", false, true)).toBe(true);
    expect(shouldIncludeColumn("modified", false, true)).toBe(true);
  });

  test("includes all columns when no modified rows exist", () => {
    expect(shouldIncludeColumn(undefined, true, false)).toBe(true);
    expect(shouldIncludeColumn("", true, false)).toBe(true);
  });

  test("filters to changed columns when changedOnly is true and has modified rows", () => {
    expect(shouldIncludeColumn("added", true, true)).toBe(true);
    expect(shouldIncludeColumn("removed", true, true)).toBe(true);
    expect(shouldIncludeColumn("modified", true, true)).toBe(true);
    expect(shouldIncludeColumn(undefined, true, true)).toBe(false);
    expect(shouldIncludeColumn("", true, true)).toBe(false);
  });
});

// ============================================================================
// isPrimaryKeyColumn Tests
// ============================================================================

describe("isPrimaryKeyColumn", () => {
  test("identifies primary key columns", () => {
    expect(isPrimaryKeyColumn("id", ["id", "region"])).toBe(true);
    expect(isPrimaryKeyColumn("region", ["id", "region"])).toBe(true);
    expect(isPrimaryKeyColumn("name", ["id", "region"])).toBe(false);
  });

  test("handles case-sensitive matching by default", () => {
    expect(isPrimaryKeyColumn("ID", ["id"])).toBe(false);
    expect(isPrimaryKeyColumn("id", ["ID"])).toBe(false);
  });

  test("handles empty primary keys array", () => {
    expect(isPrimaryKeyColumn("id", [])).toBe(false);
  });
});

// ============================================================================
// isPinnedColumn Tests
// ============================================================================

describe("isPinnedColumn", () => {
  test("identifies pinned columns", () => {
    expect(isPinnedColumn("name", ["name", "value"])).toBe(true);
    expect(isPinnedColumn("value", ["name", "value"])).toBe(true);
    expect(isPinnedColumn("id", ["name", "value"])).toBe(false);
  });

  test("handles case-sensitive matching by default", () => {
    expect(isPinnedColumn("NAME", ["name"])).toBe(false);
  });
});

// ============================================================================
// isExcludedColumn Tests
// ============================================================================

describe("isExcludedColumn", () => {
  test("identifies excluded columns", () => {
    expect(isExcludedColumn("in_a", ["in_a", "in_b"])).toBe(true);
    expect(isExcludedColumn("in_b", ["in_a", "in_b"])).toBe(true);
    expect(isExcludedColumn("id", ["in_a", "in_b"])).toBe(false);
  });

  test("handles case-sensitive matching by default", () => {
    expect(isExcludedColumn("FOO", ["foo"])).toBe(false);
  });
});

// ============================================================================
// getDisplayColumns Tests
// ============================================================================

describe("getDisplayColumns", () => {
  test("returns columns in correct order: PKs, pinned, others", () => {
    const result = getDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: ["name"],
      columnsRenderMode: {},
    });

    expect(result[0].name).toBe("id");
    expect(result[0].isPrimaryKey).toBe(true);
    expect(result[0].frozen).toBe(true);
    expect(result[1].name).toBe("name");
  });

  test("marks primary key columns correctly", () => {
    const result = getDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
    });

    const pkColumn = result.find((c) => c.name === "id");
    expect(pkColumn?.isPrimaryKey).toBe(true);
    expect(pkColumn?.frozen).toBe(true);

    const nonPkColumn = result.find((c) => c.name === "name");
    expect(nonPkColumn?.isPrimaryKey).toBeUndefined();
    expect(nonPkColumn?.frozen).toBeUndefined();
  });

  test("excludes specified columns", () => {
    const result = getDisplayColumns({
      columnMap: createColumnMap([
        { name: "id" },
        { name: "value" },
        { name: "in_a" },
        { name: "in_b" },
      ]),
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
      excludeColumns: ["in_a", "in_b"],
    });

    expect(result.map((c) => c.name)).not.toContain("in_a");
    expect(result.map((c) => c.name)).not.toContain("in_b");
  });

  test("applies changedOnly filter when has modified rows", () => {
    const columnMap = createColumnMap([
      { name: "id" },
      { name: "changed_col", status: "modified" },
      { name: "unchanged_col", status: undefined },
      { name: "added_col", status: "added" },
    ]);

    const result = getDisplayColumns({
      columnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
      changedOnly: true,
      rowStats: { added: 0, removed: 0, modified: 5 },
    });

    const columnNames = result.map((c) => c.name);
    expect(columnNames).toContain("id"); // PKs always included
    expect(columnNames).toContain("changed_col");
    expect(columnNames).toContain("added_col");
    expect(columnNames).not.toContain("unchanged_col");
  });

  test("includes all columns when changedOnly but no modified rows", () => {
    const columnMap = createColumnMap([
      { name: "id" },
      { name: "col1" },
      { name: "col2" },
    ]);

    const result = getDisplayColumns({
      columnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
      changedOnly: true,
      rowStats: { added: 0, removed: 0, modified: 0 },
    });

    expect(result).toHaveLength(3);
  });

  test("applies column render modes", () => {
    const result = getDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: { value: "percent", name: 2 },
    });

    const valueCol = result.find((c) => c.name === "value");
    const nameCol = result.find((c) => c.name === "name");

    expect(valueCol?.columnRenderMode).toBe("percent");
    expect(nameCol?.columnRenderMode).toBe(2);
  });

  test("does not duplicate columns that are both PK and pinned", () => {
    const result = getDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: ["id"], // Same column
      columnsRenderMode: {},
    });

    const idCount = result.filter((c) => c.name === "id").length;
    expect(idCount).toBe(1);
  });

  test("preserves column status from columnMap", () => {
    const columnMap = createColumnMap([
      { name: "id", status: undefined },
      { name: "added_col", status: "added" },
      { name: "removed_col", status: "removed" },
      { name: "modified_col", status: "modified" },
    ]);

    const result = getDisplayColumns({
      columnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
    });

    expect(result.find((c) => c.name === "added_col")?.columnStatus).toBe(
      "added",
    );
    expect(result.find((c) => c.name === "removed_col")?.columnStatus).toBe(
      "removed",
    );
    expect(result.find((c) => c.name === "modified_col")?.columnStatus).toBe(
      "modified",
    );
  });

  test("skips columns not found in columnMap", () => {
    const result = getDisplayColumns({
      columnMap: createColumnMap([{ name: "id" }, { name: "value" }]),
      primaryKeys: ["id", "nonexistent"],
      pinnedColumns: ["also_missing"],
      columnsRenderMode: {},
    });

    // Should only include columns that exist
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toContain("id");
    expect(result.map((c) => c.name)).toContain("value");
  });
});

// ============================================================================
// getSimpleDisplayColumns Tests
// ============================================================================

describe("getSimpleDisplayColumns", () => {
  test("returns columns in correct order", () => {
    const result = getSimpleDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: ["name"],
      columnsRenderMode: {},
    });

    expect(result[0].name).toBe("id");
    expect(result[0].frozen).toBe(true);
    expect(result[1].name).toBe("name");
  });

  test("marks primary key columns", () => {
    const result = getSimpleDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
    });

    const pkColumn = result.find((c) => c.name === "id");
    expect(pkColumn?.isPrimaryKey).toBe(true);
    expect(pkColumn?.frozen).toBe(true);
  });

  test("excludes specified columns", () => {
    const columnMap = createColumnMap([
      { name: "id" },
      { name: "value" },
      { name: "index" },
    ]);

    const result = getSimpleDisplayColumns({
      columnMap,
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
      excludeColumns: ["index"],
    });

    expect(result.map((c) => c.name)).not.toContain("index");
  });

  test("uses column key from columnMap", () => {
    const columnMap = createColumnMap([
      { name: "id", key: "col_0" },
      { name: "value", key: "col_1" },
    ]);

    const result = getSimpleDisplayColumns({
      columnMap,
      primaryKeys: ["id"],
      pinnedColumns: ["value"],
      columnsRenderMode: {},
    });

    // PKs use name as key
    expect(result[0].key).toBe("id");
    // Pinned columns use key from columnMap
    expect(result[1].key).toBe("col_1");
  });

  test("applies column render modes", () => {
    const result = getSimpleDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: [],
      pinnedColumns: [],
      columnsRenderMode: { value: 2 },
    });

    const valueCol = result.find((c) => c.name === "value");
    expect(valueCol?.columnRenderMode).toBe(2);
  });

  test("does not duplicate PK and pinned columns", () => {
    const result = getSimpleDisplayColumns({
      columnMap: standardColumnMap,
      primaryKeys: ["id"],
      pinnedColumns: ["id"],
      columnsRenderMode: {},
    });

    const idCount = result.filter((c) => c.name === "id").length;
    expect(idCount).toBe(1);
  });

  test("handles empty columnMap", () => {
    const result = getSimpleDisplayColumns({
      columnMap: {},
      primaryKeys: ["id"],
      pinnedColumns: [],
      columnsRenderMode: {},
    });

    expect(result).toHaveLength(0);
  });
});
