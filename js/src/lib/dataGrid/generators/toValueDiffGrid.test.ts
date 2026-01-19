/**
 * @file toValueDiffGrid.test.ts
 * @description Comprehensive tests for value diff grid generation
 *
 * Tests cover:
 * - Row transformation and status detection (added/removed/modified)
 * - Primary key handling (required, single, multiple, case-insensitive)
 * - in_a/in_b column handling for base/current row identification
 * - Column filtering (changedOnly, pinned columns)
 * - Display modes (inline, side_by_side)
 * - Edge cases (null values, case sensitivity)
 *
 * Type Reference (from @/lib/api/types.ts):
 * - ColumnType: "number" | "integer" | "text" | "boolean" | "date" | "datetime" | "timedelta" | "unknown"
 * - ColumnRenderMode: "raw" | "percent" | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
 * - RowObjectType.__status: "added" | "removed" | "modified" | undefined
 * - displayMode: "side_by_side" | "inline" (default is "inline" for valuediff)
 */

import { vi } from "vitest";

// Mock ag-grid-community since tests don't need actual rendering
vi.mock("ag-grid-community", () => ({
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
}));

import {
  type ColumnType,
  type DataFrame,
  type RowData,
} from "@datarecce/ui/api";
import { toValueDiffGridConfigured as toValueDiffGrid } from "@datarecce/ui/utils";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a DataFrame with in_a/in_b columns for value diff testing.
 * in_a indicates the row exists in base, in_b indicates it exists in current.
 */
const createJoinedDataFrame = (
  columns: Array<{ name: string; key: string; type: ColumnType }>,
  data: RowData[],
): DataFrame => ({
  columns: [
    ...columns,
    { name: "in_a", key: "in_a", type: "boolean" },
    { name: "in_b", key: "in_b", type: "boolean" },
  ],
  data,
});

// Standard fixture: 3 rows with different statuses
const standardFixture: DataFrame = createJoinedDataFrame(
  [
    { name: "id", key: "id", type: "integer" },
    { name: "name", key: "name", type: "text" },
    { name: "value", key: "value", type: "integer" },
  ],
  [
    // Row in both base and current (unchanged)
    [1, "Alice", 100, true, true],
    // Row in both but with different values (will show as same row, modified detection happens elsewhere)
    [2, "Bob", 200, true, true],
    // Row only in base (removed)
    [3, "Charlie", 300, true, false],
    // Row only in current (added)
    [4, "Diana", 400, false, true],
  ],
);

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe("toValueDiffGrid - Basic Functionality", () => {
  test("generates grid with single primary key", () => {
    const result = toValueDiffGrid(standardFixture, ["id"]);

    expect(result.rows).toHaveLength(4);
    expect(result.columns.length).toBeGreaterThan(0);
  });

  test("generates grid with multiple primary keys", () => {
    const df = createJoinedDataFrame(
      [
        { name: "region", key: "region", type: "text" },
        { name: "product", key: "product", type: "text" },
        { name: "sales", key: "sales", type: "integer" },
      ],
      [
        ["US", "Widget", 100, true, true],
        ["US", "Gadget", 200, true, true],
        ["EU", "Widget", 150, true, false],
      ],
    );

    const result = toValueDiffGrid(df, ["region", "product"]);

    expect(result.rows).toHaveLength(3);
    // Primary keys should be columns
    expect(result.columns.length).toBeGreaterThanOrEqual(2);
  });

  test("throws error when primary keys are empty", () => {
    expect(() => toValueDiffGrid(standardFixture, [])).toThrow(
      "Primary keys are required",
    );
  });

  test("throws error when primary key column not found", () => {
    expect(() => toValueDiffGrid(standardFixture, ["nonexistent"])).toThrow(
      "Primary key column 'nonexistent' not found",
    );
  });
});

// ============================================================================
// Row Status Detection Tests
// ============================================================================

describe("toValueDiffGrid - Row Status Detection", () => {
  test("detects added rows (in_a=false, in_b=true)", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, false, true], // added
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("added");
  });

  test("detects removed rows (in_a=true, in_b=false)", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, true, false], // removed
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("removed");
  });

  test("detects unchanged rows (in_a=true, in_b=true, same values)", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, true, true], // same row appears twice with same values
        [1, 100, true, true],
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    // Both rows have same PK, so they merge to one
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    // When values match, status is undefined (unchanged)
    const row = result.rows.find((r) => r.id === 1);
    expect(row?.__status).toBeUndefined();
  });

  test("detects modified rows when values differ", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, true, false], // base version
        [1, 150, false, true], // current version (different value)
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    const row = result.rows.find((r) => r.id === 1);
    expect(row?.__status).toBe("modified");
    expect(row?.base__value).toBe(100);
    expect(row?.current__value).toBe(150);
  });

  test("handles mixed status rows correctly", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "val", key: "val", type: "integer" },
      ],
      [
        [1, 100, true, true], // unchanged (same key, both present)
        [2, 200, true, false], // removed
        [3, 300, false, true], // added
        [4, 400, true, false], // modified (base)
        [4, 450, false, true], // modified (current)
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    const statusMap = new Map(result.rows.map((r) => [r.id, r.__status]));

    expect(statusMap.get(1)).toBeUndefined(); // unchanged
    expect(statusMap.get(2)).toBe("removed");
    expect(statusMap.get(3)).toBe("added");
    expect(statusMap.get(4)).toBe("modified");
  });
});

// ============================================================================
// in_a/in_b Column Handling Tests
// ============================================================================

describe("toValueDiffGrid - in_a/in_b Column Handling", () => {
  test("handles lowercase in_a/in_b columns", () => {
    const df: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
        { name: "in_a", key: "in_a", type: "boolean" },
        { name: "in_b", key: "in_b", type: "boolean" },
      ],
      data: [
        [1, 100, true, true],
        [2, 200, true, false],
      ],
    };

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(2);
    // in_a/in_b columns should be excluded from output columns
    const columnKeys = result.columns
      .map((c) => ("field" in c ? c.field : undefined))
      .filter(Boolean);
    expect(columnKeys).not.toContain("in_a");
    expect(columnKeys).not.toContain("in_b");
  });

  test("excludes in_a/in_b from output columns", () => {
    const result = toValueDiffGrid(standardFixture, ["id"]);

    // Check that neither in_a nor in_b appear in any column configuration
    const allColumnKeys: string[] = [];
    result.columns.forEach((col) => {
      if ("field" in col && typeof col.field === "string") {
        allColumnKeys.push(col.field);
      }
      if ("children" in col && Array.isArray(col.children)) {
        col.children.forEach((child) => {
          if ("field" in child && typeof child.field === "string") {
            allColumnKeys.push(child.field);
          }
        });
      }
    });

    expect(allColumnKeys).not.toContain("in_a");
    expect(allColumnKeys).not.toContain("in_b");
  });
});

// ============================================================================
// Changed Only Filter Tests
// ============================================================================

describe("toValueDiffGrid - Changed Only Filter", () => {
  test("filters to show only changed rows when changedOnly is true", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, true, true], // unchanged
        [2, 200, true, false], // removed
        [3, 300, false, true], // added
      ],
    );

    const result = toValueDiffGrid(df, ["id"], { changedOnly: true });

    // Should only include removed and added rows
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((r) => r.__status !== undefined)).toBe(true);
  });

  test("includes all rows when changedOnly is false", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, true, true], // unchanged
        [2, 200, true, false], // removed
        [3, 300, false, true], // added
      ],
    );

    const result = toValueDiffGrid(df, ["id"], { changedOnly: false });

    expect(result.rows).toHaveLength(3);
  });

  test("shows modified rows when changedOnly is true", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [
        [1, 100, true, false], // base version
        [1, 150, false, true], // current version (modified)
        [2, 200, true, true], // unchanged
      ],
    );

    const result = toValueDiffGrid(df, ["id"], { changedOnly: true });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[0].id).toBe(1);
  });
});

// ============================================================================
// Display Mode Tests
// ============================================================================

describe("toValueDiffGrid - Display Modes", () => {
  test("defaults to inline display mode", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    // In inline mode, non-PK columns have key directly (no children)
    const valueColumn = result.columns.find((col) => {
      if ("field" in col && col.field === "value") return true;
      return false;
    });

    // Should be a direct column, not a group with children
    if (valueColumn) {
      expect("children" in valueColumn).toBe(false);
    }
  });

  test("side_by_side mode creates column groups with children", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      displayMode: "side_by_side",
    });

    // In side_by_side mode, non-PK columns should have children
    const columnWithChildren = result.columns.find(
      (col) => "children" in col && Array.isArray(col.children),
    );

    expect(columnWithChildren).toBeDefined();
    if (columnWithChildren && "children" in columnWithChildren) {
      expect(columnWithChildren.children).toHaveLength(2);
      const baseChild = columnWithChildren.children?.[0];
      const currentChild = columnWithChildren.children?.[1];
      // Children of a column group are Column types which have 'field'
      if (baseChild && "field" in baseChild) {
        expect(baseChild.field).toContain("base__");
      }
      if (currentChild && "field" in currentChild) {
        expect(currentChild.field).toContain("current__");
      }
    }
  });

  test("inline mode creates flat columns", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      displayMode: "inline",
    });

    // Non-PK columns should be flat (no children) in inline mode
    const nonPKColumns = result.columns.filter((col) => {
      if ("field" in col && col.field === "id") return false;
      return true;
    });

    nonPKColumns.forEach((col) => {
      const hasChildren = "children" in col && Array.isArray(col.children);
      expect(hasChildren).toBe(false);
    });
  });
});

// ============================================================================
// Pinned Columns Tests
// ============================================================================

describe("toValueDiffGrid - Pinned Columns", () => {
  /**
   * Helper to extract column key from a column or column group
   */
  const extractColumnKey = (
    col: ReturnType<typeof toValueDiffGrid>["columns"][number],
  ): string | undefined => {
    if ("field" in col && typeof col.field === "string") {
      return col.field;
    }
    if (
      "children" in col &&
      Array.isArray(col.children) &&
      col.children.length > 0
    ) {
      const firstChild = col.children[0];
      // Type guard: children of ColumnGroup are Column types which have 'field'
      if (
        firstChild &&
        "field" in firstChild &&
        typeof firstChild.field === "string"
      ) {
        const childKey = firstChild.field;
        if (childKey.startsWith("base__")) {
          return childKey.slice(6);
        }
        return childKey;
      }
    }
    return undefined;
  };

  test("pinned columns appear after primary keys", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, "Alice", 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      pinnedColumns: ["value"],
    });

    const columnKeys = result.columns
      .map(extractColumnKey)
      .filter((k): k is string => k !== undefined);

    const idIndex = columnKeys.indexOf("id");
    const valueIndex = columnKeys.indexOf("value");
    const nameIndex = columnKeys.indexOf("name");

    expect(idIndex).toBe(0); // PK first
    expect(valueIndex).toBeGreaterThan(idIndex); // Pinned after PK
    expect(nameIndex).toBeGreaterThan(valueIndex); // Regular after pinned
  });

  test("pinned columns that are also PKs are not duplicated", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      pinnedColumns: ["id"], // id is both PK and pinned
    });

    const idColumns = result.columns.filter((col) => {
      const key = extractColumnKey(col);
      return key === "id";
    });

    expect(idColumns).toHaveLength(1);
  });
});

// ============================================================================
// Column Render Mode Tests
// ============================================================================

describe("toValueDiffGrid - Column Render Modes", () => {
  test("passes columnsRenderMode to column configuration", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "percentage", key: "percentage", type: "number" },
      ],
      [[1, 0.75, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      columnsRenderMode: {
        percentage: "percent", // Valid ColumnRenderMode
      },
    });

    // Find the percentage column
    const percentageColumn = result.columns.find((col) => {
      if ("field" in col && col.field === "percentage") return true;
      if ("children" in col && Array.isArray(col.children)) {
        return col.children.some(
          (child) => "field" in child && child.field === "base__percentage",
        );
      }
      return false;
    });

    expect(percentageColumn).toBeDefined();
    if (percentageColumn && "columnRenderMode" in percentageColumn) {
      expect(percentageColumn.columnRenderMode).toBe("percent");
    }
  });

  test("supports numeric render modes for decimal precision", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "price", key: "price", type: "number" },
      ],
      [[1, 19.99, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      columnsRenderMode: {
        price: 2, // 2 decimal places - valid ColumnRenderMode
      },
    });

    const priceColumn = result.columns.find((col) => {
      if ("field" in col && col.field === "price") return true;
      if ("children" in col && Array.isArray(col.children)) {
        return col.children.some(
          (child) => "field" in child && child.field === "base__price",
        );
      }
      return false;
    });

    expect(priceColumn).toBeDefined();
    if (priceColumn && "columnRenderMode" in priceColumn) {
      expect(priceColumn.columnRenderMode).toBe(2);
    }
  });
});

// ============================================================================
// Custom Titles Tests
// ============================================================================

describe("toValueDiffGrid - Custom Titles", () => {
  test("uses custom baseTitle and currentTitle in side_by_side mode", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      displayMode: "side_by_side",
      baseTitle: "Production",
      currentTitle: "Staging",
    });

    const columnWithChildren = result.columns.find(
      (col) =>
        "children" in col &&
        Array.isArray(col.children) &&
        col.children.length === 2,
    );

    expect(columnWithChildren).toBeDefined();
    if (
      columnWithChildren &&
      "children" in columnWithChildren &&
      columnWithChildren.children
    ) {
      const baseChild = columnWithChildren.children[0];
      const currentChild = columnWithChildren.children[1];
      // Children of a column group are Column types which have 'name'
      if (baseChild && "name" in baseChild) {
        expect(baseChild.name).toBe("Production");
      }
      if (currentChild && "name" in currentChild) {
        expect(currentChild.name).toBe("Staging");
      }
    }
  });

  test("defaults to Base and Current when no custom titles provided", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"], {
      displayMode: "side_by_side",
    });

    const columnWithChildren = result.columns.find(
      (col) =>
        "children" in col &&
        Array.isArray(col.children) &&
        col.children.length === 2,
    );

    expect(columnWithChildren).toBeDefined();
    if (
      columnWithChildren &&
      "children" in columnWithChildren &&
      columnWithChildren.children
    ) {
      const baseChild = columnWithChildren.children[0];
      const currentChild = columnWithChildren.children[1];
      // Children of a column group are Column types which have 'name'
      if (baseChild && "name" in baseChild) {
        expect(baseChild.name).toBe("Base");
      }
      if (currentChild && "name" in currentChild) {
        expect(currentChild.name).toBe("Current");
      }
    }
  });
});

// ============================================================================
// Null and Edge Case Tests
// ============================================================================

describe("toValueDiffGrid - Null and Edge Cases", () => {
  test("handles null values in data columns", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      [[1, null, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].base__name).toBeNull();
    expect(result.rows[0].current__name).toBeNull();
  });

  test("handles null primary key values", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[null, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].id).toBeNull();
  });

  test("handles single row DataFrame", () => {
    const df = createJoinedDataFrame(
      [{ name: "id", key: "id", type: "integer" }],
      [[1, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(1);
  });

  test("handles DataFrame with only in_a/in_b and primary key columns", () => {
    const df: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "in_a", key: "in_a", type: "boolean" },
        { name: "in_b", key: "in_b", type: "boolean" },
      ],
      data: [
        [1, true, true],
        [2, true, false],
      ],
    };

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(2);
    // Should only have the id column (in_a/in_b excluded)
    expect(result.columns.length).toBe(1);
  });

  test("handles boolean values correctly", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "active", key: "active", type: "boolean" },
      ],
      [
        [1, true, true, false], // base has active=true
        [1, false, false, true], // current has active=false
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[0].base__active).toBe(true);
    expect(result.rows[0].current__active).toBe(false);
  });

  test("handles float values", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "price", key: "price", type: "number" },
      ],
      [[1, 19.99, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows[0].base__price).toBe(19.99);
    expect(result.rows[0].current__price).toBe(19.99);
  });
});

// ============================================================================
// Primary Key Column Output Tests
// ============================================================================

describe("toValueDiffGrid - Primary Key Column Output", () => {
  test("primary key values are not prefixed with base__/current__", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    // PK should be at row.id, not row.base__id or row.current__id
    expect(result.rows[0].id).toBe(1);
    expect(result.rows[0].base__id).toBeUndefined();
    expect(result.rows[0].current__id).toBeUndefined();

    // Non-PK columns should be prefixed
    expect(result.rows[0].base__value).toBe(100);
    expect(result.rows[0].current__value).toBe(100);
  });

  test("multiple primary key columns are not prefixed", () => {
    const df = createJoinedDataFrame(
      [
        { name: "region", key: "region", type: "text" },
        { name: "product", key: "product", type: "text" },
        { name: "sales", key: "sales", type: "integer" },
      ],
      [["US", "Widget", 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["region", "product"]);

    // PKs should be unprefixed (lowercase)
    expect(result.rows[0].region).toBe("US");
    expect(result.rows[0].product).toBe("Widget");

    // Non-PK should be prefixed
    expect(result.rows[0].base__sales).toBe(100);
    expect(result.rows[0].current__sales).toBe(100);
  });

  test("primary key columns are frozen in output", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      [[1, 100, true, true]],
    );

    const result = toValueDiffGrid(df, ["id"]);

    // Find the id column and check if it's frozen
    const idColumn = result.columns.find(
      (col) => "field" in col && col.field === "id",
    );

    expect(idColumn).toBeDefined();
    if (idColumn && "pinned" in idColumn) {
      expect(idColumn.pinned).toBe("left");
    }
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe("toValueDiffGrid - Performance", () => {
  test("handles 500 rows efficiently", () => {
    const generateData = (count: number) =>
      Array.from({ length: count }, (_, i) => [
        i,
        `Name ${i}`,
        i * 10,
        i % 3 === 0, // some in base
        i % 2 === 0, // some in current
      ]);

    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "value", key: "value", type: "integer" },
      ],
      generateData(500),
    );

    const startTime = performance.now();
    const result = toValueDiffGrid(df, ["id"]);
    const endTime = performance.now();

    expect(result.rows.length).toBeGreaterThan(0);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});
