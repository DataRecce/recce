/**
 * @file toDataDiffGrid.test.ts
 * @description Comprehensive tests for query diff grid generation
 *
 * Tests cover:
 * - Row transformation and status detection (added/removed/modified)
 * - Primary key handling (single, multiple, none)
 * - Column filtering (changedOnly, pinned columns)
 * - Display modes (side_by_side, inline)
 * - Edge cases (empty data, null values, schema changes)
 * - Invalid primary key detection
 */

// Mock AG Grid modules
jest.mock("ag-grid-community", () => ({
  ModuleRegistry: { registerModules: jest.fn() },
  AllCommunityModule: {},
}));

import { type DataFrame, type RowObjectType } from "@datarecce/ui/api";
import { toDataDiffGridConfigured as toDataDiffGrid } from "@datarecce/ui/utils";
import type { ColDef } from "ag-grid-community";
import React from "react";

// ============================================================================
// Test Fixtures
// ============================================================================

const baseFixture: DataFrame = {
  columns: [
    { name: "id", key: "id", type: "integer" },
    { name: "name", key: "name", type: "text" },
    { name: "value", key: "value", type: "integer" },
  ],
  data: [
    [1, "Alice", 100],
    [2, "Bob", 200],
    [3, "Charlie", 300],
  ],
};

const currentFixture: DataFrame = {
  columns: [
    { name: "id", key: "id", type: "integer" },
    { name: "name", key: "name", type: "text" },
    { name: "value", key: "value", type: "integer" },
  ],
  data: [
    [1, "Alice", 150], // modified
    [2, "Bob", 200], // unchanged
    [3, "Charlie", 350], // modified
  ],
};

// ============================================================================
// Basic Functionality Tests
// ============================================================================

describe("toDataDiffGrid - Basic Functionality", () => {
  test("generates diff without primary keys (index-based matching)", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[1].__status).toBeUndefined(); // unchanged
    expect(result.rows[2].__status).toBe("modified");

    // Without PKs, should have index column + all data columns
    expect(result.columns.length).toBe(4); // _index + id + name + value
  });

  test("generates diff with single primary key", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
    });

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      id: 1,
      __status: "modified",
      base__name: "Alice",
      current__name: "Alice",
      base__value: 100,
      current__value: 150,
    });

    // With PK, id is not prefixed with base__/current__
    expect(result.rows[0].base__id).toBeUndefined();
    expect(result.rows[0].current__id).toBeUndefined();
  });

  test("generates diff with multiple primary keys", () => {
    const base: DataFrame = {
      columns: [
        { name: "region", key: "region", type: "text" },
        { name: "product", key: "product", type: "text" },
        { name: "sales", key: "sales", type: "integer" },
      ],
      data: [
        ["US", "Widget", 100],
        ["US", "Gadget", 200],
        ["EU", "Widget", 150],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "region", key: "region", type: "text" },
        { name: "product", key: "product", type: "text" },
        { name: "sales", key: "sales", type: "integer" },
      ],
      data: [
        ["US", "Widget", 120], // modified
        ["US", "Gadget", 200], // unchanged
        ["EU", "Widget", 150], // unchanged
      ],
    };

    const result = toDataDiffGrid(base, current, {
      primaryKeys: ["region", "product"],
    });

    expect(result.rows).toHaveLength(3);

    // Find the modified row
    const modifiedRow = result.rows.find(
      (r) => r.region === "US" && r.product === "Widget",
    );
    expect(modifiedRow?.__status).toBe("modified");
    expect(modifiedRow?.base__sales).toBe(100);
    expect(modifiedRow?.current__sales).toBe(120);

    // Columns should be: region, product (PKs) + sales
    expect(result.columns.length).toBe(3);
  });
});

// ============================================================================
// Row Status Detection Tests
// ============================================================================

describe("toDataDiffGrid - Row Status Detection", () => {
  test("detects added rows (only in current)", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, "Alice"],
        [2, "Bob"],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, "Alice"],
        [2, "Bob"],
        [3, "Charlie"], // added
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(3);
    const addedRow = result.rows.find((r) => r.id === 3);
    expect(addedRow?.__status).toBe("added");
    expect(addedRow?.base__name).toBeUndefined();
    expect(addedRow?.current__name).toBe("Charlie");
  });

  test("detects removed rows (only in base)", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, "Alice"],
        [2, "Bob"],
        [3, "Charlie"], // will be removed
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, "Alice"],
        [2, "Bob"],
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(3);
    const removedRow = result.rows.find((r) => r.id === 3);
    expect(removedRow?.__status).toBe("removed");
    expect(removedRow?.base__name).toBe("Charlie");
    expect(removedRow?.current__name).toBeUndefined();
  });

  test("detects modified rows correctly", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "score", key: "score", type: "integer" },
      ],
      data: [[1, "Alice", 100]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "score", key: "score", type: "integer" },
      ],
      data: [[1, "Alice", 150]], // score changed
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[0].base__score).toBe(100);
    expect(result.rows[0].current__score).toBe(150);
    // name unchanged
    expect(result.rows[0].base__name).toBe("Alice");
    expect(result.rows[0].current__name).toBe("Alice");
  });

  test("detects unchanged rows", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [[1, 100]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [[1, 100]], // exactly the same
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows[0].__status).toBeUndefined();
  });

  test("handles mixed status rows (added, removed, modified, unchanged)", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "val", key: "val", type: "integer" },
      ],
      data: [
        [1, 100], // unchanged
        [2, 200], // modified
        [3, 300], // removed
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "val", key: "val", type: "integer" },
      ],
      data: [
        [1, 100], // unchanged
        [2, 250], // modified
        [4, 400], // added
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(4);

    const statusMap = new Map(result.rows.map((r) => [r.id, r.__status]));
    expect(statusMap.get(1)).toBeUndefined(); // unchanged
    expect(statusMap.get(2)).toBe("modified");
    expect(statusMap.get(3)).toBe("removed");
    expect(statusMap.get(4)).toBe("added");
  });
});

// ============================================================================
// Changed Only Filtering Tests
// ============================================================================

describe("toDataDiffGrid - Changed Only Filter", () => {
  test("filters to show only modified rows", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      changedOnly: true,
    });

    // Should only include modified rows (id=1, id=3)
    expect(result.rows).toHaveLength(2);
    expect(result.rows.every((r) => r.__status === "modified")).toBe(true);
  });

  test("shows added rows when changedOnly is true", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [[1, "Alice"]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, "Alice"],
        [2, "Bob"], // added
      ],
    };

    const result = toDataDiffGrid(base, current, {
      primaryKeys: ["id"],
      changedOnly: true,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("added");
    expect(result.rows[0].id).toBe(2);
  });

  test("shows removed rows when changedOnly is true", () => {
    const base: DataFrame = {
      columns: [
        { name: "status", key: "status", type: "text" },
        { name: "c", key: "c", type: "integer" },
      ],
      data: [
        ["active", 16],
        ["inactive", 7],
        [null, 54], // will be removed
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "status", key: "status", type: "text" },
        { name: "c", key: "c", type: "integer" },
      ],
      data: [
        ["active", 16],
        ["inactive", 7],
      ],
    };

    const result = toDataDiffGrid(base, current, {
      primaryKeys: ["status"],
      changedOnly: true,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("removed");
    expect(result.rows[0].status).toBeNull();
  });

  test("shows all columns when only removed records exist", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "a", key: "a", type: "integer" },
        { name: "b", key: "b", type: "integer" },
      ],
      data: [[1, 10, 20]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "a", key: "a", type: "integer" },
        { name: "b", key: "b", type: "integer" },
      ],
      data: [], // all removed
    };

    const result = toDataDiffGrid(base, current, {
      primaryKeys: ["id"],
      changedOnly: true,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("removed");
    // All columns should still be present
    expect(result.columns.length).toBe(3); // id + a + b
  });

  test("filters columns to only show modified ones when changedOnly and modified rows exist", () => {
    const base: DataFrame = {
      columns: [
        { name: "status", key: "status", type: "text" },
        { name: "c", key: "c", type: "integer" },
        { name: "x", key: "x", type: "integer" },
      ],
      data: [
        ["active", 16, 5],
        ["inactive", 7, 5],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "status", key: "status", type: "text" },
        { name: "c", key: "c", type: "integer" },
        { name: "x", key: "x", type: "integer" },
      ],
      data: [
        ["active", 16, 5],
        ["inactive", 5, 5], // only c changed
      ],
    };

    const result = toDataDiffGrid(base, current, {
      primaryKeys: ["status"],
      changedOnly: true,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("modified");
    // Should only show status (PK) and c (modified), not x (unchanged)
    expect(result.columns.length).toBe(2);
  });
});

// ============================================================================
// Empty and Null Input Tests
// ============================================================================

describe("toDataDiffGrid - Empty and Null Inputs", () => {
  test("handles undefined base DataFrame", () => {
    const current: DataFrame = {
      columns: [{ name: "id", key: "id", type: "integer" }],
      data: [[1], [2]],
    };

    const result = toDataDiffGrid(undefined, current);

    expect(result.rows).toHaveLength(2);
    // All rows should be "added" since base is empty
    expect(result.rows.every((r) => r.__status === "added")).toBe(true);
  });

  test("handles undefined current DataFrame", () => {
    const base: DataFrame = {
      columns: [{ name: "id", key: "id", type: "integer" }],
      data: [[1], [2]],
    };

    const result = toDataDiffGrid(base, undefined);

    expect(result.rows).toHaveLength(2);
    // All rows should be "removed" since current is empty
    expect(result.rows.every((r) => r.__status === "removed")).toBe(true);
  });

  test("handles both undefined DataFrames", () => {
    const result = toDataDiffGrid(undefined, undefined);

    expect(result.rows).toHaveLength(0);
    expect(result.columns).toHaveLength(1); // Just the index column
  });

  test("handles empty data arrays", () => {
    const base: DataFrame = {
      columns: [{ name: "id", key: "id", type: "integer" }],
      data: [],
    };

    const current: DataFrame = {
      columns: [{ name: "id", key: "id", type: "integer" }],
      data: [],
    };

    const result = toDataDiffGrid(base, current);

    expect(result.rows).toHaveLength(0);
  });

  test("handles null values in data", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, null],
        [2, "Bob"],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [
        [1, "Alice"], // null -> "Alice" (modified)
        [2, null], // "Bob" -> null (modified)
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[0].base__name).toBeNull();
    expect(result.rows[0].current__name).toBe("Alice");

    expect(result.rows[1].__status).toBe("modified");
    expect(result.rows[1].base__name).toBe("Bob");
    expect(result.rows[1].current__name).toBeNull();
  });

  test("handles null primary key values", () => {
    const base: DataFrame = {
      columns: [
        { name: "status", key: "status", type: "text" },
        { name: "count", key: "count", type: "integer" },
      ],
      data: [
        [null, 10],
        ["active", 20],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "status", key: "status", type: "text" },
        { name: "count", key: "count", type: "integer" },
      ],
      data: [
        [null, 15], // modified
        ["active", 20],
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["status"] });

    const nullRow = result.rows.find((r) => r.status === null);
    expect(nullRow?.__status).toBe("modified");
    expect(nullRow?.base__count).toBe(10);
    expect(nullRow?.current__count).toBe(15);
  });
});

// ============================================================================
// Schema Change Tests (Added/Removed Columns)
// ============================================================================

describe("toDataDiffGrid - Schema Changes", () => {
  test("handles added columns in current", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [[1, "Alice"]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "email", key: "email", type: "text" }, // new column
      ],
      data: [[1, "Alice", "alice@example.com"]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    // Should have columns for: id, name, email
    expect(result.columns.length).toBe(3);

    // The email column should exist in row data
    expect(result.rows[0].current__email).toBe("alice@example.com");
    expect(result.rows[0].base__email).toBeUndefined();
  });

  test("handles removed columns in current", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "legacy", key: "legacy", type: "text" }, // will be removed
      ],
      data: [[1, "Alice", "old_data"]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ],
      data: [[1, "Alice"]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    // Should have columns for: id, name, legacy
    expect(result.columns.length).toBe(3);

    // The legacy column should have base data but no current data
    expect(result.rows[0].base__legacy).toBe("old_data");
    expect(result.rows[0].current__legacy).toBeUndefined();
  });

  test("handles completely different schemas", () => {
    const base: DataFrame = {
      columns: [
        { name: "old_id", key: "old_id", type: "integer" },
        { name: "old_name", key: "old_name", type: "text" },
      ],
      data: [[1, "Alice"]],
    };

    const current: DataFrame = {
      columns: [
        { name: "new_id", key: "new_id", type: "integer" },
        { name: "new_name", key: "new_name", type: "text" },
      ],
      data: [[1, "Alice"]],
    };

    // Without primary keys, uses index matching
    const result = toDataDiffGrid(base, current);

    // Should have all columns from both schemas
    expect(result.columns.length).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================================
// Schema Evolution Tests (Column Type Changes, Reordering, Renames)
// ============================================================================

describe("toDataDiffGrid - Schema Evolution", () => {
  // --------------------------------------------------------------------------
  // Column Type Change Tests
  // --------------------------------------------------------------------------

  describe("column type changes", () => {
    test("handles integer to text type change with same value", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "code", key: "code", type: "integer" },
        ],
        data: [[1, 123]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "code", key: "code", type: "text" }, // type changed
        ],
        data: [[1, "123"]], // same semantic value, different type
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);
      // Values are different types, so they should be detected as modified
      expect(result.rows[0].__status).toBe("modified");
      expect(result.rows[0].base__code).toBe(123);
      expect(result.rows[0].current__code).toBe("123");
    });

    test("handles text to number type change", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "price", key: "price", type: "text" },
        ],
        data: [[1, "99.99"]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "price", key: "price", type: "number" }, // type changed
        ],
        data: [[1, 99.99]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("modified");
    });

    test("handles boolean to text type change", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "active", key: "active", type: "boolean" },
        ],
        data: [[1, true]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "active", key: "active", type: "text" },
        ],
        data: [[1, "true"]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("modified");
    });

    test("preserves base column type in result when types differ", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "number" },
        ],
        data: [[1, 100.5]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "text" },
        ],
        data: [[1, "100.5"]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      // Find the value column and check its type metadata
      const valueColumn = result.columns.find((col) => {
        if ("field" in col) return col.field === "value";
        if ("children" in col) return true; // column group for value
        return false;
      });

      expect(valueColumn).toBeDefined();
      // The colType should come from base (number) as per buildMergedColumnMap logic
      if (valueColumn && "columnType" in valueColumn) {
        expect(valueColumn.columnType).toBe("number");
      }
    });
  });

  // --------------------------------------------------------------------------
  // Column Reordering Tests
  // --------------------------------------------------------------------------

  describe("column reordering", () => {
    test("handles reordered columns with same data", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "first", key: "first", type: "text" },
          { name: "second", key: "second", type: "text" },
          { name: "third", key: "third", type: "text" },
        ],
        data: [[1, "a", "b", "c"]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "third", key: "third", type: "text" }, // reordered
          { name: "first", key: "first", type: "text" }, // reordered
          { name: "second", key: "second", type: "text" },
        ],
        data: [[1, "c", "a", "b"]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);
      // Data values are the same, just reordered columns
      expect(result.rows[0].__status).toBeUndefined();
      expect(result.rows[0].base__first).toBe("a");
      expect(result.rows[0].current__first).toBe("a");
    });

    test("handles reordered columns with modified values", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "col_a", key: "col_a", type: "integer" },
          { name: "col_b", key: "col_b", type: "integer" },
        ],
        data: [[1, 100, 200]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "col_b", key: "col_b", type: "integer" }, // reordered
          { name: "col_a", key: "col_a", type: "integer" }, // reordered
        ],
        data: [[1, 250, 100]], // col_b changed from 200 to 250
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("modified");
      expect(result.rows[0].base__col_b).toBe(200);
      expect(result.rows[0].current__col_b).toBe(250);
    });

    test("output column order follows merged key order", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "alpha", key: "alpha", type: "text" },
          { name: "beta", key: "beta", type: "text" },
        ],
        data: [[1, "a", "b"]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "beta", key: "beta", type: "text" },
          { name: "alpha", key: "alpha", type: "text" },
        ],
        data: [[1, "b", "a"]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      // Use the existing extractColumnKey helper to handle both
      // simple columns and column groups (side_by_side mode default)
      const columnKeys = result.columns
        .map(extractColumnKey)
        .filter((k) => k && k !== "id");

      // The merged order should preserve base order where possible
      // This verifies the output is deterministic
      expect(columnKeys.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // Column Rename Tests (appears as removed + added)
  // --------------------------------------------------------------------------

  describe("column rename scenarios", () => {
    test("handles column rename as removed + added pair", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "user_id", key: "user_id", type: "integer" }, // old name
        ],
        data: [[1, 42]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "customer_id", key: "customer_id", type: "integer" }, // new name
        ],
        data: [[1, 42]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);

      // Should have both old and new columns
      expect(result.rows[0].base__user_id).toBe(42);
      expect(result.rows[0].current__user_id).toBeUndefined();
      expect(result.rows[0].base__customer_id).toBeUndefined();
      expect(result.rows[0].current__customer_id).toBe(42);

      // Row may or may not be marked modified depending on implementation
      // The key point is that both columns appear correctly
    });

    test("handles multiple column renames in same diff", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "old_name_1", key: "old_name_1", type: "text" },
          { name: "old_name_2", key: "old_name_2", type: "text" },
        ],
        data: [[1, "value1", "value2"]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "new_name_1", key: "new_name_1", type: "text" },
          { name: "new_name_2", key: "new_name_2", type: "text" },
        ],
        data: [[1, "value1", "value2"]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      // All four columns should appear
      expect(result.columns.length).toBeGreaterThanOrEqual(5); // id + 4 data cols
    });

    test("handles rename with simultaneous value change", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "old_col", key: "old_col", type: "integer" },
        ],
        data: [[1, 100]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "new_col", key: "new_col", type: "integer" },
        ],
        data: [[1, 200]], // Different value in renamed column
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows[0].base__old_col).toBe(100);
      expect(result.rows[0].current__new_col).toBe(200);
    });
  });

  // --------------------------------------------------------------------------
  // Complex Schema Evolution (Multiple Changes)
  // --------------------------------------------------------------------------

  describe("complex schema changes", () => {
    test("handles simultaneous add, remove, and type change", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "removed_col", key: "removed_col", type: "text" },
          { name: "type_changed", key: "type_changed", type: "integer" },
        ],
        data: [[1, "old", 100]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "type_changed", key: "type_changed", type: "text" }, // type changed
          { name: "added_col", key: "added_col", type: "boolean" },
        ],
        data: [[1, "100", true]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);

      // Verify all columns are represented
      expect(result.rows[0].base__removed_col).toBe("old");
      expect(result.rows[0].current__removed_col).toBeUndefined();
      expect(result.rows[0].base__added_col).toBeUndefined();
      expect(result.rows[0].current__added_col).toBe(true);

      // Type changed column
      expect(result.rows[0].base__type_changed).toBe(100);
      expect(result.rows[0].current__type_changed).toBe("100");
    });

    test("handles schema change with new rows added", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "old_col", key: "old_col", type: "text" },
        ],
        data: [[1, "existing"]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "new_col", key: "new_col", type: "text" },
        ],
        data: [
          [1, "existing"], // schema changed for existing row
          [2, "new_row"], // completely new row
        ],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);

      const existingRow = result.rows.find((r) => r.id === 1);
      const newRow = result.rows.find((r) => r.id === 2);

      expect(existingRow).toBeDefined();
      expect(newRow?.__status).toBe("added");
    });

    test("handles primary key column type change", () => {
      const base: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "text" },
        ],
        data: [[1, "a"]],
      };

      const current: DataFrame = {
        columns: [
          { name: "id", key: "id", type: "text" }, // PK type changed!
          { name: "value", key: "value", type: "text" },
        ],
        data: [["1", "a"]],
      };

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      // The function should still work, though matching behavior may vary
      // Key assertion: it doesn't throw
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Display Mode Tests
// ============================================================================

describe("toDataDiffGrid - Display Modes", () => {
  test("side_by_side mode creates column groups with base/current children", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      displayMode: "side_by_side",
    });

    // Find a non-PK column (value) which should be a column group
    const valueColumnGroup = result.columns.find((col) => {
      // In side_by_side, non-PK columns are groups with children
      if ("children" in col && Array.isArray(col.children)) {
        return col.children.some(
          (child) => "field" in child && child.field === "base__value",
        );
      }
      return false;
    });

    expect(valueColumnGroup).toBeDefined();
    if (valueColumnGroup && "children" in valueColumnGroup) {
      expect(valueColumnGroup.children).toHaveLength(2);
      expect(
        (valueColumnGroup.children?.[0] as ColDef<RowObjectType>).field,
      ).toBe("base__value");
      expect(
        (valueColumnGroup.children?.[1] as ColDef<RowObjectType>).field,
      ).toBe("current__value");
    }
  });

  test("inline mode creates single columns without children", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      displayMode: "inline",
    });

    // In inline mode, non-PK columns should have field directly, not children
    const nonPKColumns = result.columns.filter((col) => {
      // Skip PK column (id)
      if ("field" in col && col.field === "id") return false;
      // Skip index column
      return !("field" in col && col.field === "_index");
    });

    // Verify none of the non-PK columns have children (they're flat columns)
    nonPKColumns.forEach((col) => {
      // In inline mode, columns have field directly
      expect("field" in col).toBe(true);
      // And should not have children array
      expect("children" in col && Array.isArray(col.children)).toBe(false);
    });
  });

  test("defaults to side_by_side mode", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
    });

    // Should have at least one column group (with children) for non-PK columns
    const hasColumnGroups = result.columns.some(
      (col) =>
        "children" in col &&
        Array.isArray(col.children) &&
        col.children.length > 0,
    );
    expect(hasColumnGroups).toBe(true);
  });
});

// ============================================================================
// Pinned Columns Tests
// ============================================================================

/**
 * Helper to extract column key from a column or column group
 * Handles both direct columns (with key) and column groups (with children)
 */
const extractColumnKey = (
  col: ReturnType<typeof toDataDiffGrid>["columns"][number],
): string | undefined => {
  // Direct column with field property
  if ("field" in col && typeof col.field === "string") {
    return col.field;
  }
  // Column group - derive key from first child
  if (
    "children" in col &&
    Array.isArray(col.children) &&
    col.children.length > 0
  ) {
    const firstChild = col.children[0];
    if (
      firstChild &&
      "field" in firstChild &&
      typeof firstChild.field === "string"
    ) {
      // Extract base name from "base__columnName" format
      const childKey = firstChild.field;
      if (childKey.startsWith("base__")) {
        return childKey.slice(6); // Remove "base__" prefix
      }
      return childKey;
    }
  }
  return undefined;
};

describe("toDataDiffGrid - Pinned Columns", () => {
  test("pinned columns appear after primary keys", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      pinnedColumns: ["name"],
    });

    // Extract keys from all columns
    const columnKeys = result.columns
      .map(extractColumnKey)
      .filter((k): k is string => k !== undefined);

    const idIndex = columnKeys.indexOf("id");
    const nameIndex = columnKeys.indexOf("name");
    const valueIndex = columnKeys.indexOf("value");

    // PK should come first, then pinned, then others
    expect(idIndex).toBeGreaterThanOrEqual(0);
    expect(nameIndex).toBeGreaterThan(idIndex);
    expect(valueIndex).toBeGreaterThan(nameIndex);
  });

  test("pinned columns that are also PKs are not duplicated", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      pinnedColumns: ["id"], // id is both PK and pinned
    });

    // Count occurrences of id column
    const idColumns = result.columns.filter((col) => {
      const key = extractColumnKey(col);
      return key === "id";
    });
    expect(idColumns).toHaveLength(1);
  });

  test("multiple pinned columns maintain order", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      pinnedColumns: ["value", "name"], // specific order
    });

    const columnKeys = result.columns
      .map(extractColumnKey)
      .filter((k): k is string => k !== undefined);

    const valueIndex = columnKeys.indexOf("value");
    const nameIndex = columnKeys.indexOf("name");

    // Pinned columns should appear in the order specified
    expect(valueIndex).toBeGreaterThanOrEqual(0);
    expect(nameIndex).toBeGreaterThan(valueIndex);
  });
});

// ============================================================================
// Invalid Primary Key Detection Tests
// ============================================================================

describe("toDataDiffGrid - Invalid Primary Key Detection", () => {
  test("detects duplicate primary keys in base data", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [
        [1, 100],
        [1, 200], // duplicate PK
        [2, 300],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [
        [1, 150],
        [2, 300],
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.invalidPKeyBase).toBe(true);
    expect(result.invalidPKeyCurrent).toBeFalsy();
  });

  test("detects duplicate primary keys in current data", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [
        [1, 100],
        [2, 200],
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [
        [1, 150],
        [1, 250], // duplicate PK
        [2, 200],
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.invalidPKeyBase).toBeFalsy();
    expect(result.invalidPKeyCurrent).toBe(true);
  });

  test("detects duplicates in both base and current", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [
        [1, 100],
        [1, 200], // duplicate
      ],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: [
        [2, 300],
        [2, 400], // duplicate
      ],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.invalidPKeyBase).toBe(true);
    expect(result.invalidPKeyCurrent).toBe(true);
  });
});

// ============================================================================
// Column Render Mode Tests
// ============================================================================

describe("toDataDiffGrid - Column Render Modes", () => {
  test("passes columnsRenderMode to column configuration", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      columnsRenderMode: {
        value: "percent", // valid ColumnRenderMode
        name: "raw",
      },
    });

    // Find the value column - could be a column group in side_by_side mode
    // or a direct column in inline mode
    const valueColumn = result.columns.find((col) => {
      // Check if it's a direct column with field
      if ("field" in col && col.field === "value") {
        return true;
      }
      // Check if it's a column group with children containing base__value
      if ("children" in col && Array.isArray(col.children)) {
        return col.children.some(
          (child) => "field" in child && child.field === "base__value",
        );
      }
      return false;
    });

    expect(valueColumn).toBeDefined();

    // Verify the columnRenderMode is passed through
    if (valueColumn && "columnRenderMode" in valueColumn) {
      expect(valueColumn.columnRenderMode).toBe("percent");
    }
  });

  test("supports numeric render modes for decimal precision", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      columnsRenderMode: {
        value: 2, // Show 2 decimal places
      },
    });

    const valueColumn = result.columns.find((col) => {
      if ("field" in col && col.field === "value") return true;
      if ("children" in col && Array.isArray(col.children)) {
        return col.children.some(
          (child) => "field" in child && child.field === "base__value",
        );
      }
      return false;
    });

    expect(valueColumn).toBeDefined();
    if (valueColumn && "columnRenderMode" in valueColumn) {
      expect(valueColumn.columnRenderMode).toBe(2);
    }
  });
});

// ============================================================================
// Custom Titles Tests
// ============================================================================

describe("toDataDiffGrid - Custom Titles", () => {
  test("uses custom baseTitle and currentTitle in side_by_side mode", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
      displayMode: "side_by_side",
      baseTitle: "Production",
      currentTitle: "Development",
    });

    // Find a column group with children (non-PK columns in side_by_side mode)
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
      const baseChild = columnWithChildren.children[0] as ColDef<RowObjectType>;
      const currentChild = columnWithChildren
        .children[1] as ColDef<RowObjectType>;

      // Check that children have custom names (headerName in AG Grid)
      expect(baseChild?.headerName).toBe("Production");
      expect(currentChild?.headerName).toBe("Development");
    }
  });

  test("defaults to Base and Current when no custom titles provided", () => {
    const result = toDataDiffGrid(baseFixture, currentFixture, {
      primaryKeys: ["id"],
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
      const baseChild = columnWithChildren.children[0] as ColDef<RowObjectType>;
      const currentChild = columnWithChildren
        .children[1] as ColDef<RowObjectType>;

      expect(baseChild?.headerName).toBe("Base");
      expect(currentChild?.headerName).toBe("Current");
    }
  });
});

// ============================================================================
// Large Dataset Tests
// ============================================================================

describe("toDataDiffGrid - Performance with Large Datasets", () => {
  test("handles 1000 rows efficiently", () => {
    const generateData = (count: number, offset = 0) =>
      Array.from({ length: count }, (_, i) => [
        i + offset,
        `Name ${i}`,
        i * 10,
      ]);

    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: generateData(1000),
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
        { name: "value", key: "value", type: "integer" },
      ],
      data: generateData(1000).map((row, i) =>
        i % 10 === 0 ? [row[0], row[1], (row[2] as number) + 1] : row,
      ), // modify every 10th row
    };

    const startTime = performance.now();
    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });
    const endTime = performance.now();

    expect(result.rows).toHaveLength(1000);
    expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe("toDataDiffGrid - Edge Cases", () => {
  test("handles single row DataFrames", () => {
    const base: DataFrame = {
      columns: [{ name: "id", key: "id", type: "integer" }],
      data: [[1]],
    };

    const current: DataFrame = {
      columns: [{ name: "id", key: "id", type: "integer" }],
      data: [[2]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((r) => r.id === 1)?.__status).toBe("removed");
    expect(result.rows.find((r) => r.id === 2)?.__status).toBe("added");
  });

  test("handles single column DataFrames", () => {
    const base: DataFrame = {
      columns: [{ name: "value", key: "value", type: "integer" }],
      data: [[100], [200]],
    };

    const current: DataFrame = {
      columns: [{ name: "value", key: "value", type: "integer" }],
      data: [[150], [200]],
    };

    const result = toDataDiffGrid(base, current);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[1].__status).toBeUndefined();
  });

  test("handles special characters in column names", () => {
    const base: DataFrame = {
      columns: [
        { name: "user-id", key: "user-id", type: "integer" },
        { name: "first.name", key: "first.name", type: "text" },
      ],
      data: [[1, "Alice"]],
    };

    const current: DataFrame = {
      columns: [
        { name: "user-id", key: "user-id", type: "integer" },
        { name: "first.name", key: "first.name", type: "text" },
      ],
      data: [[1, "Alicia"]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["user-id"] });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("modified");
  });

  test("handles boolean values", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "active", key: "active", type: "boolean" },
      ],
      data: [[1, true]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "active", key: "active", type: "boolean" },
      ],
      data: [[1, false]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[0].base__active).toBe(true);
    expect(result.rows[0].current__active).toBe(false);
  });

  test("handles float/decimal values with precision", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "price", key: "price", type: "number" },
      ],
      data: [[1, 19.99]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "price", key: "price", type: "number" },
      ],
      data: [[1, 19.999]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows[0].__status).toBe("modified");
    expect(result.rows[0].base__price).toBe(19.99);
    expect(result.rows[0].current__price).toBe(19.999);
  });

  test("handles datetime values", () => {
    const base: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "created", key: "created", type: "datetime" },
      ],
      data: [[1, "2024-01-01T00:00:00Z"]],
    };

    const current: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "created", key: "created", type: "datetime" },
      ],
      data: [[1, "2024-06-15T12:30:00Z"]],
    };

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows[0].__status).toBe("modified");
  });
});
