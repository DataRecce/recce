/**
 * @file crossFunctionConsistency.test.ts
 * @description Cross-function consistency tests for data grid generation
 *
 * These tests verify that toDataGrid, toDataDiffGrid, and toValueDiffGrid
 * produce consistent outputs for equivalent scenarios. This ensures the
 * refactoring maintains behavioral consistency across all grid types.
 *
 * Test categories:
 * - Row count consistency
 * - Column structure consistency
 * - __status value consistency
 * - Primary key handling consistency
 * - Value preservation consistency
 */

import {
  type ColumnType,
  type DataFrame,
  type RowObjectType,
} from "@datarecce/ui/api";
import {
  toDataDiffGridConfigured as toDataDiffGrid,
  toDataGridConfigured as toDataGrid,
  toValueDiffGridConfigured as toValueDiffGrid,
} from "@datarecce/ui/utils";
import type { ColDef, ColGroupDef } from "ag-grid-community";
import { vi } from "vitest";

// Mock AG Grid modules
vi.mock("ag-grid-community", () => ({
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
  ModuleRegistry: { registerModules: vi.fn() },
  AllCommunityModule: {},
}));

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a standard DataFrame for testing
 */
const createDataFrame = (
  columns: Array<{ name: string; key: string; type: ColumnType }>,
  data: unknown[][],
): DataFrame => ({
  columns,
  data: data as DataFrame["data"],
});

/**
 * Creates a joined DataFrame with in_a/in_b columns for toValueDiffGrid
 */
const createJoinedDataFrame = (
  columns: Array<{ name: string; key: string; type: ColumnType }>,
  data: unknown[][],
): DataFrame => ({
  columns: [
    ...columns,
    { name: "in_a", key: "in_a", type: "boolean" },
    { name: "in_b", key: "in_b", type: "boolean" },
  ],
  data: data as DataFrame["data"],
});

/**
 * Column type for grid functions (AG Grid ColDef or ColGroupDef with metadata)
 */
type GridColumn = (ColDef<RowObjectType> | ColGroupDef<RowObjectType>) & {
  columnType?: ColumnType;
};

/**
 * Extracts column field from a column or column group
 */
const getColumnKey = (col: GridColumn): string | undefined => {
  if ("field" in col && col.field) return col.field;
  if ("children" in col && Array.isArray(col.children) && col.children[0]) {
    const firstChild = col.children[0] as ColDef<RowObjectType>;
    if ("field" in firstChild && firstChild.field) {
      // Extract base column name from "base__colname"
      const field = firstChild.field;
      if (field.startsWith("base__")) {
        return field.replace("base__", "");
      }
      return field;
    }
  }
  return undefined;
};

/**
 * Gets all non-internal column keys from a result
 */
const getNonInternalColumnKeys = (columns: GridColumn[]): string[] => {
  return columns
    .map(getColumnKey)
    .filter((k): k is string => k !== undefined)
    .filter((k) => !k.startsWith("_") && k !== "in_a" && k !== "in_b");
};

// ============================================================================
// Standard Test Data
// ============================================================================

const standardColumns: Array<{ name: string; key: string; type: ColumnType }> =
  [
    { name: "id", key: "id", type: "integer" },
    { name: "name", key: "name", type: "text" },
    { name: "value", key: "value", type: "number" },
  ];

const standardData = [
  [1, "Alice", 100],
  [2, "Bob", 200],
  [3, "Charlie", 300],
];

// ============================================================================
// Row Count Consistency Tests
// ============================================================================

describe("Row count consistency", () => {
  test("identical data produces same row count across all functions", () => {
    const df = createDataFrame(standardColumns, standardData);
    const joinedDf = createJoinedDataFrame(
      standardColumns,
      standardData.map((row) => [...row, true, true]), // All rows in both
    );

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(singleResult.rows).toHaveLength(3);
    expect(diffResult.rows).toHaveLength(3);
    expect(joinedResult.rows).toHaveLength(3);
  });

  test("empty data produces zero rows across all functions", () => {
    const emptyDf = createDataFrame(standardColumns, []);
    const emptyJoinedDf = createJoinedDataFrame(standardColumns, []);

    const singleResult = toDataGrid(emptyDf, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(emptyDf, emptyDf, {
      primaryKeys: ["id"],
    });
    const joinedResult = toValueDiffGrid(emptyJoinedDf, ["id"]);

    expect(singleResult.rows).toHaveLength(0);
    expect(diffResult.rows).toHaveLength(0);
    expect(joinedResult.rows).toHaveLength(0);
  });

  test("single row data produces one row across all functions", () => {
    const singleRowDf = createDataFrame(standardColumns, [[1, "Alice", 100]]);
    const singleRowJoinedDf = createJoinedDataFrame(standardColumns, [
      [1, "Alice", 100, true, true],
    ]);

    const singleResult = toDataGrid(singleRowDf, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(singleRowDf, singleRowDf, {
      primaryKeys: ["id"],
    });
    const joinedResult = toValueDiffGrid(singleRowJoinedDf, ["id"]);

    expect(singleResult.rows).toHaveLength(1);
    expect(diffResult.rows).toHaveLength(1);
    expect(joinedResult.rows).toHaveLength(1);
  });
});

// ============================================================================
// __status Value Consistency Tests
// ============================================================================

describe("__status value consistency", () => {
  test("unchanged rows have undefined __status in both diff functions", () => {
    const df = createDataFrame(standardColumns, [[1, "Alice", 100]]);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, "Alice", 100, true, true],
    ]);

    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(diffResult.rows[0].__status).toBeUndefined();
    expect(joinedResult.rows[0].__status).toBeUndefined();
  });

  test("added rows have 'added' __status in both diff functions", () => {
    const baseDf = createDataFrame(standardColumns, []);
    const currentDf = createDataFrame(standardColumns, [[1, "Alice", 100]]);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, "Alice", 100, false, true], // Only in current (in_b)
    ]);

    const diffResult = toDataDiffGrid(baseDf, currentDf, {
      primaryKeys: ["id"],
    });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(diffResult.rows[0].__status).toBe("added");
    expect(joinedResult.rows[0].__status).toBe("added");
  });

  test("removed rows have 'removed' __status in both diff functions", () => {
    const baseDf = createDataFrame(standardColumns, [[1, "Alice", 100]]);
    const currentDf = createDataFrame(standardColumns, []);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, "Alice", 100, true, false], // Only in base (in_a)
    ]);

    const diffResult = toDataDiffGrid(baseDf, currentDf, {
      primaryKeys: ["id"],
    });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(diffResult.rows[0].__status).toBe("removed");
    expect(joinedResult.rows[0].__status).toBe("removed");
  });

  test("modified rows have 'modified' __status in toDataDiffGrid", () => {
    const baseDf = createDataFrame(standardColumns, [[1, "Alice", 100]]);
    const currentDf = createDataFrame(standardColumns, [[1, "Alice", 200]]); // value changed

    const diffResult = toDataDiffGrid(baseDf, currentDf, {
      primaryKeys: ["id"],
    });

    expect(diffResult.rows[0].__status).toBe("modified");
  });

  // Note: toValueDiffGrid modification detection is tested separately in valuediff.test.ts
  // The joined data from the backend has a different structure that can't be easily
  // replicated in cross-function tests. The backend compares base vs current before
  // joining, so rows with different values in both in_a and in_b are pre-marked.

  test("toDataGrid always sets __status to undefined", () => {
    const df = createDataFrame(standardColumns, standardData);
    const result = toDataGrid(df, { primaryKeys: ["id"] });

    result.rows.forEach((row) => {
      expect(row.__status).toBeUndefined();
    });
  });
});

// ============================================================================
// Primary Key Handling Consistency Tests
// ============================================================================

describe("Primary key handling consistency", () => {
  test("primary key column appears first in all functions", () => {
    const df = createDataFrame(standardColumns, standardData);
    const joinedDf = createJoinedDataFrame(
      standardColumns,
      standardData.map((row) => [...row, true, true]),
    );

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    const singleKeys = getNonInternalColumnKeys(singleResult.columns);
    const diffKeys = getNonInternalColumnKeys(diffResult.columns);
    const joinedKeys = getNonInternalColumnKeys(joinedResult.columns);

    expect(singleKeys[0]).toBe("id");
    expect(diffKeys[0]).toBe("id");
    expect(joinedKeys[0]).toBe("id");
  });

  test("multiple primary keys appear in order in all functions", () => {
    const multiPkColumns: Array<{
      name: string;
      key: string;
      type: ColumnType;
    }> = [
      { name: "region", key: "region", type: "text" },
      { name: "id", key: "id", type: "integer" },
      { name: "value", key: "value", type: "number" },
    ];
    const multiPkData = [["US", 1, 100]];

    const df = createDataFrame(multiPkColumns, multiPkData);
    const joinedDf = createJoinedDataFrame(multiPkColumns, [
      ["US", 1, 100, true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["region", "id"] });
    const diffResult = toDataDiffGrid(df, df, {
      primaryKeys: ["region", "id"],
    });
    const joinedResult = toValueDiffGrid(joinedDf, ["region", "id"]);

    const singleKeys = getNonInternalColumnKeys(singleResult.columns);
    const diffKeys = getNonInternalColumnKeys(diffResult.columns);
    const joinedKeys = getNonInternalColumnKeys(joinedResult.columns);

    // PKs should be first two columns in specified order
    expect(singleKeys[0]).toBe("region");
    expect(singleKeys[1]).toBe("id");
    expect(diffKeys[0]).toBe("region");
    expect(diffKeys[1]).toBe("id");
    expect(joinedKeys[0]).toBe("region");
    expect(joinedKeys[1]).toBe("id");
  });

  test("primary key values are preserved in rows", () => {
    const df = createDataFrame(standardColumns, [[42, "Test", 999]]);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [42, "Test", 999, true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(singleResult.rows[0].id).toBe(42);
    expect(diffResult.rows[0].id).toBe(42);
    expect(joinedResult.rows[0].id).toBe(42);
  });
});

// ============================================================================
// Pinned Column Handling Consistency Tests
// ============================================================================

describe("Pinned column handling consistency", () => {
  test("pinned columns appear after PKs in all functions", () => {
    const df = createDataFrame(standardColumns, standardData);
    const joinedDf = createJoinedDataFrame(
      standardColumns,
      standardData.map((row) => [...row, true, true]),
    );

    const options = { primaryKeys: ["id"], pinnedColumns: ["name"] };

    const singleResult = toDataGrid(df, options);
    const diffResult = toDataDiffGrid(df, df, options);
    const joinedResult = toValueDiffGrid(joinedDf, ["id"], {
      pinnedColumns: ["name"],
    });

    const singleKeys = getNonInternalColumnKeys(singleResult.columns);
    const diffKeys = getNonInternalColumnKeys(diffResult.columns);
    const joinedKeys = getNonInternalColumnKeys(joinedResult.columns);

    // name should be second (after id PK)
    expect(singleKeys.indexOf("name")).toBe(1);
    expect(diffKeys.indexOf("name")).toBe(1);
    expect(joinedKeys.indexOf("name")).toBe(1);
  });

  test("pinned columns that are also PKs are not duplicated", () => {
    const df = createDataFrame(standardColumns, standardData);
    const joinedDf = createJoinedDataFrame(
      standardColumns,
      standardData.map((row) => [...row, true, true]),
    );

    const options = { primaryKeys: ["id"], pinnedColumns: ["id"] };

    const diffResult = toDataDiffGrid(df, df, options);
    const joinedResult = toValueDiffGrid(joinedDf, ["id"], {
      pinnedColumns: ["id"],
    });

    const countId = (cols: GridColumn[]) =>
      cols.filter((c) => getColumnKey(c) === "id").length;

    // toDataDiffGrid and toValueDiffGrid correctly prevent duplication
    expect(countId(diffResult.columns)).toBe(1);
    expect(countId(joinedResult.columns)).toBe(1);
  });

  test("toDataGrid does not duplicate columns that are both PK and pinned", () => {
    const df = createDataFrame(standardColumns, standardData);
    const options = { primaryKeys: ["id"], pinnedColumns: ["id"] };
    const singleResult = toDataGrid(df, options);

    const countId = (cols: GridColumn[]) =>
      cols.filter((c) => getColumnKey(c) === "id").length;

    expect(countId(singleResult.columns)).toBe(1);
  });
});

// ============================================================================
// Column Type Preservation Tests
// ============================================================================

describe("Column type preservation consistency", () => {
  test("column types are preserved in result metadata", () => {
    const typedColumns: Array<{
      name: string;
      key: string;
      type: ColumnType;
    }> = [
      { name: "id", key: "id", type: "integer" },
      { name: "rate", key: "rate", type: "number" },
      { name: "active", key: "active", type: "boolean" },
      { name: "created", key: "created", type: "datetime" },
    ];
    const typedData = [[1, 0.5, true, "2024-01-01T00:00:00Z"]];

    const df = createDataFrame(typedColumns, typedData);
    const joinedDf = createJoinedDataFrame(typedColumns, [
      [1, 0.5, true, "2024-01-01T00:00:00Z", true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    // Helper to find column type (now stored in context property)
    const findColumnType = (
      columns: GridColumn[],
      key: string,
    ): ColumnType | undefined => {
      for (const col of columns) {
        if ("field" in col && col.field === key && "context" in col) {
          const context = col.context as
            | { columnType?: ColumnType }
            | undefined;
          return context?.columnType;
        }
        if ("children" in col && Array.isArray(col.children)) {
          const child = col.children.find(
            (c) => "field" in c && c.field === `base__${key}`,
          );
          if (child && "context" in child) {
            const context = (child as GridColumn).context as
              | { columnType?: ColumnType }
              | undefined;
            return context?.columnType;
          }
        }
      }
      return undefined;
    };

    // Check that column types are preserved
    expect(findColumnType(singleResult.columns, "id")).toBe("integer");
    expect(findColumnType(singleResult.columns, "rate")).toBe("number");

    expect(findColumnType(diffResult.columns, "id")).toBe("integer");
    expect(findColumnType(diffResult.columns, "rate")).toBe("number");

    expect(findColumnType(joinedResult.columns, "id")).toBe("integer");
    expect(findColumnType(joinedResult.columns, "rate")).toBe("number");
  });
});

// ============================================================================
// Value Preservation Tests
// ============================================================================

describe("Value preservation consistency", () => {
  test("null values are preserved consistently", () => {
    const df = createDataFrame(standardColumns, [[1, null, null]]);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, null, null, true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(singleResult.rows[0].name).toBeNull();
    expect(singleResult.rows[0].value).toBeNull();

    expect(diffResult.rows[0].base__name).toBeNull();
    expect(diffResult.rows[0].current__name).toBeNull();

    expect(joinedResult.rows[0].base__name).toBeNull();
    expect(joinedResult.rows[0].current__name).toBeNull();
  });

  test("empty string values are preserved consistently", () => {
    const df = createDataFrame(standardColumns, [[1, "", 0]]);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, "", 0, true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(singleResult.rows[0].name).toBe("");
    expect(diffResult.rows[0].base__name).toBe("");
    expect(joinedResult.rows[0].base__name).toBe("");
  });

  test("numeric zero is preserved consistently", () => {
    const df = createDataFrame(standardColumns, [[0, "Zero", 0]]);
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [0, "Zero", 0, true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(singleResult.rows[0].id).toBe(0);
    expect(singleResult.rows[0].value).toBe(0);

    expect(diffResult.rows[0].id).toBe(0);
    expect(diffResult.rows[0].base__value).toBe(0);

    expect(joinedResult.rows[0].id).toBe(0);
    expect(joinedResult.rows[0].base__value).toBe(0);
  });

  test("boolean false is preserved consistently", () => {
    const boolColumns: Array<{ name: string; key: string; type: ColumnType }> =
      [
        { name: "id", key: "id", type: "integer" },
        { name: "active", key: "active", type: "boolean" },
      ];

    const df = createDataFrame(boolColumns, [[1, false]]);
    const joinedDf = createJoinedDataFrame(boolColumns, [
      [1, false, true, true],
    ]);

    const singleResult = toDataGrid(df, { primaryKeys: ["id"] });
    const diffResult = toDataDiffGrid(df, df, { primaryKeys: ["id"] });
    const joinedResult = toValueDiffGrid(joinedDf, ["id"]);

    expect(singleResult.rows[0].active).toBe(false);
    expect(diffResult.rows[0].base__active).toBe(false);
    expect(joinedResult.rows[0].base__active).toBe(false);
  });
});

// ============================================================================
// changedOnly Filter Consistency Tests
// ============================================================================

describe("changedOnly filter consistency", () => {
  test("changedOnly filters unchanged rows in toDataDiffGrid", () => {
    const baseDf = createDataFrame(standardColumns, [
      [1, "Alice", 100],
      [2, "Bob", 200],
    ]);
    const currentDf = createDataFrame(standardColumns, [
      [1, "Alice", 100], // unchanged
      [2, "Bob", 999], // modified
    ]);

    const diffResult = toDataDiffGrid(baseDf, currentDf, {
      primaryKeys: ["id"],
      changedOnly: true,
    });

    // Only modified row should remain
    expect(diffResult.rows).toHaveLength(1);
    expect(diffResult.rows[0].id).toBe(2);
    expect(diffResult.rows[0].__status).toBe("modified");
  });

  test("changedOnly filters unchanged rows in toValueDiffGrid", () => {
    // For toValueDiffGrid, unchanged rows have identical values
    // The changedOnly filter removes rows where all non-PK values match
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, "Alice", 100, true, true], // unchanged (same value in base and current)
      [2, "Bob", 200, true, false], // removed (only in base)
    ]);

    const joinedResult = toValueDiffGrid(joinedDf, ["id"], {
      changedOnly: true,
    });

    // Only the removed row should remain (it's a "change")
    expect(joinedResult.rows).toHaveLength(1);
    expect(joinedResult.rows[0].id).toBe(2);
    expect(joinedResult.rows[0].__status).toBe("removed");
  });

  test("changedOnly keeps added/removed rows in toDataDiffGrid", () => {
    const baseDf = createDataFrame(standardColumns, [[1, "Alice", 100]]);
    const currentDf = createDataFrame(standardColumns, [[2, "Bob", 200]]);

    const diffResult = toDataDiffGrid(baseDf, currentDf, {
      primaryKeys: ["id"],
      changedOnly: true,
    });

    // Both added and removed rows should remain
    expect(diffResult.rows).toHaveLength(2);

    const statuses = diffResult.rows.map((r) => r.__status).sort();
    expect(statuses).toEqual(["added", "removed"]);
  });

  test("changedOnly keeps added/removed rows in toValueDiffGrid", () => {
    const joinedDf = createJoinedDataFrame(standardColumns, [
      [1, "Alice", 100, true, false], // removed
      [2, "Bob", 200, false, true], // added
    ]);

    const joinedResult = toValueDiffGrid(joinedDf, ["id"], {
      changedOnly: true,
    });

    // Both added and removed rows should remain
    expect(joinedResult.rows).toHaveLength(2);

    const statuses = joinedResult.rows.map((r) => r.__status).sort();
    expect(statuses).toEqual(["added", "removed"]);
  });
});
