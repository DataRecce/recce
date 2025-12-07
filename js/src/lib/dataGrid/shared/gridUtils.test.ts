/**
 * @file gridUtils.test.ts
 * @description Tests for shared grid utilities
 *
 * Tests cover:
 * - Column map builders (buildColumnMap, buildJoinedColumnMap, buildMergedColumnMap)
 * - Primary key utilities (validatePrimaryKeys, getPrimaryKeyValue)
 * - Row status detection (determineRowStatus)
 * - Cell class utilities (getCellClass, getHeaderCellClass)
 * - Value rendering (toRenderedValue, columnRenderedValue)
 */

import { ColumnType, DataFrame, RowData, RowObjectType } from "@/lib/api/types";
import {
  buildColumnMap,
  buildJoinedColumnMap,
  buildMergedColumnMap,
  ColumnMapEntry,
  columnRenderedValue,
  determineRowStatus,
  getCellClass,
  getHeaderCellClass,
  getPrimaryKeyValue,
  toRenderedValue,
  validatePrimaryKeys,
} from "./gridUtils";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a DataFrame for testing
 */
const createDataFrame = (
  columns: Array<{ name: string; key: string; type: ColumnType }>,
  data: RowData[] = [],
): DataFrame => ({
  columns,
  data,
});

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
 * Standard DataFrame fixture
 */
const standardDataFrame = createDataFrame([
  { name: "id", key: "id", type: "integer" },
  { name: "name", key: "name", type: "text" },
  { name: "value", key: "value", type: "number" },
]);

/**
 * DataFrame with IN_A/IN_B columns for joined data
 */
const joinedDataFrame = createDataFrame([
  { name: "id", key: "id", type: "integer" },
  { name: "value", key: "value", type: "number" },
  { name: "IN_A", key: "IN_A", type: "boolean" },
  { name: "IN_B", key: "IN_B", type: "boolean" },
]);

/**
 * DataFrame with lowercase in_a/in_b columns
 */
const joinedDataFrameLowercase = createDataFrame([
  { name: "id", key: "id", type: "integer" },
  { name: "value", key: "value", type: "number" },
  { name: "in_a", key: "in_a", type: "boolean" },
  { name: "in_b", key: "in_b", type: "boolean" },
]);

// ============================================================================
// buildColumnMap Tests
// ============================================================================

describe("buildColumnMap", () => {
  test("builds column map from DataFrame", () => {
    const result = buildColumnMap(standardDataFrame);

    expect(result).toEqual({
      id: { key: "id", colType: "integer", index: 0 },
      name: { key: "name", colType: "text", index: 1 },
      value: { key: "value", colType: "number", index: 2 },
    });
  });

  test("handles empty DataFrame", () => {
    const emptyDf = createDataFrame([]);

    const result = buildColumnMap(emptyDf);

    expect(result).toEqual({});
  });

  test("preserves column index", () => {
    const result = buildColumnMap(standardDataFrame);

    expect(result.id.index).toBe(0);
    expect(result.name.index).toBe(1);
    expect(result.value.index).toBe(2);
  });

  test("handles various column types", () => {
    const df = createDataFrame([
      { name: "bool_col", key: "bool_col", type: "boolean" },
      { name: "date_col", key: "date_col", type: "date" },
      { name: "unknown_col", key: "unknown_col", type: "unknown" },
    ]);

    const result = buildColumnMap(df);

    expect(result.bool_col.colType).toBe("boolean");
    expect(result.date_col.colType).toBe("date");
    expect(result.unknown_col.colType).toBe("unknown");
  });
});

// ============================================================================
// buildJoinedColumnMap Tests
// ============================================================================

describe("buildJoinedColumnMap", () => {
  test("handles uppercase IN_A/IN_B columns", () => {
    const result = buildJoinedColumnMap(joinedDataFrame);

    expect(result.IN_A).toBeDefined();
    expect(result.IN_B).toBeDefined();
    expect(result.IN_A.key).toBe("IN_A");
    expect(result.IN_B.key).toBe("IN_B");
  });

  test("handles lowercase in_a/in_b columns", () => {
    const result = buildJoinedColumnMap(joinedDataFrameLowercase);

    expect(result.in_a).toBeDefined();
    expect(result.in_b).toBeDefined();
  });

  test("IN_A and IN_B entries reference same key", () => {
    const result = buildJoinedColumnMap(joinedDataFrame);

    // Both should have same internal structure
    expect(result.IN_A.colType).toBe("boolean");
    expect(result.IN_B.colType).toBe("boolean");
  });

  test("regular columns added normally", () => {
    const result = buildJoinedColumnMap(joinedDataFrame);

    expect(result.id).toBeDefined();
    expect(result.id.colType).toBe("integer");
    expect(result.value).toBeDefined();
    expect(result.value.colType).toBe("number");
  });

  test("handles empty DataFrame", () => {
    const emptyDf = createDataFrame([]);

    const result = buildJoinedColumnMap(emptyDf);

    expect(result).toEqual({});
  });
});

// ============================================================================
// buildMergedColumnMap Tests
// ============================================================================

describe("buildMergedColumnMap", () => {
  test("merges columns from base and current", () => {
    const baseDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "name", key: "name", type: "text" },
    ]);
    const currentDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "name", key: "name", type: "text" },
    ]);

    const result = buildMergedColumnMap(baseDf, currentDf);

    expect(result.id).toBeDefined();
    expect(result.name).toBeDefined();
  });

  test("detects added columns", () => {
    const baseDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
    ]);
    const currentDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "new_col", key: "new_col", type: "text" },
    ]);

    const result = buildMergedColumnMap(baseDf, currentDf);

    expect(result.new_col).toBeDefined();
    expect(result.new_col.status).toBe("added");
  });

  test("detects removed columns", () => {
    const baseDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "old_col", key: "old_col", type: "text" },
    ]);
    const currentDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
    ]);

    const result = buildMergedColumnMap(baseDf, currentDf);

    expect(result.old_col).toBeDefined();
    expect(result.old_col.status).toBe("removed");
  });

  test("tracks baseColumnKey and currentColumnKey", () => {
    const baseDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "shared", key: "shared", type: "text" },
    ]);
    const currentDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "shared", key: "shared", type: "text" },
    ]);

    const result = buildMergedColumnMap(baseDf, currentDf);

    expect(result.shared.baseColumnKey).toBe("shared");
    expect(result.shared.currentColumnKey).toBe("shared");
  });

  test("uses 'unknown' for missing column keys", () => {
    const baseDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
    ]);
    const currentDf = createDataFrame([
      { name: "id", key: "id", type: "integer" },
      { name: "new_col", key: "new_col", type: "text" },
    ]);

    const result = buildMergedColumnMap(baseDf, currentDf);

    // Added column should have 'unknown' for baseColumnKey
    expect(result.new_col.baseColumnKey).toBe("unknown");
    expect(result.new_col.currentColumnKey).toBe("new_col");
  });

  test("handles empty DataFrames", () => {
    const emptyDf = createDataFrame([]);

    const result = buildMergedColumnMap(emptyDf, emptyDf);

    expect(result).toEqual({});
  });

  test("preserves column type", () => {
    const baseDf = createDataFrame([
      { name: "num", key: "num", type: "number" },
    ]);
    const currentDf = createDataFrame([
      { name: "num", key: "num", type: "number" },
    ]);

    const result = buildMergedColumnMap(baseDf, currentDf);

    expect(result.num.colType).toBe("number");
  });
});

// ============================================================================
// validatePrimaryKeys Tests
// ============================================================================

describe("validatePrimaryKeys", () => {
  test("validates existing primary keys", () => {
    const result = validatePrimaryKeys(standardDataFrame.columns, ["id"]);

    expect(result).toEqual(["id"]);
  });

  test("validates multiple primary keys", () => {
    const result = validatePrimaryKeys(standardDataFrame.columns, [
      "id",
      "name",
    ]);

    expect(result).toEqual(["id", "name"]);
  });

  test("throws error for missing primary key", () => {
    expect(() => {
      validatePrimaryKeys(standardDataFrame.columns, ["nonexistent"]);
    }).toThrow("Column nonexistent not found");
  });

  test("case-sensitive matching by default", () => {
    expect(() => {
      validatePrimaryKeys(standardDataFrame.columns, ["ID"]);
    }).toThrow("Column ID not found");
  });

  test("case-insensitive matching when enabled", () => {
    const result = validatePrimaryKeys(
      standardDataFrame.columns,
      ["ID"],
      true, // caseInsensitive
    );

    expect(result).toEqual(["id"]);
  });

  test("returns actual column keys", () => {
    const df = createDataFrame([
      { name: "UserId", key: "user_id", type: "integer" },
    ]);

    const result = validatePrimaryKeys(df.columns, ["user_id"]);

    expect(result).toEqual(["user_id"]);
  });

  test("handles empty primary keys array", () => {
    const result = validatePrimaryKeys(standardDataFrame.columns, []);

    expect(result).toEqual([]);
  });
});

// ============================================================================
// getPrimaryKeyValue Tests
// ============================================================================

describe("getPrimaryKeyValue", () => {
  test("generates key from single primary key", () => {
    const row = createRow({ id: 1, name: "Alice", value: 100 });

    const result = getPrimaryKeyValue(standardDataFrame.columns, ["id"], row);

    expect(result).toBe("id=1");
  });

  test("generates key from multiple primary keys", () => {
    const row = createRow({ id: 1, name: "Alice", value: 100 });

    const result = getPrimaryKeyValue(
      standardDataFrame.columns,
      ["id", "name"],
      row,
    );

    expect(result).toBe("id=1|name=Alice");
  });

  test("uses _index when no primary keys", () => {
    const row = createRow({ id: 1, name: "Alice", _index: 5 });

    const result = getPrimaryKeyValue(standardDataFrame.columns, [], row);

    expect(result).toBe("5");
  });

  test("handles null values", () => {
    const row = createRow({ id: null, name: "Alice", value: 100 });

    const result = getPrimaryKeyValue(standardDataFrame.columns, ["id"], row);

    expect(result).toBe("id=null");
  });

  test("case-insensitive key lookup when enabled", () => {
    const row = createRow({ ID: 1, name: "Alice", value: 100 });

    const result = getPrimaryKeyValue(
      standardDataFrame.columns,
      ["id"],
      row,
      true, // caseInsensitive
    );

    expect(result).toBe("id=1");
  });

  test("throws error for missing primary key column", () => {
    const row = createRow({ id: 1, name: "Alice" });

    expect(() => {
      getPrimaryKeyValue(standardDataFrame.columns, ["nonexistent"], row);
    }).toThrow("Primary Column nonexistent not found");
  });
});

// ============================================================================
// determineRowStatus Tests
// ============================================================================

describe("determineRowStatus", () => {
  const columnMap: Record<string, ColumnMapEntry> = {
    id: { key: "id", colType: "integer" },
    name: { key: "name", colType: "text" },
    value: { key: "value", colType: "number" },
  };

  test("returns 'added' when baseRow is undefined", () => {
    const currentRow = createRow({ id: 1, name: "Alice" });

    const result = determineRowStatus(undefined, currentRow, columnMap, ["id"]);

    expect(result).toBe("added");
  });

  test("returns 'removed' when currentRow is undefined", () => {
    const baseRow = createRow({ id: 1, name: "Alice" });

    const result = determineRowStatus(baseRow, undefined, columnMap, ["id"]);

    expect(result).toBe("removed");
  });

  test("returns 'modified' when values differ", () => {
    const baseRow = createRow({ id: 1, name: "Alice", value: 100 });
    const currentRow = createRow({ id: 1, name: "Alice", value: 200 });

    const result = determineRowStatus(baseRow, currentRow, columnMap, ["id"]);

    expect(result).toBe("modified");
  });

  test("returns undefined when rows are identical", () => {
    const baseRow = createRow({ id: 1, name: "Alice", value: 100 });
    const currentRow = createRow({ id: 1, name: "Alice", value: 100 });

    const result = determineRowStatus(baseRow, currentRow, columnMap, ["id"]);

    expect(result).toBeUndefined();
  });

  test("ignores primary key columns when comparing", () => {
    const baseRow = createRow({ id: 1, name: "Alice" });
    const currentRow = createRow({ id: 1, name: "Alice" });

    const result = determineRowStatus(baseRow, currentRow, columnMap, [
      "id",
      "name",
    ]);

    expect(result).toBeUndefined();
  });

  test("case-insensitive column matching when enabled", () => {
    const baseRow = createRow({ ID: 1, NAME: "Alice" });
    const currentRow = createRow({ id: 1, name: "Bob" });

    const result = determineRowStatus(
      baseRow,
      currentRow,
      columnMap,
      ["id"],
      true, // caseInsensitive
    );

    expect(result).toBe("modified");
  });

  test("ignores 'index' column", () => {
    const columnMapWithIndex: Record<string, ColumnMapEntry> = {
      ...columnMap,
      index: { key: "index", colType: "integer" },
    };
    const baseRow = createRow({ id: 1, name: "Alice", index: 0 });
    const currentRow = createRow({ id: 1, name: "Alice", index: 5 });

    const result = determineRowStatus(baseRow, currentRow, columnMapWithIndex, [
      "id",
    ]);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// getCellClass Tests
// ============================================================================

describe("getCellClass", () => {
  test("returns 'diff-cell-removed' for removed row", () => {
    const row = createRow({}, "removed");

    const result = getCellClass(row, undefined, "value", false);

    expect(result).toBe("diff-cell-removed");
  });

  test("returns 'diff-cell-added' for added row", () => {
    const row = createRow({}, "added");

    const result = getCellClass(row, undefined, "value", false);

    expect(result).toBe("diff-cell-added");
  });

  test("returns undefined for added column status", () => {
    const row = createRow({});

    const result = getCellClass(row, "added", "value", false);

    expect(result).toBeUndefined();
  });

  test("returns undefined for removed column status", () => {
    const row = createRow({});

    const result = getCellClass(row, "removed", "value", false);

    expect(result).toBeUndefined();
  });

  test("returns 'diff-cell-removed' for base column when values differ", () => {
    const row = createRow({
      base__value: 100,
      current__value: 200,
    });

    const result = getCellClass(row, undefined, "value", true);

    expect(result).toBe("diff-cell-removed");
  });

  test("returns 'diff-cell-added' for current column when values differ", () => {
    const row = createRow({
      base__value: 100,
      current__value: 200,
    });

    const result = getCellClass(row, undefined, "value", false);

    expect(result).toBe("diff-cell-added");
  });

  test("returns undefined when base and current are equal", () => {
    const row = createRow({
      base__value: 100,
      current__value: 100,
    });

    const result = getCellClass(row, undefined, "value", false);

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// getHeaderCellClass Tests
// ============================================================================

describe("getHeaderCellClass", () => {
  test("returns 'diff-header-added' for added status", () => {
    const result = getHeaderCellClass("added");

    expect(result).toBe("diff-header-added");
  });

  test("returns 'diff-header-removed' for removed status", () => {
    const result = getHeaderCellClass("removed");

    expect(result).toBe("diff-header-removed");
  });

  test("returns undefined for empty status", () => {
    const result = getHeaderCellClass("");

    expect(result).toBeUndefined();
  });

  test("returns undefined for other statuses", () => {
    const result = getHeaderCellClass("modified");

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// columnRenderedValue Tests
// ============================================================================

describe("columnRenderedValue", () => {
  test("returns value as-is for 'raw' mode", () => {
    const result = columnRenderedValue(123.456, "raw");

    expect(result).toBe("123.456");
  });

  test("formats as percentage for 'percent' mode", () => {
    const result = columnRenderedValue(0.5, "percent");

    expect(result).toBe("50%");
  });

  test("formats with decimal places for numeric mode", () => {
    const result = columnRenderedValue(123.456789, 2);

    expect(result).toBe("123.46");
  });

  test("handles zero decimal places", () => {
    const result = columnRenderedValue(123.456, 0);

    expect(result).toBe("123");
  });
});

// ============================================================================
// toRenderedValue Tests
// ============================================================================

describe("toRenderedValue", () => {
  test("returns dash for null values", () => {
    const row = createRow({ value: null });

    const [renderedValue, grayOut] = toRenderedValue(row, "value");

    expect(renderedValue).toBe("-");
    expect(grayOut).toBe(true);
  });

  test("returns (empty) for empty string values", () => {
    const row = createRow({ value: "" });

    const [renderedValue, grayOut] = toRenderedValue(row, "value");

    expect(renderedValue).toBe("(empty)");
    expect(grayOut).toBe(true);
  });

  test("formats boolean as string", () => {
    const row = createRow({ flag: true });

    const [renderedValue, grayOut] = toRenderedValue(row, "flag");

    expect(renderedValue).toBe("true");
    expect(grayOut).toBe(false);
  });

  test("formats numbers with render mode", () => {
    const row = createRow({ value: 0.5 });

    const [renderedValue, grayOut] = toRenderedValue(
      row,
      "value",
      "number",
      "percent",
    );

    expect(renderedValue).toBe("50%");
    expect(grayOut).toBe(false);
  });

  test("handles string values", () => {
    const row = createRow({ name: "Alice" });

    const [renderedValue, grayOut] = toRenderedValue(row, "name", "text");

    expect(renderedValue).toBe("Alice");
    expect(grayOut).toBe(false);
  });

  test("parses string as number when column type is number", () => {
    const row = createRow({ value: "123.45" });

    const [renderedValue, grayOut] = toRenderedValue(row, "value", "number", 1);

    expect(renderedValue).toBe("123.5");
    expect(grayOut).toBe(false);
  });

  test("returns dash for undefined values", () => {
    const row = createRow({});

    const [renderedValue, grayOut] = toRenderedValue(row, "missing");

    expect(renderedValue).toBe("-");
    expect(grayOut).toBe(true);
  });
});
