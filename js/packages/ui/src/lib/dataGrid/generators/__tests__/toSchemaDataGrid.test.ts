/**
 * @file toSchemaDataGrid.test.ts
 * @description Tests for schema grid generators
 *
 * Tests cover:
 * - mergeColumns: Column schema merging with status detection
 * - toSchemaDataGrid: Diff view grid generation
 * - toSingleEnvDataGrid: Single environment grid generation
 */

import type { CellClassParams } from "ag-grid-community";
import React from "react";
import { vi } from "vitest";
import { type NodeData, type RowObjectType } from "../../../../api";
import {
  mergeColumns,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
} from "../toSchemaDataGrid";

// ============================================================================
// Mocks
// ============================================================================

// Mock ag-grid-community to avoid ES module parsing issues
vi.mock("ag-grid-community", () => ({
  themeQuartz: {
    withParams: vi.fn(() => "mocked-theme"),
  },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
}));

// ============================================================================
// Helper to create mock CellClassParams
// ============================================================================

/**
 * Helper to create mock CellClassParams from a row
 * This is needed because AG Grid cellClass functions expect CellClassParams
 */
const createCellClassParams = (
  row: RowObjectType,
): CellClassParams<RowObjectType> =>
  ({
    data: row,
    value: undefined,
    node: undefined,
    colDef: {},
    column: {},
    api: {},
    rowIndex: 0,
  }) as unknown as CellClassParams<RowObjectType>;

// Mock the schemaCells module
vi.mock("../../../../components/ui/dataGrid/schemaCells", () => ({
  createSchemaColumnNameRenderer: vi.fn(() => vi.fn()),
  createSingleEnvColumnNameRenderer: vi.fn(() => vi.fn()),
  renderIndexCell: vi.fn(),
  renderTypeCell: vi.fn(),
}));

// ============================================================================
// Types for testing (avoids ESM import issues with ag-grid-community)
// ============================================================================

/**
 * Test-friendly Column type (mirrors AG Grid ColDef)
 */
interface TestColumn {
  field: string;
  headerName?: React.ReactNode;
  width?: number;
  minWidth?: number;
  resizable?: boolean;
  cellClass?:
    | string
    | ((params: CellClassParams<RowObjectType>) => string | undefined);
  headerClass?: string;
  cellRenderer?: unknown;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Cast a column to TestColumn for accessing properties
 */
function asColumn(col: unknown): TestColumn {
  return col as TestColumn;
}

/**
 * Get a specific column by index and cast to TestColumn
 */
function getColumn(columns: unknown[], index: number): TestColumn {
  return columns[index] as TestColumn;
}

/**
 * Creates a NodeData["columns"] structure for testing
 */
function createColumns(columns: Record<string, string>): NodeData["columns"] {
  const result: NodeData["columns"] = {};
  Object.entries(columns).forEach(([name, type]) => {
    result[name] = { name, type };
  });
  return result;
}

/**
 * Creates a minimal NodeData for testing
 */
function createNodeData(name: string): NodeData {
  return {
    id: `model.test.${name}`,
    name,
    resource_type: "model",
    columns: {},
  } as NodeData;
}

// ============================================================================
// mergeColumns Tests
// ============================================================================

describe("mergeColumns", () => {
  test("merges identical schemas", () => {
    const columns = createColumns({ id: "INT", name: "VARCHAR" });

    const result = mergeColumns(columns, columns);

    expect(Object.keys(result)).toEqual(["id", "name"]);
    expect(result.id.reordered).toBe(false);
    expect(result.name.reordered).toBe(false);
  });

  test("detects added columns", () => {
    const base = createColumns({ id: "INT" });
    const current = createColumns({ id: "INT", email: "VARCHAR" });

    const result = mergeColumns(base, current);

    expect(Object.keys(result)).toContain("email");
    expect(result.email.baseIndex).toBeUndefined();
    expect(result.email.currentIndex).toBe(2);
  });

  test("detects removed columns", () => {
    const base = createColumns({ id: "INT", legacy: "VARCHAR" });
    const current = createColumns({ id: "INT" });

    const result = mergeColumns(base, current);

    expect(Object.keys(result)).toContain("legacy");
    expect(result.legacy.baseIndex).toBe(2);
    expect(result.legacy.currentIndex).toBeUndefined();
  });

  test("detects reordered columns", () => {
    const base = createColumns({ id: "INT", name: "VARCHAR", age: "INT" });
    const current = createColumns({ id: "INT", age: "INT", name: "VARCHAR" });

    const result = mergeColumns(base, current);

    // When columns swap positions, at least one is marked as reordered
    // Note: mergeKeysWithStatus may not mark ALL swapped columns as reordered
    expect(result.name.reordered).toBe(true);
    expect(result.id.reordered).toBe(false);
  });

  test("detects type changes", () => {
    const base = createColumns({ age: "INT" });
    const current = createColumns({ age: "DECIMAL" });

    const result = mergeColumns(base, current);

    expect(result.age.baseType).toBe("INT");
    expect(result.age.currentType).toBe("DECIMAL");
  });

  test("handles empty base columns", () => {
    const current = createColumns({ id: "INT", name: "VARCHAR" });

    const result = mergeColumns({}, current);

    expect(Object.keys(result)).toEqual(["id", "name"]);
    expect(result.id.baseIndex).toBeUndefined();
    expect(result.id.currentIndex).toBe(1);
  });

  test("handles empty current columns", () => {
    const base = createColumns({ id: "INT", name: "VARCHAR" });

    const result = mergeColumns(base, {});

    expect(Object.keys(result)).toEqual(["id", "name"]);
    expect(result.id.baseIndex).toBe(1);
    expect(result.id.currentIndex).toBeUndefined();
  });

  test("handles both empty", () => {
    const result = mergeColumns({}, {});

    expect(Object.keys(result)).toHaveLength(0);
  });

  test("handles undefined inputs", () => {
    const result = mergeColumns(undefined, undefined);

    expect(Object.keys(result)).toHaveLength(0);
  });

  test("filters null column entries", () => {
    const base: NodeData["columns"] = {
      id: { name: "id", type: "INT" },
      broken: null as unknown as { name: string; type: string },
    };
    const current = createColumns({ id: "INT" });

    const result = mergeColumns(base, current);

    // broken column should still appear in keys (merged from both)
    // but its baseIndex should be undefined since it was null
    expect(result.id.baseIndex).toBe(1);
  });

  test("preserves order from merge", () => {
    const base = createColumns({
      id: "INT",
      user_id: "INT",
      name: "VARCHAR",
      age: "INT",
    });
    const current = createColumns({
      id: "INT",
      fullname: "VARCHAR",
      lastname: "VARCHAR",
      age: "DECIMAL",
      name: "VARCHAR",
    });

    const result = mergeColumns(base, current);

    expect(Object.keys(result)).toStrictEqual([
      "id",
      "user_id",
      "fullname",
      "lastname",
      "age",
      "name",
    ]);
  });
});

// ============================================================================
// toSchemaDataGrid - Column Structure Tests
// ============================================================================

describe("toSchemaDataGrid - Column Structure", () => {
  test("creates correct column structure with 3 merged columns", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    expect(columns).toHaveLength(3);
    expect(getColumn(columns, 0).field).toBe("index");
    expect(getColumn(columns, 1).field).toBe("name");
    expect(getColumn(columns, 2).field).toBe("type");
  });

  test("index column has correct sizing", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const indexCol = getColumn(columns, 0);

    expect(indexCol.minWidth).toBe(35);
    expect(indexCol.width).toBe(35);
  });

  test("all columns are resizable", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    columns.forEach((col) => {
      expect(asColumn(col).resizable).toBe(true);
    });
  });
});

// ============================================================================
// toSchemaDataGrid - Row Generation Tests
// ============================================================================

describe("toSchemaDataGrid - Row Generation", () => {
  test("returns rows from schemaDiff", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT", name: "VARCHAR" }),
      createColumns({ id: "INT", name: "VARCHAR" }),
    );

    const { rows } = toSchemaDataGrid(schemaDiff);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual(["id", "name"]);
  });

  test("rows have __status property", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { rows } = toSchemaDataGrid(schemaDiff);

    rows.forEach((row) => {
      expect("__status" in row).toBe(true);
    });
  });

  test("handles empty schemaDiff", () => {
    const schemaDiff = mergeColumns({}, {});

    const { rows } = toSchemaDataGrid(schemaDiff);

    expect(rows).toHaveLength(0);
  });
});

// ============================================================================
// toSchemaDataGrid - Options Tests
// ============================================================================

describe("toSchemaDataGrid - Options", () => {
  test("includes renderCell for name column when node provided", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );
    const node = createNodeData("test_model");

    const { columns } = toSchemaDataGrid(schemaDiff, { node });

    const nameColumn = getColumn(columns, 1);
    expect(nameColumn.cellRenderer).toBeDefined();
  });

  test("omits renderCell for name column when node not provided", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const nameColumn = getColumn(columns, 1);
    expect(nameColumn.cellRenderer).toBeUndefined();
  });

  test("accepts cllRunningMap option", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );
    const node = createNodeData("test_model");
    const cllRunningMap = new Map([["id", true]]);

    // Should not throw
    const { columns } = toSchemaDataGrid(schemaDiff, { node, cllRunningMap });

    expect(columns).toHaveLength(3);
  });
});

// ============================================================================
// toSchemaDataGrid - Cell Class Tests
// ============================================================================

describe("toSchemaDataGrid - Cell Classes", () => {
  test("index column has cellClass function", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const indexCol = getColumn(columns, 0);

    expect(typeof indexCol.cellClass).toBe("function");
  });

  test("index cellClass returns reordered class when reordered", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT", name: "VARCHAR" }),
      createColumns({ name: "VARCHAR", id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const indexCol = getColumn(columns, 0);
    const cellClassFn = indexCol.cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string;

    const reorderedRow = rows.find((r) => r.reordered === true);
    expect(reorderedRow).toBeDefined();
    if (reorderedRow) {
      const result = cellClassFn(createCellClassParams(reorderedRow));
      expect(result).toContain("column-index-reordered");
    }
  });

  test("index cellClass returns normal class when not reordered", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const indexCol = getColumn(columns, 0);
    const cellClassFn = indexCol.cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string;

    const result = cellClassFn(createCellClassParams(rows[0]));
    expect(result).toBe("schema-column schema-column-index");
    expect(result).not.toContain("reordered");
  });

  test("name column has schema-column cellClass", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const nameCol = getColumn(columns, 1);
    const cellClassFn = nameCol.cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string;

    const result = cellClassFn(createCellClassParams(rows[0]));
    expect(result).toBe("schema-column");
    expect(result).not.toContain("type-changed");
  });

  test("type column has schema-column cellClass", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const typeCol = getColumn(columns, 2);
    const cellClassFn = typeCol.cellClass as (
      params: CellClassParams<RowObjectType>,
    ) => string;

    expect(cellClassFn(createCellClassParams(rows[0]))).toBe("schema-column");
  });
});

// ============================================================================
// toSingleEnvDataGrid - Column Structure Tests
// ============================================================================

describe("toSingleEnvDataGrid - Column Structure", () => {
  test("creates correct column structure", () => {
    const columns = createColumns({ id: "INT", name: "VARCHAR" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    expect(gridColumns).toHaveLength(3);
    expect(getColumn(gridColumns, 0).field).toBe("index");
    expect(getColumn(gridColumns, 1).field).toBe("name");
    expect(getColumn(gridColumns, 2).field).toBe("type");
  });

  test("index column has correct sizing", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    const indexCol = getColumn(gridColumns, 0);
    expect(indexCol.minWidth).toBe(35);
    expect(indexCol.width).toBe(35);
  });

  test("all columns are resizable", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    gridColumns.forEach((col) => {
      expect(asColumn(col).resizable).toBe(true);
    });
  });
});

// ============================================================================
// toSingleEnvDataGrid - Row Generation Tests
// ============================================================================

describe("toSingleEnvDataGrid - Row Generation", () => {
  test("generates rows from columns", () => {
    const columns = createColumns({ id: "INT", name: "VARCHAR", age: "INT" });

    const { rows } = toSingleEnvDataGrid(columns);

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(["id", "name", "age"]);
  });

  test("assigns sequential indices starting from 1", () => {
    const columns = createColumns({ a: "INT", b: "INT", c: "INT" });

    const { rows } = toSingleEnvDataGrid(columns);

    expect(rows.map((r) => r.index)).toEqual([1, 2, 3]);
  });

  test("includes type from column definition", () => {
    const columns = createColumns({ id: "INT", name: "VARCHAR" });

    const { rows } = toSingleEnvDataGrid(columns);

    expect(rows[0].type).toBe("INT");
    expect(rows[1].type).toBe("VARCHAR");
  });

  test("rows have __status property", () => {
    const columns = createColumns({ id: "INT" });

    const { rows } = toSingleEnvDataGrid(columns);

    rows.forEach((row) => {
      expect("__status" in row).toBe(true);
      expect(row.__status).toBeUndefined();
    });
  });

  test("filters null columns", () => {
    const columns: NodeData["columns"] = {
      id: { name: "id", type: "INT" },
      broken: null as unknown as { name: string; type: string },
      name: { name: "name", type: "VARCHAR" },
    };

    const { rows } = toSingleEnvDataGrid(columns);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.name)).toEqual(["id", "name"]);
  });

  test("handles empty columns", () => {
    const { rows } = toSingleEnvDataGrid({});

    expect(rows).toHaveLength(0);
  });

  test("handles undefined columns", () => {
    const { rows } = toSingleEnvDataGrid(undefined);

    expect(rows).toHaveLength(0);
  });
});

// ============================================================================
// toSingleEnvDataGrid - Options Tests
// ============================================================================

describe("toSingleEnvDataGrid - Options", () => {
  test("includes renderCell when node provided", () => {
    const columns = createColumns({ id: "INT" });
    const node = createNodeData("test_model");

    const { columns: gridColumns } = toSingleEnvDataGrid(columns, { node });

    const nameColumn = getColumn(gridColumns, 1);
    expect(nameColumn.cellRenderer).toBeDefined();
  });

  test("omits renderCell when node not provided", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    const nameColumn = getColumn(gridColumns, 1);
    expect(nameColumn.cellRenderer).toBeUndefined();
  });

  test("accepts cllRunningMap option", () => {
    const columns = createColumns({ id: "INT" });
    const node = createNodeData("test_model");
    const cllRunningMap = new Map([["id", true]]);

    const { columns: gridColumns } = toSingleEnvDataGrid(columns, {
      node,
      cllRunningMap,
    });

    expect(gridColumns).toHaveLength(3);
  });
});

// ============================================================================
// toSingleEnvDataGrid - Cell Class Tests
// ============================================================================

describe("toSingleEnvDataGrid - Cell Classes", () => {
  test("index column has static cellClass", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    const indexCol = getColumn(gridColumns, 0);
    expect(indexCol.cellClass).toBe("schema-column schema-column-index");
  });

  test("name column has schema-column cellClass", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    const nameCol = getColumn(gridColumns, 1);
    expect(nameCol.cellClass).toBe("schema-column");
  });

  test("type column has schema-column cellClass", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    const typeCol = getColumn(gridColumns, 2);
    expect(typeCol.cellClass).toBe("schema-column");
  });

  // ============================================================================
  // mergeColumns - Edge Cases
  // ============================================================================

  describe("mergeColumns - Edge Cases", () => {
    test("handles columns with special characters in names", () => {
      const base = createColumns({ "user-id": "INT", "first.name": "VARCHAR" });
      const current = createColumns({
        "user-id": "INT",
        "first.name": "VARCHAR",
      });

      const result = mergeColumns(base, current);

      expect(Object.keys(result)).toContain("user-id");
      expect(Object.keys(result)).toContain("first.name");
      expect(result["user-id"].baseIndex).toBe(1);
      expect(result["first.name"].currentIndex).toBe(2);
    });

    test("handles columns with spaces in names", () => {
      const base = createColumns({ "User ID": "INT", "Full Name": "VARCHAR" });
      const current = createColumns({
        "User ID": "INT",
        "Full Name": "VARCHAR",
      });

      const result = mergeColumns(base, current);

      expect(result["User ID"]).toBeDefined();
      expect(result["Full Name"]).toBeDefined();
    });

    test("handles columns with unicode characters", () => {
      const base = createColumns({ 用户名: "VARCHAR", prénom: "VARCHAR" });
      const current = createColumns({ 用户名: "VARCHAR", prénom: "VARCHAR" });

      const result = mergeColumns(base, current);

      // biome-ignore lint/complexity/useLiteralKeys: Testing unicode keys
      expect(result["用户名"]).toBeDefined();
      // biome-ignore lint/complexity/useLiteralKeys: Testing unicode keys
      expect(result["prénom"]).toBeDefined();
    });

    test("treats column names as case-sensitive", () => {
      const base = createColumns({ ID: "INT", id: "INT" });
      const current = createColumns({ ID: "INT", id: "INT" });

      const result = mergeColumns(base, current);

      expect(Object.keys(result)).toContain("ID");
      expect(Object.keys(result)).toContain("id");
      expect(
        Object.keys(result).filter((k) => k.toLowerCase() === "id"),
      ).toHaveLength(2);
    });

    test("handles empty string column name", () => {
      const base: NodeData["columns"] = {
        "": { name: "", type: "INT" },
        id: { name: "id", type: "INT" },
      };
      const current: NodeData["columns"] = {
        "": { name: "", type: "INT" },
        id: { name: "id", type: "INT" },
      };

      const result = mergeColumns(base, current);

      expect(result[""]).toBeDefined();
      expect(result[""].baseIndex).toBeDefined();
    });

    test("handles columns with very long type strings", () => {
      const longType = "DECIMAL(38,18)";
      const base = createColumns({ amount: longType });
      const current = createColumns({ amount: longType });

      const result = mergeColumns(base, current);

      expect(result.amount.baseType).toBe(longType);
      expect(result.amount.currentType).toBe(longType);
    });

    test("handles complex type changes", () => {
      const base = createColumns({
        data: "VARCHAR(255)",
        amount: "DECIMAL(10,2)",
      });
      const current = createColumns({
        data: "TEXT",
        amount: "DECIMAL(18,4)",
      });

      const result = mergeColumns(base, current);

      expect(result.data.baseType).toBe("VARCHAR(255)");
      expect(result.data.currentType).toBe("TEXT");
      expect(result.amount.baseType).toBe("DECIMAL(10,2)");
      expect(result.amount.currentType).toBe("DECIMAL(18,4)");
    });

    test("handles large number of columns", () => {
      const columns: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        columns[`col_${i}`] = "VARCHAR";
      }
      const base = createColumns(columns);
      const current = createColumns(columns);

      const result = mergeColumns(base, current);

      expect(Object.keys(result)).toHaveLength(100);
      expect(result.col_0.baseIndex).toBe(1);
      expect(result.col_99.currentIndex).toBe(100);
    });

    test("handles all columns removed", () => {
      const base = createColumns({ id: "INT", name: "VARCHAR", age: "INT" });
      const current: NodeData["columns"] = {};

      const result = mergeColumns(base, current);

      expect(Object.keys(result)).toHaveLength(3);
      Object.values(result).forEach((row) => {
        expect(row.baseIndex).toBeDefined();
        expect(row.currentIndex).toBeUndefined();
      });
    });

    test("handles all columns added", () => {
      const base: NodeData["columns"] = {};
      const current = createColumns({ id: "INT", name: "VARCHAR", age: "INT" });

      const result = mergeColumns(base, current);

      expect(Object.keys(result)).toHaveLength(3);
      Object.values(result).forEach((row) => {
        expect(row.baseIndex).toBeUndefined();
        expect(row.currentIndex).toBeDefined();
      });
    });

    test("handles complete schema replacement", () => {
      const base = createColumns({ old_id: "INT", old_name: "VARCHAR" });
      const current = createColumns({ new_id: "INT", new_name: "VARCHAR" });

      const result = mergeColumns(base, current);

      expect(Object.keys(result)).toHaveLength(4);
      expect(result.old_id.currentIndex).toBeUndefined();
      expect(result.new_id.baseIndex).toBeUndefined();
    });

    test("handles mixed null and valid columns", () => {
      const base: NodeData["columns"] = {
        id: { name: "id", type: "INT" },
        null1: null as unknown as { name: string; type: string },
        name: { name: "name", type: "VARCHAR" },
        null2: null as unknown as { name: string; type: string },
      };
      const current: NodeData["columns"] = {
        id: { name: "id", type: "INT" },
        name: { name: "name", type: "VARCHAR" },
      };

      const result = mergeColumns(base, current);

      // Null columns appear in keys but don't get indices
      expect(result.id.baseIndex).toBe(1);
      expect(result.name.baseIndex).toBe(2);
      expect(result.null1?.baseIndex).toBeUndefined();
    });
  });

  // ============================================================================
  // toSchemaDataGrid - Edge Cases
  // ============================================================================

  describe("toSchemaDataGrid - Edge Cases", () => {
    test("handles empty schema diff", () => {
      const schemaDiff = mergeColumns({}, {});

      const { columns, rows } = toSchemaDataGrid(schemaDiff);

      expect(columns).toHaveLength(3);
      expect(rows).toHaveLength(0);
    });

    test("cell class handles row with only baseIndex (removed column)", () => {
      const schemaDiff = mergeColumns(createColumns({ legacy: "INT" }), {});

      const { columns, rows } = toSchemaDataGrid(schemaDiff);
      const indexCol = getColumn(columns, 0);
      const cellClassFn = indexCol.cellClass as (
        params: CellClassParams<RowObjectType>,
      ) => string;

      // Row has baseIndex but no currentIndex
      const result = cellClassFn(createCellClassParams(rows[0]));
      expect(result).toBe("schema-column schema-column-index");
    });

    test("cell class handles row with only currentIndex (added column)", () => {
      const schemaDiff = mergeColumns({}, createColumns({ new_col: "INT" }));

      const { columns, rows } = toSchemaDataGrid(schemaDiff);
      const indexCol = getColumn(columns, 0);
      const cellClassFn = indexCol.cellClass as (
        params: CellClassParams<RowObjectType>,
      ) => string;

      // Row has currentIndex but no baseIndex
      const result = cellClassFn(createCellClassParams(rows[0]));
      expect(result).toBe("schema-column schema-column-index");
    });

    test("handles schema with single column", () => {
      const schemaDiff = mergeColumns(
        createColumns({ id: "INT" }),
        createColumns({ id: "INT" }),
      );

      const { rows } = toSchemaDataGrid(schemaDiff);

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("id");
    });
  });

  // ============================================================================
  // toSingleEnvDataGrid - Edge Cases
  // ============================================================================

  describe("toSingleEnvDataGrid - Edge Cases", () => {
    test("handles columns with special characters", () => {
      const columns = createColumns({
        "user-id": "INT",
        "first.name": "VARCHAR",
      });

      const { rows } = toSingleEnvDataGrid(columns);

      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.name)).toContain("user-id");
      expect(rows.map((r) => r.name)).toContain("first.name");
    });

    test("handles single column", () => {
      const columns = createColumns({ id: "INT" });

      const { rows } = toSingleEnvDataGrid(columns);

      expect(rows).toHaveLength(1);
      expect(rows[0].index).toBe(1);
    });

    test("handles large number of columns", () => {
      const cols: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        cols[`col_${i}`] = "VARCHAR";
      }
      const columns = createColumns(cols);

      const { rows } = toSingleEnvDataGrid(columns);

      expect(rows).toHaveLength(100);
      expect(rows[0].index).toBe(1);
      expect(rows[99].index).toBe(100);
    });

    test("handles columns with undefined type", () => {
      const columns: NodeData["columns"] = {
        id: { name: "id", type: undefined as unknown as string },
      };

      const { rows } = toSingleEnvDataGrid(columns);

      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBeUndefined();
    });

    test("preserves column order from input", () => {
      const columns: NodeData["columns"] = {};
      // Add in specific order
      columns.zebra = { name: "zebra", type: "VARCHAR" };
      columns.alpha = { name: "alpha", type: "VARCHAR" };
      columns.beta = { name: "beta", type: "VARCHAR" };

      const { rows } = toSingleEnvDataGrid(columns);

      // Object.entries preserves insertion order
      expect(rows[0].name).toBe("zebra");
      expect(rows[1].name).toBe("alpha");
      expect(rows[2].name).toBe("beta");
    });
  });
});
