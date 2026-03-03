/**
 * @file rowBuilders.test.ts
 * @description Tests for shared row building utilities
 *
 * Tests cover:
 * - buildDiffRows main function
 * - Row status detection (added, removed, modified, unchanged)
 * - Row value population (base__/current__ prefixing)
 * - Primary key handling (stored without prefix)
 * - Case-insensitive matching
 * - changedOnly filtering
 * - Column mutation for modified detection
 * - ColumnMapEntry vs MergeColumnMapEntry handling
 */

import type { ColumnType, DataFrame, RowObjectType } from "../../../api";
import type { ColumnMapEntry, MergeColumnMapEntry } from "../gridUtils";
import { buildDiffRows, type DiffColumnMapEntry } from "../rowBuilders";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Helper to create a valid RowObjectType with required __status
 */
const createRow = (
  values: Record<string, number | string | boolean | null | undefined>,
  status: "added" | "removed" | "modified" | undefined = undefined,
  index?: number,
): RowObjectType => ({
  ...values,
  __status: status,
  _index: index,
});

/**
 * Creates a ColumnMapEntry (used by valuediff/joined data)
 */
const createColumnMapEntry = (
  key: string,
  colType: ColumnType = "text",
  status?: string,
  index?: number,
): ColumnMapEntry => ({
  key,
  colType,
  status,
  index,
});

/**
 * Creates a MergeColumnMapEntry (used by querydiff/separate DataFrames)
 */
const createMergeColumnMapEntry = (
  key: string,
  colType: ColumnType = "text",
  status?: string,
  baseColumnKey?: string,
  currentColumnKey?: string,
): MergeColumnMapEntry => ({
  key,
  colType,
  status,
  baseColumnKey: baseColumnKey ?? key,
  currentColumnKey: currentColumnKey ?? key,
});

/**
 * Standard columns for testing
 */
const standardColumns: DataFrame["columns"] = [
  { name: "id", key: "id", type: "integer" },
  { name: "name", key: "name", type: "text" },
  { name: "value", key: "value", type: "number" },
];

// ============================================================================
// buildDiffRows - Basic Row Status Tests
// ============================================================================

describe("buildDiffRows", () => {
  describe("row status detection", () => {
    test("detects added rows (only in currentMap)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {};
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("added");
      expect(result.rowStats.added).toBe(1);
      expect(result.rowStats.removed).toBe(0);
      expect(result.rowStats.modified).toBe(0);
    });

    test("detects removed rows (only in baseMap)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {};

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("removed");
      expect(result.rowStats.added).toBe(0);
      expect(result.rowStats.removed).toBe(1);
      expect(result.rowStats.modified).toBe(0);
    });

    test("detects modified rows (values differ)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 200 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBe("modified");
      expect(result.rowStats.modified).toBe(1);
    });

    test("detects unchanged rows (identical values)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].__status).toBeUndefined();
      expect(result.rowStats.added).toBe(0);
      expect(result.rowStats.removed).toBe(0);
      expect(result.rowStats.modified).toBe(0);
    });

    test("handles multiple rows with mixed statuses", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
        "2": createRow({ id: 2, name: "Bob", value: 200 }, undefined, 2),
        "3": createRow({ id: 3, name: "Charlie", value: 300 }, undefined, 3),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1), // unchanged
        "2": createRow({ id: 2, name: "Bob", value: 250 }, undefined, 2), // modified
        "4": createRow({ id: 4, name: "Dave", value: 400 }, undefined, 4), // added
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows).toHaveLength(4);
      expect(result.rowStats.added).toBe(1);
      expect(result.rowStats.removed).toBe(1);
      expect(result.rowStats.modified).toBe(1);

      const addedRow = result.rows.find((r) => r.__status === "added");
      const removedRow = result.rows.find((r) => r.__status === "removed");
      const modifiedRow = result.rows.find((r) => r.__status === "modified");
      const unchangedRow = result.rows.find((r) => r.__status === undefined);

      expect(addedRow).toBeDefined();
      expect(removedRow).toBeDefined();
      expect(modifiedRow).toBeDefined();
      expect(unchangedRow).toBeDefined();
    });
  });

  // ============================================================================
  // Row Value Population Tests
  // ============================================================================

  describe("row value population", () => {
    test("stores primary key columns without prefix", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      const row = result.rows[0];
      // Primary key stored directly (lowercased)
      expect(row.id).toBe(1);
      // Should NOT have prefixed versions for PK
      expect(row.base__id).toBeUndefined();
      expect(row.current__id).toBeUndefined();
    });

    test("stores non-PK columns with base__/current__ prefix (lowercased)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Bob", value: 200 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      const row = result.rows[0];
      expect(row.base__name).toBe("Alice");
      expect(row.current__name).toBe("Bob");
      expect(row.base__value).toBe(100);
      expect(row.current__value).toBe(200);
    });

    test("handles rows only in base (removed)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {};

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      const row = result.rows[0];
      expect(row.id).toBe(1);
      expect(row.base__name).toBe("Alice");
      expect(row.base__value).toBe(100);
      // Current values should be undefined for removed rows
      expect(row.current__name).toBeUndefined();
      expect(row.current__value).toBeUndefined();
    });

    test("handles rows only in current (added)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {};
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      const row = result.rows[0];
      expect(row.id).toBe(1);
      expect(row.current__name).toBe("Alice");
      expect(row.current__value).toBe(100);
      // Base values should be undefined for added rows
      expect(row.base__name).toBeUndefined();
      expect(row.base__value).toBeUndefined();
    });

    test("sets _index from keyToNumber conversion", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "42": createRow({ id: 42, name: "Alice" }, undefined, 42),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "42": createRow({ id: 42, name: "Alice" }, undefined, 42),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns.slice(0, 2),
        currentColumns: standardColumns.slice(0, 2),
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows[0]._index).toBe(42);
    });
  });

  // ============================================================================
  // changedOnly Filter Tests
  // ============================================================================

  describe("changedOnly filtering", () => {
    test("filters out unchanged rows when changedOnly is true", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
        "2": createRow({ id: 2, name: "Bob", value: 200 }, undefined, 2),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1), // unchanged
        "2": createRow({ id: 2, name: "Bob", value: 250 }, undefined, 2), // modified
        "3": createRow({ id: 3, name: "Charlie", value: 300 }, undefined, 3), // added
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
        changedOnly: true,
      });

      // Should only have modified and added rows
      expect(result.rows).toHaveLength(2);
      expect(result.rows.every((r) => r.__status !== undefined)).toBe(true);
    });

    test("includes all rows when changedOnly is false", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
        "2": createRow({ id: 2, name: "Bob", value: 200 }, undefined, 2),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
        "2": createRow({ id: 2, name: "Bob", value: 250 }, undefined, 2),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
        changedOnly: false,
      });

      expect(result.rows).toHaveLength(2);
    });

    test("returns empty array when all rows unchanged and changedOnly is true", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
        changedOnly: true,
      });

      expect(result.rows).toHaveLength(0);
    });
  });

  // ============================================================================
  // Case-Insensitive Matching Tests
  // ============================================================================

  describe("case matching", () => {
    test("uses exact matching", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice" }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice" }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns.slice(0, 2),
        currentColumns: standardColumns.slice(0, 2),
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows[0].id).toBe(1);
      expect(result.rows[0].__status).toBeUndefined();
    });
  });

  // ============================================================================
  // Column Map Mutation Tests
  // ============================================================================

  describe("column map mutation", () => {
    test("mutates columnMap to mark modified columns", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 200 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      // value column should be marked as modified
      expect(columnMap.value.status).toBe("modified");
      // name column should not be modified
      expect(columnMap.name.status).toBeUndefined();
    });

    test("does not mark primary key columns as modified", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice" }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Bob" }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
      };

      buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns.slice(0, 2),
        currentColumns: standardColumns.slice(0, 2),
        columnMap,
        primaryKeys: ["id"],
      });

      // PK column should not be marked
      expect(columnMap.id.status).toBeUndefined();
      // Non-PK column that changed should be marked
      expect(columnMap.name.status).toBe("modified");
    });

    test("skips index column when detecting modifications", () => {
      const columnsWithIndex: DataFrame["columns"] = [
        { name: "index", key: "index", type: "integer" },
        { name: "id", key: "id", type: "integer" },
        { name: "name", key: "name", type: "text" },
      ];

      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ index: 0, id: 1, name: "Alice" }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ index: 5, id: 1, name: "Alice" }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        index: createColumnMapEntry("index", "integer"),
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: columnsWithIndex,
        currentColumns: columnsWithIndex,
        columnMap,
        primaryKeys: ["id"],
      });

      // Row should NOT be marked as modified because index is ignored
      expect(result.rows[0].__status).toBeUndefined();
      expect(columnMap.index.status).toBeUndefined();
    });
  });

  // ============================================================================
  // MergeColumnMapEntry Tests (querydiff scenario)
  // ============================================================================

  describe("MergeColumnMapEntry handling", () => {
    test("uses baseColumnKey and currentColumnKey for comparison", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, old_name: "Alice" }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, new_name: "Bob" }, undefined, 1),
      };

      // MergeColumnMapEntry with different base/current keys
      const columnMap: Record<string, MergeColumnMapEntry> = {
        id: createMergeColumnMapEntry("id", "integer"),
        name: createMergeColumnMapEntry(
          "name",
          "text",
          undefined,
          "old_name",
          "new_name",
        ),
      };

      const baseColumns: DataFrame["columns"] = [
        { name: "id", key: "id", type: "integer" },
        { name: "old_name", key: "old_name", type: "text" },
      ];
      const currentColumns: DataFrame["columns"] = [
        { name: "id", key: "id", type: "integer" },
        { name: "new_name", key: "new_name", type: "text" },
      ];

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns,
        currentColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows[0].__status).toBe("modified");
      expect(columnMap.name.status).toBe("modified");
    });

    test("skips comparison when baseColumnKey is 'unknown' (added column)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, new_col: "value" }, undefined, 1),
      };

      const columnMap: Record<string, MergeColumnMapEntry> = {
        id: createMergeColumnMapEntry("id", "integer"),
        new_col: createMergeColumnMapEntry(
          "new_col",
          "text",
          "added",
          "unknown", // base doesn't have this column
          "new_col",
        ),
      };

      const baseColumns: DataFrame["columns"] = [
        { name: "id", key: "id", type: "integer" },
      ];
      const currentColumns: DataFrame["columns"] = [
        { name: "id", key: "id", type: "integer" },
        { name: "new_col", key: "new_col", type: "text" },
      ];

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns,
        currentColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      // Should not be marked as modified because the column is added
      expect(result.rows[0].__status).toBeUndefined();
    });

    test("skips comparison when currentColumnKey is 'unknown' (removed column)", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, old_col: "value" }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1 }, undefined, 1),
      };

      const columnMap: Record<string, MergeColumnMapEntry> = {
        id: createMergeColumnMapEntry("id", "integer"),
        old_col: createMergeColumnMapEntry(
          "old_col",
          "text",
          "removed",
          "old_col",
          "unknown", // current doesn't have this column
        ),
      };

      const baseColumns: DataFrame["columns"] = [
        { name: "id", key: "id", type: "integer" },
        { name: "old_col", key: "old_col", type: "text" },
      ];
      const currentColumns: DataFrame["columns"] = [
        { name: "id", key: "id", type: "integer" },
      ];

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns,
        currentColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      // Should not be marked as modified because the column is removed
      expect(result.rows[0].__status).toBeUndefined();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("edge cases", () => {
    test("handles empty maps", () => {
      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
      };

      const result = buildDiffRows({
        baseMap: {},
        currentMap: {},
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows).toHaveLength(0);
      expect(result.rowStats).toEqual({ added: 0, removed: 0, modified: 0 });
    });

    test("handles null values in columns", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: null, value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: "Alice", value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows[0].__status).toBe("modified");
      expect(result.rows[0].base__name).toBeNull();
      expect(result.rows[0].current__name).toBe("Alice");
    });

    test("handles multiple primary keys", () => {
      const multiPkColumns: DataFrame["columns"] = [
        { name: "region", key: "region", type: "text" },
        { name: "product", key: "product", type: "text" },
        { name: "sales", key: "sales", type: "number" },
      ];

      const baseMap: Record<string, RowObjectType | undefined> = {
        "US|Widget": createRow(
          { region: "US", product: "Widget", sales: 100 },
          undefined,
          1,
        ),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "US|Widget": createRow(
          { region: "US", product: "Widget", sales: 150 },
          undefined,
          1,
        ),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        region: createColumnMapEntry("region", "text"),
        product: createColumnMapEntry("product", "text"),
        sales: createColumnMapEntry("sales", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: multiPkColumns,
        currentColumns: multiPkColumns,
        columnMap,
        primaryKeys: ["region", "product"],
      });

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].region).toBe("US");
      expect(result.rows[0].product).toBe("Widget");
      expect(result.rows[0].__status).toBe("modified");
    });

    test("handles undefined values in sourceRow", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: undefined, value: 100 }, undefined, 1),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "1": createRow({ id: 1, name: undefined, value: 100 }, undefined, 1),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        id: createColumnMapEntry("id", "integer"),
        name: createColumnMapEntry("name", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: standardColumns,
        currentColumns: standardColumns,
        columnMap,
        primaryKeys: ["id"],
      });

      expect(result.rows[0].__status).toBeUndefined();
      expect(result.rows[0].base__name).toBeUndefined();
      expect(result.rows[0].current__name).toBeUndefined();
    });

    test("handles non-numeric key strings", () => {
      const baseMap: Record<string, RowObjectType | undefined> = {
        "id=Alice|region=US": createRow(
          { name: "Alice", region: "US", value: 100 },
          undefined,
          1,
        ),
      };
      const currentMap: Record<string, RowObjectType | undefined> = {
        "id=Alice|region=US": createRow(
          { name: "Alice", region: "US", value: 200 },
          undefined,
          1,
        ),
      };

      const columnMap: Record<string, DiffColumnMapEntry> = {
        name: createColumnMapEntry("name", "text"),
        region: createColumnMapEntry("region", "text"),
        value: createColumnMapEntry("value", "number"),
      };

      const stringKeyColumns: DataFrame["columns"] = [
        { name: "name", key: "name", type: "text" },
        { name: "region", key: "region", type: "text" },
        { name: "value", key: "value", type: "number" },
      ];

      const result = buildDiffRows({
        baseMap,
        currentMap,
        baseColumns: stringKeyColumns,
        currentColumns: stringKeyColumns,
        columnMap,
        primaryKeys: ["name", "region"],
      });

      expect(result.rows).toHaveLength(1);
      // _index should be a hashed number for non-numeric keys
      expect(typeof result.rows[0]._index).toBe("number");
    });
  });
});
