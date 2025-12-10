/**
 * @file toSchemaDataGrid.test.ts
 * @description Tests for schema grid generators
 *
 * Tests cover:
 * - mergeColumns: Column schema merging with status detection
 * - toSchemaDataGrid: Diff view grid generation
 * - toSingleEnvDataGrid: Single environment grid generation
 */

import React from "react";
import { NodeData } from "@/lib/api/info";
import { RowObjectType } from "@/lib/api/types";
import {
  mergeColumns,
  toSchemaDataGrid,
  toSingleEnvDataGrid,
} from "./toSchemaDataGrid";

// ============================================================================
// Mocks
// ============================================================================

// Mock react-data-grid to avoid ES module parsing issues
jest.mock("react-data-grid", () => ({
  renderTextEditor: jest.fn(),
}));

// Mock the schemaCells module
jest.mock("@/components/ui/dataGrid/schemaCells", () => ({
  createColumnNameRenderer: jest.fn(() => jest.fn()),
  createSingleEnvColumnNameRenderer: jest.fn(() => jest.fn()),
}));

// ============================================================================
// Types for testing (avoids ESM import issues with react-data-grid)
// ============================================================================

/**
 * Test-friendly Column type (mirrors react-data-grid Column)
 */
interface TestColumn {
  key: string;
  name?: React.ReactNode;
  width?: number;
  minWidth?: number;
  resizable?: boolean;
  cellClass?: string | ((row: RowObjectType) => string | undefined);
  headerCellClass?: string;
  renderCell?: unknown;
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
  test("creates correct column structure", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    expect(columns).toHaveLength(5);
    expect(getColumn(columns, 0).key).toBe("baseIndex");
    expect(getColumn(columns, 1).key).toBe("currentIndex");
    expect(getColumn(columns, 2).key).toBe("name");
    expect(getColumn(columns, 3).key).toBe("baseType");
    expect(getColumn(columns, 4).key).toBe("currentType");
  });

  test("index columns have correct sizing", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const baseIndexCol = getColumn(columns, 0);
    const currentIndexCol = getColumn(columns, 1);

    expect(baseIndexCol.minWidth).toBe(35);
    expect(baseIndexCol.width).toBe(35);
    expect(currentIndexCol.minWidth).toBe(35);
    expect(currentIndexCol.width).toBe(35);
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
  test("includes renderCell when node provided", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );
    const node = createNodeData("test_model");

    const { columns } = toSchemaDataGrid(schemaDiff, { node });

    const nameColumn = getColumn(columns, 2);
    expect(nameColumn.renderCell).toBeDefined();
  });

  test("omits renderCell when node not provided", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const nameColumn = getColumn(columns, 2);
    expect(nameColumn.renderCell).toBeUndefined();
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

    expect(columns).toHaveLength(5);
  });
});

// ============================================================================
// toSchemaDataGrid - Cell Class Tests
// ============================================================================

describe("toSchemaDataGrid - Cell Classes", () => {
  test("index columns have cellClass function", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const baseIndexCol = getColumn(columns, 0);
    const currentIndexCol = getColumn(columns, 1);

    expect(typeof baseIndexCol.cellClass).toBe("function");
    expect(typeof currentIndexCol.cellClass).toBe("function");
  });

  test("index cellClass returns reordered class when reordered", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT", name: "VARCHAR" }),
      createColumns({ name: "VARCHAR", id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const baseIndexCol = getColumn(columns, 0);
    const cellClassFn = baseIndexCol.cellClass as (
      row: RowObjectType,
    ) => string;

    const reorderedRow = rows.find((r) => r.reordered === true);
    expect(reorderedRow).toBeDefined();
    if (reorderedRow) {
      const result = cellClassFn(reorderedRow);
      expect(result).toContain("column-index-reordered");
    }
  });

  test("index cellClass returns normal class when not reordered", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const baseIndexCol = getColumn(columns, 0);
    const cellClassFn = baseIndexCol.cellClass as (
      row: RowObjectType,
    ) => string;

    const result = cellClassFn(rows[0]);
    expect(result).toBe("schema-column schema-column-index");
    expect(result).not.toContain("reordered");
  });

  test("type cellClass returns type-changed class when types differ", () => {
    const schemaDiff = mergeColumns(
      createColumns({ age: "INT" }),
      createColumns({ age: "DECIMAL" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const baseTypeCol = getColumn(columns, 3);
    const cellClassFn = baseTypeCol.cellClass as (row: RowObjectType) => string;

    const result = cellClassFn(rows[0]);
    expect(result).toContain("column-body-type-changed");
  });

  test("type cellClass returns normal class when types match", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns, rows } = toSchemaDataGrid(schemaDiff);

    const baseTypeCol = getColumn(columns, 3);
    const cellClassFn = baseTypeCol.cellClass as (row: RowObjectType) => string;

    const result = cellClassFn(rows[0]);
    expect(result).toBe("schema-column");
    expect(result).not.toContain("type-changed");
  });

  test("name column has schema-column cellClass", () => {
    const schemaDiff = mergeColumns(
      createColumns({ id: "INT" }),
      createColumns({ id: "INT" }),
    );

    const { columns } = toSchemaDataGrid(schemaDiff);

    const nameCol = getColumn(columns, 2);
    const cellClassFn = nameCol.cellClass as () => string;

    expect(cellClassFn()).toBe("schema-column");
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
    expect(getColumn(gridColumns, 0).key).toBe("index");
    expect(getColumn(gridColumns, 1).key).toBe("name");
    expect(getColumn(gridColumns, 2).key).toBe("type");
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
    expect(nameColumn.renderCell).toBeDefined();
  });

  test("omits renderCell when node not provided", () => {
    const columns = createColumns({ id: "INT" });

    const { columns: gridColumns } = toSingleEnvDataGrid(columns);

    const nameColumn = getColumn(gridColumns, 1);
    expect(nameColumn.renderCell).toBeUndefined();
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
});
