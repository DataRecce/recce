/**
 * @file toDiffColumn.test.tsx
 * @description Tests for toDiffColumn shared column builder
 *
 * Tests cover:
 * - createCellClassBase factory function
 * - createCellClassCurrent factory function
 * - toDiffColumn inline mode
 * - toDiffColumn side_by_side mode
 * - Column metadata preservation
 * - Header cell class assignment
 */

import React from "react";
import { ColumnRenderMode, ColumnType, RowObjectType } from "@/lib/api/types";
import {
  createCellClassBase,
  createCellClassCurrent,
  DiffColumnConfig,
  DiffColumnResult,
  toDiffColumn,
} from "./toDiffColumn";

// ============================================================================
// Mocks
// ============================================================================

// Mock react-data-grid to avoid ES module parsing issues
jest.mock("react-data-grid", () => ({
  textEditor: jest.fn(),
}));

// Mock the UI components to avoid React rendering complexity
jest.mock("@/components/ui/dataGrid", () => ({
  DataFrameColumnGroupHeader: () => null,
  defaultRenderCell: jest.fn(),
  inlineRenderCell: jest.fn(),
}));

jest.mock("./gridUtils", () => ({
  getHeaderCellClass: (status: string | undefined) => {
    if (status === "added") return "diff-header-added";
    if (status === "removed") return "diff-header-removed";
    return undefined;
  },
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
  cellClass?: string | ((row: RowObjectType) => string | undefined);
  headerCellClass?: string;
  renderCell?: unknown;
  renderEditCell?: unknown;
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

/**
 * Test-friendly ColumnGroup type (mirrors react-data-grid ColumnGroup)
 */
interface TestColumnGroup {
  name?: React.ReactNode;
  headerCellClass?: string;
  children: readonly TestColumn[];
  columnType?: ColumnType;
  columnRenderMode?: ColumnRenderMode;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Helper to create a valid RowObjectType with required __status
 */
const createRow = (
  values: Record<string, number | string | boolean | null | undefined>,
  status: "added" | "removed" | "modified" | undefined = undefined,
): RowObjectType => ({
  ...values,
  __status: status,
});

/**
 * Creates a minimal DiffColumnConfig for testing
 */
const createConfig = (
  overrides: Partial<DiffColumnConfig> = {},
): DiffColumnConfig => ({
  name: "test_column",
  columnStatus: "",
  columnType: "text",
  displayMode: "inline",
  ...overrides,
});

/**
 * Check if result is a Column (inline mode) - has 'key' property
 * Returns boolean instead of type predicate to avoid ESM type compatibility issues
 */
function isColumn(result: DiffColumnResult): boolean {
  return "key" in result;
}

/**
 * Check if result is a ColumnGroup (side_by_side mode) - has 'children' property
 * Returns boolean instead of type predicate to avoid ESM type compatibility issues
 */
function isColumnGroup(result: DiffColumnResult): boolean {
  return (
    "children" in result &&
    Array.isArray((result as unknown as TestColumnGroup).children)
  );
}

/**
 * Cast result to TestColumn for accessing column properties
 */
function asColumn(result: DiffColumnResult): TestColumn {
  return result as unknown as TestColumn;
}

/**
 * Cast result to TestColumnGroup for accessing column group properties
 */
function asColumnGroup(result: DiffColumnResult): TestColumnGroup {
  return result as unknown as TestColumnGroup;
}

/**
 * Helper to get children from a column group as TestColumn array
 */
function getChildren(result: DiffColumnResult): TestColumn[] {
  return asColumnGroup(result).children as TestColumn[];
}

// ============================================================================
// createCellClassBase Tests
// ============================================================================

describe("createCellClassBase", () => {
  test("returns a function", () => {
    const cellClassFn = createCellClassBase("value", "");

    expect(typeof cellClassFn).toBe("function");
  });

  test("returns 'diff-cell-removed' for removed row status", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({}, "removed");

    expect(cellClassFn(row)).toBe("diff-cell-removed");
  });

  test("returns 'diff-cell-added' for added row status", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({}, "added");

    expect(cellClassFn(row)).toBe("diff-cell-added");
  });

  test("returns undefined for added column status", () => {
    const cellClassFn = createCellClassBase("value", "added");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("returns undefined for removed column status", () => {
    const cellClassFn = createCellClassBase("value", "removed");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("returns 'diff-cell-removed' when base and current values differ", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBe("diff-cell-removed");
  });

  test("returns undefined when base and current values are equal", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({ base__value: 100, current__value: 100 });

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("handles case-insensitive key lookup (lowercase)", () => {
    const cellClassFn = createCellClassBase("Value", "");
    // Keys are lowercased: base__value, current__value
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBe("diff-cell-removed");
  });

  test("handles null values", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({ base__value: null, current__value: "test" });

    expect(cellClassFn(row)).toBe("diff-cell-removed");
  });

  test("handles undefined values (both undefined = equal)", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow({});

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("handles modified row status with equal values", () => {
    const cellClassFn = createCellClassBase("value", "");
    const row = createRow(
      { base__value: 100, current__value: 100 },
      "modified",
    );

    // Row status is modified, but this specific column has equal values
    expect(cellClassFn(row)).toBeUndefined();
  });

  test("handles object value comparison with lodash isEqual", () => {
    const cellClassFn = createCellClassBase("data", "");
    // Objects with same content should be considered equal
    const row = createRow({});
    // Manually set object values (createRow doesn't support objects in its type)
    (row as Record<string, unknown>).base__data = { a: 1 };
    (row as Record<string, unknown>).current__data = { a: 1 };

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("detects different objects as modified", () => {
    const cellClassFn = createCellClassBase("data", "");
    const row = createRow({});
    (row as Record<string, unknown>).base__data = { a: 1 };
    (row as Record<string, unknown>).current__data = { a: 2 };

    expect(cellClassFn(row)).toBe("diff-cell-removed");
  });
});

// ============================================================================
// createCellClassCurrent Tests
// ============================================================================

describe("createCellClassCurrent", () => {
  test("returns a function", () => {
    const cellClassFn = createCellClassCurrent("value", "");

    expect(typeof cellClassFn).toBe("function");
  });

  test("returns 'diff-cell-removed' for removed row status", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({}, "removed");

    expect(cellClassFn(row)).toBe("diff-cell-removed");
  });

  test("returns 'diff-cell-added' for added row status", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({}, "added");

    expect(cellClassFn(row)).toBe("diff-cell-added");
  });

  test("returns undefined for added column status", () => {
    const cellClassFn = createCellClassCurrent("value", "added");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("returns undefined for removed column status", () => {
    const cellClassFn = createCellClassCurrent("value", "removed");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("returns 'diff-cell-added' when base and current values differ", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({ base__value: 100, current__value: 200 });

    // Current column shows "added" styling for modified cells
    expect(cellClassFn(row)).toBe("diff-cell-added");
  });

  test("returns undefined when base and current values are equal", () => {
    const cellClassFn = createCellClassCurrent("value", "");
    const row = createRow({ base__value: 100, current__value: 100 });

    expect(cellClassFn(row)).toBeUndefined();
  });

  test("handles case-insensitive key lookup (lowercase)", () => {
    const cellClassFn = createCellClassCurrent("Value", "");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(cellClassFn(row)).toBe("diff-cell-added");
  });
});

// ============================================================================
// createCellClassBase vs createCellClassCurrent Comparison
// ============================================================================

describe("createCellClassBase vs createCellClassCurrent", () => {
  test("base returns 'diff-cell-removed', current returns 'diff-cell-added' for same modified cell", () => {
    const baseFn = createCellClassBase("value", "");
    const currentFn = createCellClassCurrent("value", "");
    const row = createRow({ base__value: 100, current__value: 200 });

    expect(baseFn(row)).toBe("diff-cell-removed");
    expect(currentFn(row)).toBe("diff-cell-added");
  });

  test("both return same class for row-level status (added/removed)", () => {
    const baseFn = createCellClassBase("value", "");
    const currentFn = createCellClassCurrent("value", "");

    const addedRow = createRow({}, "added");
    const removedRow = createRow({}, "removed");

    expect(baseFn(addedRow)).toBe(currentFn(addedRow));
    expect(baseFn(removedRow)).toBe(currentFn(removedRow));
  });

  test("both return undefined for unchanged cells", () => {
    const baseFn = createCellClassBase("value", "");
    const currentFn = createCellClassCurrent("value", "");
    const row = createRow({ base__value: 100, current__value: 100 });

    expect(baseFn(row)).toBeUndefined();
    expect(currentFn(row)).toBeUndefined();
  });
});

// ============================================================================
// toDiffColumn - Inline Mode Tests
// ============================================================================

describe("toDiffColumn - inline mode", () => {
  test("returns column with key matching column name", () => {
    const result = toDiffColumn(createConfig({ name: "price" }));

    expect(isColumn(result)).toBe(true);
    const col = asColumn(result);
    expect(col.key).toBe("price");
  });

  test("does not have children property", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));

    expect(isColumnGroup(result)).toBe(false);
  });

  test("includes renderCell function (inlineRenderCell)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));

    expect(isColumn(result)).toBe(true);
    const col = asColumn(result);
    expect(col.renderCell).toBeDefined();
  });

  test("preserves columnType", () => {
    const result = toDiffColumn(
      createConfig({ columnType: "number", displayMode: "inline" }),
    );

    expect(result.columnType).toBe("number");
  });

  test("preserves columnRenderMode", () => {
    const result = toDiffColumn(
      createConfig({ columnRenderMode: "percent", displayMode: "inline" }),
    );

    expect(result.columnRenderMode).toBe("percent");
  });

  test("uses 'raw' as default columnRenderMode", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));

    expect(result.columnRenderMode).toBe("raw");
  });

  test("sets headerCellClass for added column", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "added", displayMode: "inline" }),
    );

    expect(result.headerCellClass).toBe("diff-header-added");
  });

  test("sets headerCellClass for removed column", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "removed", displayMode: "inline" }),
    );

    expect(result.headerCellClass).toBe("diff-header-removed");
  });

  test("headerCellClass is undefined for empty status", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "", displayMode: "inline" }),
    );

    expect(result.headerCellClass).toBeUndefined();
  });

  test("has React element as name (header)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "inline" }));

    expect(React.isValidElement(result.name)).toBe(true);
  });
});

// ============================================================================
// toDiffColumn - Side-by-Side Mode Tests
// ============================================================================

describe("toDiffColumn - side_by_side mode", () => {
  test("returns column group with children", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    expect(isColumnGroup(result)).toBe(true);
  });

  test("has exactly 2 children (base and current)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    expect(children).toHaveLength(2);
  });

  test("children have correct keys (base__name and current__name)", () => {
    const result = toDiffColumn(
      createConfig({ name: "value", displayMode: "side_by_side" }),
    );

    const children = getChildren(result);
    const keys = children.map((child) => child.key);
    expect(keys).toContain("base__value");
    expect(keys).toContain("current__value");
  });

  test("uses default titles 'Base' and 'Current'", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    const names = children.map((child) => child.name);
    expect(names).toContain("Base");
    expect(names).toContain("Current");
  });

  test("uses custom baseTitle and currentTitle", () => {
    const result = toDiffColumn(
      createConfig({
        displayMode: "side_by_side",
        baseTitle: "Before",
        currentTitle: "After",
      }),
    );

    const children = getChildren(result);
    const names = children.map((child) => child.name);
    expect(names).toContain("Before");
    expect(names).toContain("After");
  });

  test("children have cellClass functions", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    children.forEach((child) => {
      expect(typeof child.cellClass).toBe("function");
    });
  });

  test("children have renderCell function (defaultRenderCell)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    children.forEach((child) => {
      expect(child.renderCell).toBeDefined();
    });
  });

  test("children have renderEditCell (textEditor)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    const children = getChildren(result);
    children.forEach((child) => {
      expect(child.renderEditCell).toBeDefined();
    });
  });

  test("children inherit headerCellClass", () => {
    const result = toDiffColumn(
      createConfig({ columnStatus: "added", displayMode: "side_by_side" }),
    );

    const children = getChildren(result);
    children.forEach((child) => {
      expect(child.headerCellClass).toBe("diff-header-added");
    });
  });

  test("children have columnType and columnRenderMode", () => {
    const result = toDiffColumn(
      createConfig({
        displayMode: "side_by_side",
        columnType: "number",
        columnRenderMode: 2,
      }),
    );

    const children = getChildren(result);
    children.forEach((child) => {
      expect(child.columnType).toBe("number");
      expect(child.columnRenderMode).toBe(2);
    });
  });

  test("has React element as name (header)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    expect(React.isValidElement(result.name)).toBe(true);
  });

  test("does not have key property (column group)", () => {
    const result = toDiffColumn(createConfig({ displayMode: "side_by_side" }));

    // Column groups don't have a key at the top level
    expect(isColumn(result)).toBe(false);
  });
});

// ============================================================================
// toDiffColumn - headerProps Tests
// ============================================================================

describe("toDiffColumn - headerProps", () => {
  test("passes headerProps to DataFrameColumnGroupHeader", () => {
    const headerProps = {
      primaryKeys: ["id"],
      pinnedColumns: ["name"],
    };

    const result = toDiffColumn(
      createConfig({
        headerProps,
        displayMode: "inline",
      }),
    );

    // The header is rendered with props, verify it's a React element
    expect(React.isValidElement(result.name)).toBe(true);
  });

  test("uses empty object when headerProps is undefined", () => {
    const result = toDiffColumn(
      createConfig({
        headerProps: undefined,
        displayMode: "inline",
      }),
    );

    expect(React.isValidElement(result.name)).toBe(true);
  });
});

// ============================================================================
// toDiffColumn - Edge Cases
// ============================================================================

describe("toDiffColumn - edge cases", () => {
  test("handles empty column name", () => {
    const result = toDiffColumn(createConfig({ name: "" }));

    const col = asColumn(result);
    expect(col.key).toBe("");
  });

  test("handles column name with special characters", () => {
    const result = toDiffColumn(createConfig({ name: "col-with-dashes" }));

    const col = asColumn(result);
    expect(col.key).toBe("col-with-dashes");
  });

  test("handles column name with spaces", () => {
    const result = toDiffColumn(createConfig({ name: "Column Name" }));

    const col = asColumn(result);
    expect(col.key).toBe("Column Name");
  });

  test("handles various columnType values", () => {
    const types = [
      "text",
      "number",
      "integer",
      "boolean",
      "date",
      "datetime",
      "unknown",
    ] as const;

    types.forEach((type) => {
      const result = toDiffColumn(createConfig({ columnType: type }));
      expect(result.columnType).toBe(type);
    });
  });

  test("handles numeric columnRenderMode", () => {
    const modes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

    modes.forEach((mode) => {
      const result = toDiffColumn(createConfig({ columnRenderMode: mode }));
      expect(result.columnRenderMode).toBe(mode);
    });
  });

  test("handles modified columnStatus (no special header class)", () => {
    const result = toDiffColumn(createConfig({ columnStatus: "modified" }));

    // "modified" doesn't have a special header class in getHeaderCellClass
    expect(result.headerCellClass).toBeUndefined();
  });
});

// ============================================================================
// Integration: Cell Class Functions in Side-by-Side Mode
// ============================================================================

describe("toDiffColumn - side_by_side cell class integration", () => {
  test("base child cellClass returns correct class for modified row", () => {
    const result = toDiffColumn(
      createConfig({ name: "value", displayMode: "side_by_side" }),
    );

    const children = getChildren(result);
    const baseChild = children[0];
    if (typeof baseChild.cellClass === "function") {
      const row = createRow({ base__value: 100, current__value: 200 });
      expect(baseChild.cellClass(row)).toBe("diff-cell-removed");
    }
  });

  test("current child cellClass returns correct class for modified row", () => {
    const result = toDiffColumn(
      createConfig({ name: "value", displayMode: "side_by_side" }),
    );

    const children = getChildren(result);
    const currentChild = children[1];
    if (typeof currentChild.cellClass === "function") {
      const row = createRow({ base__value: 100, current__value: 200 });
      expect(currentChild.cellClass(row)).toBe("diff-cell-added");
    }
  });

  test("both children return undefined for unchanged row", () => {
    const result = toDiffColumn(
      createConfig({ name: "value", displayMode: "side_by_side" }),
    );

    const children = getChildren(result);
    const row = createRow({ base__value: 100, current__value: 100 });

    children.forEach((child) => {
      if (typeof child.cellClass === "function") {
        expect(child.cellClass(row)).toBeUndefined();
      }
    });
  });
});
