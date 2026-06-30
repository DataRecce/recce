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

import type {
  ColumnType,
  DataFrame,
  RowData,
  RowObjectType,
} from "../../../api";
import {
  buildColumnMap,
  buildJoinedColumnMap,
  buildMergedColumnMap,
  type ColumnMapEntry,
  columnRenderedValue,
  determineRowStatus,
  formatSmartDecimal,
  getCellClass,
  getHeaderCellClass,
  getPrimaryKeyValue,
  isCellChanged,
  toRenderedValue,
  validatePrimaryKeys,
} from "../gridUtils";

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
 * DataFrame with in_a/in_b columns for joined data
 */
const joinedDataFrame = createDataFrame([
  { name: "id", key: "id", type: "integer" },
  { name: "value", key: "value", type: "number" },
  { name: "in_a", key: "in_a", type: "boolean" },
  { name: "in_b", key: "in_b", type: "boolean" },
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
  test("handles uppercase in_a/in_b columns", () => {
    const result = buildJoinedColumnMap(joinedDataFrame);

    expect(result.in_a).toBeDefined();
    expect(result.in_b).toBeDefined();
    expect(result.in_a.key).toBe("in_a");
    expect(result.in_b.key).toBe("in_b");
  });

  test("handles lowercase in_a/in_b columns", () => {
    const result = buildJoinedColumnMap(joinedDataFrameLowercase);

    expect(result.in_a).toBeDefined();
    expect(result.in_b).toBeDefined();
  });

  test("in_a and in_b entries reference same key", () => {
    const result = buildJoinedColumnMap(joinedDataFrame);

    // Both should have same internal structure
    expect(result.in_a.colType).toBe("boolean");
    expect(result.in_b.colType).toBe("boolean");
  });

  test("regular columns added normally", () => {
    const result = buildJoinedColumnMap(joinedDataFrame);

    expect(result.id).toBeDefined();
    expect(result.id.colType).toBe("integer");
    expect(result.value).toBeDefined();
    expect(result.value.colType).toBe("number");
  });

  test("throws on empty DataFrame", () => {
    const emptyDf = createDataFrame([]);

    expect(() => {
      buildJoinedColumnMap(emptyDf);
    }).toThrow("Joined DataFrame missing required 'in_a' column");
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

    const [renderedValue, grayOut] = toRenderedValue(row, "value", "number", 2);

    expect(renderedValue).toBe("123.45");
    expect(grayOut).toBe(false);
  });

  test("returns dash for undefined values", () => {
    const row = createRow({});

    const [renderedValue, grayOut] = toRenderedValue(row, "missing");

    expect(renderedValue).toBe("-");
    expect(grayOut).toBe(true);
  });
});

// ============================================================================
// formatSmartDecimal Tests
// ============================================================================

describe("formatSmartDecimal", () => {
  // Import at top of file: import { formatSmartDecimal } from "./gridUtils";

  describe("basic formatting", () => {
    test("formats integer without trailing zeros", () => {
      expect(formatSmartDecimal(123)).toBe("123");
    });

    test("formats integer with decimal places specified", () => {
      expect(formatSmartDecimal(123, 2)).toBe("123");
    });

    test("formats number with fewer decimals than max", () => {
      expect(formatSmartDecimal(123.4, 2)).toBe("123.4");
    });

    test("rounds number with more decimals than max", () => {
      expect(formatSmartDecimal(123.456, 2)).toBe("123.46");
    });

    test("rounds to nearest even on .5 (banker's rounding)", () => {
      // Intl.NumberFormat uses "halfEven" rounding by default
      expect(formatSmartDecimal(123.445, 2)).toBe("123.44");
      expect(formatSmartDecimal(123.455, 2)).toBe("123.46");
    });

    test("formats with custom maxDecimals", () => {
      expect(formatSmartDecimal(123.456789, 4)).toBe("123.4568");
    });

    test("defaults to 2 decimal places", () => {
      expect(formatSmartDecimal(123.456)).toBe("123.46");
    });
  });

  describe("zero handling", () => {
    test("formats zero", () => {
      expect(formatSmartDecimal(0)).toBe("0");
    });

    test("normalizes negative zero to zero", () => {
      expect(formatSmartDecimal(-0)).toBe("0");
    });

    test("formats zero with decimals", () => {
      expect(formatSmartDecimal(0.0, 2)).toBe("0");
    });
  });

  describe("negative numbers", () => {
    test("formats negative integer", () => {
      expect(formatSmartDecimal(-123)).toBe("-123");
    });

    test("formats negative decimal", () => {
      expect(formatSmartDecimal(-123.456, 2)).toBe("-123.46");
    });

    test("formats small negative number", () => {
      expect(formatSmartDecimal(-0.001, 2)).toBe("0");
    });

    test("formats small negative number with more precision", () => {
      expect(formatSmartDecimal(-0.001, 3)).toBe("-0.001");
    });
  });

  describe("large numbers", () => {
    test("formats large numbers with thousand separators", () => {
      expect(formatSmartDecimal(1234567)).toBe("1,234,567");
    });

    test("formats large decimal numbers", () => {
      expect(formatSmartDecimal(1234567.89, 2)).toBe("1,234,567.89");
    });

    test("handles Number.MAX_SAFE_INTEGER", () => {
      const result = formatSmartDecimal(Number.MAX_SAFE_INTEGER);
      expect(result).toBe("9,007,199,254,740,991");
    });
  });

  describe("small numbers", () => {
    test("formats small decimal", () => {
      expect(formatSmartDecimal(0.1, 2)).toBe("0.1");
    });

    test("formats very small decimal with appropriate precision", () => {
      expect(formatSmartDecimal(0.001, 3)).toBe("0.001");
    });

    test("rounds very small decimal to zero when maxDecimals is small", () => {
      expect(formatSmartDecimal(0.001, 2)).toBe("0");
    });
  });

  describe("edge cases", () => {
    test("formats with maxDecimals = 0", () => {
      expect(formatSmartDecimal(123.456, 0)).toBe("123");
    });

    test("formats with maxDecimals = 0 rounds correctly", () => {
      expect(formatSmartDecimal(123.567, 0)).toBe("124");
    });

    test("handles trailing zeros in input", () => {
      expect(formatSmartDecimal(123.4, 2)).toBe("123.4");
    });

    test("handles exact boundary rounding", () => {
      expect(formatSmartDecimal(0.995, 2)).toBe("1");
    });
  });

  describe("special numeric values", () => {
    test("formats NaN", () => {
      // NaN passed through formatNumber returns fallback String(value)
      expect(formatSmartDecimal(NaN)).toBe("NaN");
    });

    test("formats Infinity", () => {
      expect(formatSmartDecimal(Infinity)).toBe("∞");
    });

    test("formats negative Infinity", () => {
      expect(formatSmartDecimal(-Infinity)).toBe("-∞");
    });
  });
});

// ============================================================================
// isCellChanged Tests (DRC-3025: float-precision spurious diffs)
// ============================================================================

describe("isCellChanged", () => {
  describe("finite numbers — magnitude-relative epsilon (render-mode independent)", () => {
    test("AC1: 0.1 + 0.2 vs 0.3 → not changed (canonical float noise)", () => {
      expect(isCellChanged(0.1 + 0.2, 0.3)).toBe(false);
    });

    test("AC1: 3.14159 vs 3.14159 + 1e-12 → not changed", () => {
      expect(isCellChanged(3.14159, 3.14159 + 1e-12)).toBe(false);
    });

    test("AC2: 3.14 vs 3.15 → changed", () => {
      expect(isCellChanged(3.14, 3.15)).toBe(true);
    });

    test("AC2: 100.0 vs 100.5 → changed", () => {
      expect(isCellChanged(100.0, 100.5)).toBe(true);
    });

    test("integers: equal → not changed, off-by-one → changed", () => {
      expect(isCellChanged(100, 100)).toBe(false);
      expect(isCellChanged(100, 101)).toBe(true);
    });
  });

  describe("near-zero floor (AC3)", () => {
    test("0 vs 0 → not changed", () => {
      expect(isCellChanged(0, 0)).toBe(false);
    });

    test("0 vs 1e-3 → changed (real small value, not noise)", () => {
      expect(isCellChanged(0, 1e-3)).toBe(true);
    });
  });

  describe("large magnitudes scale with relative epsilon", () => {
    test("1e9 vs 1e9 + 1 → not changed (within 1e-9 relative)", () => {
      expect(isCellChanged(1e9, 1e9 + 1)).toBe(false);
    });

    test("1e9 vs 1e9 + 10 → changed (beyond 1e-9 relative)", () => {
      expect(isCellChanged(1e9, 1e9 + 10)).toBe(true);
    });
  });

  describe("non-numeric keeps exact equality (AC4)", () => {
    test("different strings → changed", () => {
      expect(isCellChanged("abc", "abd")).toBe(true);
    });

    test("identical strings → not changed", () => {
      expect(isCellChanged("abc", "abc")).toBe(false);
    });

    test("booleans compared exactly", () => {
      expect(isCellChanged(true, false)).toBe(true);
      expect(isCellChanged(true, true)).toBe(false);
    });

    test("mixed type (number vs string) → changed", () => {
      expect(isCellChanged(5, "abc")).toBe(true);
      // A numeric string is NOT a number — exact equality applies.
      expect(isCellChanged(5, "5")).toBe(true);
    });
  });

  describe("null / undefined / NaN handling", () => {
    test("one-sided null → changed", () => {
      expect(isCellChanged(null, 42)).toBe(true);
      expect(isCellChanged(42, null)).toBe(true);
    });

    test("one-sided undefined → changed", () => {
      expect(isCellChanged(undefined, 42)).toBe(true);
    });

    test("both null/undefined → not changed", () => {
      expect(isCellChanged(null, null)).toBe(false);
      expect(isCellChanged(undefined, undefined)).toBe(false);
    });

    test("one-sided NaN → changed", () => {
      expect(isCellChanged(NaN, 5)).toBe(true);
    });

    test("both NaN → not changed", () => {
      expect(isCellChanged(NaN, NaN)).toBe(false);
    });
  });
});

// ============================================================================
// getCellClass — float-precision behavior (DRC-3025)
// ============================================================================

describe("getCellClass — float precision", () => {
  test("AC1: float noise (0.1 + 0.2 vs 0.3) → undefined (no highlight)", () => {
    const row = createRow({
      base__value: 0.1 + 0.2,
      current__value: 0.3,
    });
    expect(getCellClass(row, undefined, "value", false)).toBeUndefined();
  });

  test("AC2: genuine difference (3.14 vs 3.15) → highlighted", () => {
    const row = createRow({
      base__value: 3.14,
      current__value: 3.15,
    });
    expect(getCellClass(row, undefined, "value", false)).toBe(
      "diff-cell-added",
    );
  });

  test("AC4: non-numeric keeps exact equality", () => {
    const row = createRow({
      base__value: "abc",
      current__value: "abd",
    });
    expect(getCellClass(row, undefined, "value", false)).toBe(
      "diff-cell-added",
    );
  });
});

// ============================================================================
// determineRowStatus — float-precision behavior (DRC-3025)
// ============================================================================

describe("determineRowStatus — float precision", () => {
  const columnMap: Record<string, ColumnMapEntry> = {
    id: { key: "id", colType: "integer" },
    value: { key: "value", colType: "number" },
  };

  test("AC1: float noise (0.1 + 0.2 vs 0.3) → undefined (not modified)", () => {
    const baseRow = createRow({ id: 1, value: 0.1 + 0.2 });
    const currentRow = createRow({ id: 1, value: 0.3 });
    expect(
      determineRowStatus(baseRow, currentRow, columnMap, ["id"]),
    ).toBeUndefined();
  });

  test("AC2: genuine difference (3.14 vs 3.15) → 'modified'", () => {
    const baseRow = createRow({ id: 1, value: 3.14 });
    const currentRow = createRow({ id: 1, value: 3.15 });
    expect(determineRowStatus(baseRow, currentRow, columnMap, ["id"])).toBe(
      "modified",
    );
  });
});
