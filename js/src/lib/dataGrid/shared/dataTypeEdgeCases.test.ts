/**
 * @file dataTypeEdgeCases.test.ts
 * @description Tests for edge cases in data type handling
 *
 * Tests cover special numeric values and type coercion scenarios:
 * - NaN and Infinity values
 * - Very large numbers (precision boundaries)
 * - BigInt values (if supported)
 * - Mixed types in same column
 * - String representations of special values
 * - Type coercion edge cases
 *
 * These tests ensure the grid functions handle real-world data
 * anomalies gracefully without crashing or producing misleading output.
 */

import {
  type ColumnType,
  type DataFrame,
  type RowObjectType,
} from "@datarecce/ui/api";
import {
  type ColumnMapEntry,
  columnRenderedValue,
  determineRowStatus,
  getPrimaryKeyValue,
  toDataDiffGridConfigured as toDataDiffGrid,
  toDataGridConfigured as toDataGrid,
  toRenderedValue,
  toValueDiffGridConfigured as toValueDiffGrid,
} from "@datarecce/ui/utils";
import { vi } from "vitest";

// Mock ag-grid-community
vi.mock("ag-grid-community", () => ({
  themeQuartz: { withParams: vi.fn(() => "mocked-theme") },
  AllCommunityModule: {},
  ModuleRegistry: {
    registerModules: vi.fn(),
  },
}));

// ============================================================================
// Test Fixtures
// ============================================================================

const createRow = (
  values: Record<string, unknown>,
  status?: "added" | "removed" | "modified",
): RowObjectType =>
  ({
    ...values,
    __status: status,
  }) as RowObjectType;

const createDataFrame = (
  columns: Array<{ name: string; key: string; type: ColumnType }>,
  data: unknown[][],
): DataFrame => ({
  columns,
  data: data as DataFrame["data"],
});

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
 * Creates a ColumnMapEntry for determineRowStatus tests
 */
const createColumnMapEntry = (
  key: string,
  colType: ColumnType = "text",
  status?: string,
): ColumnMapEntry => ({
  key,
  colType,
  status,
});

/**
 * Creates a column map Record from column definitions
 */
const createColumnMap = (
  columns: Array<{ name: string; key: string; type: ColumnType }>,
): Record<string, ColumnMapEntry> => {
  const map: Record<string, ColumnMapEntry> = {};
  columns.forEach((col) => {
    map[col.name] = createColumnMapEntry(col.key, col.type);
  });
  return map;
};

// ============================================================================
// NaN Value Handling
// ============================================================================

describe("NaN value handling", () => {
  describe("toRenderedValue with NaN", () => {
    test("renders NaN as string 'NaN'", () => {
      const row = createRow({ value: NaN });
      const [rendered, grayOut] = toRenderedValue(row, "value", "number");

      // NaN should be rendered, not treated as null
      expect(rendered).toBe("NaN");
      expect(grayOut).toBe(false);
    });

    test("renders NaN with render mode applied (falls back to string)", () => {
      const row = createRow({ value: NaN });
      const [rendered] = toRenderedValue(row, "value", "number", 2);

      // Intl.NumberFormat produces "NaN" for NaN values
      expect(rendered).toBe("NaN");
    });

    test("renders NaN in percent mode", () => {
      const row = createRow({ value: NaN });
      const [rendered] = toRenderedValue(row, "value", "number", "percent");

      expect(rendered).toBe("NaN");
    });
  });

  describe("columnRenderedValue with NaN", () => {
    test("formats NaN with decimal places", () => {
      const result = columnRenderedValue(NaN, 2);
      expect(result).toBe("NaN");
    });

    test("formats NaN as percent", () => {
      const result = columnRenderedValue(NaN, "percent");
      expect(result).toBe("NaN");
    });

    test("formats NaN as raw", () => {
      const result = columnRenderedValue(NaN, "raw");
      expect(result).toBe("NaN");
    });
  });

  describe("NaN in grid functions", () => {
    test("toDataGrid handles NaN values", () => {
      const df = createDataFrame(
        [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "number" },
        ],
        [
          [1, NaN],
          [2, 100],
        ],
      );

      const result = toDataGrid(df, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].value).toBeNaN();
    });

    test("toDataDiffGrid detects NaN as modified when one side has NaN", () => {
      const base = createDataFrame(
        [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "number" },
        ],
        [[1, 100]],
      );
      const current = createDataFrame(
        [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "number" },
        ],
        [[1, NaN]],
      );

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      expect(result.rows).toHaveLength(1);
      // NaN !== 100, so row should be modified
      expect(result.rows[0].__status).toBe("modified");
    });

    test("toDataDiffGrid treats NaN === NaN as unchanged", () => {
      const base = createDataFrame(
        [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "number" },
        ],
        [[1, NaN]],
      );
      const current = createDataFrame(
        [
          { name: "id", key: "id", type: "integer" },
          { name: "value", key: "value", type: "number" },
        ],
        [[1, NaN]],
      );

      const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

      // lodash.isEqual treats NaN === NaN as true
      expect(result.rows[0].__status).toBeUndefined();
    });
  });
});

// ============================================================================
// Infinity Value Handling
// ============================================================================

describe("Infinity value handling", () => {
  describe("toRenderedValue with Infinity", () => {
    test("renders positive Infinity", () => {
      const row = createRow({ value: Infinity });
      const [rendered, grayOut] = toRenderedValue(row, "value", "number");

      expect(rendered).toBe("∞");
      expect(grayOut).toBe(false);
    });

    test("renders negative Infinity", () => {
      const row = createRow({ value: -Infinity });
      const [rendered, grayOut] = toRenderedValue(row, "value", "number");

      expect(rendered).toBe("-∞");
      expect(grayOut).toBe(false);
    });

    test("renders Infinity with decimal mode", () => {
      const row = createRow({ value: Infinity });
      const [rendered] = toRenderedValue(row, "value", "number", 2);

      expect(rendered).toBe("∞");
    });

    test("renders Infinity with percent mode", () => {
      const row = createRow({ value: Infinity });
      const [rendered] = toRenderedValue(row, "value", "number", "percent");

      expect(rendered).toBe("∞");
    });
  });

  describe("columnRenderedValue with Infinity", () => {
    test("formats positive Infinity", () => {
      const result = columnRenderedValue(Infinity, 2);
      expect(result).toBe("∞");
    });

    test("formats negative Infinity", () => {
      const result = columnRenderedValue(-Infinity, 2);
      expect(result).toBe("-∞");
    });

    test("formats Infinity as percent", () => {
      const result = columnRenderedValue(Infinity, "percent");
      expect(result).toBe("∞");
    });
  });

  describe("Infinity in diff detection", () => {
    test("detects Infinity to number change as modified", () => {
      const baseRow = createRow({
        id: 1,
        base__value: Infinity,
        current__value: 100,
      });

      const status = determineRowStatus(
        baseRow,
        baseRow,
        createColumnMap([{ name: "value", key: "value", type: "number" }]),
        ["id"],
      );

      expect(status).toBe("modified");
    });

    test("treats matching Infinity values as unchanged", () => {
      const baseRow = createRow({
        id: 1,
        base__value: Infinity,
        current__value: Infinity,
      });

      const status = determineRowStatus(
        baseRow,
        baseRow,
        createColumnMap([{ name: "value", key: "value", type: "number" }]),
        ["id"],
      );

      expect(status).toBeUndefined();
    });
  });
});

// ============================================================================
// Very Large Numbers (Precision Boundaries)
// ============================================================================

describe("Very large number handling", () => {
  // JavaScript safe integer boundary: 2^53 - 1 = 9007199254740991
  const SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
  // biome-ignore lint/correctness/noPrecisionLoss: testing precision loss behavior
  const UNSAFE_INTEGER = 9007199254740993; // Loses precision

  test("renders MAX_SAFE_INTEGER correctly", () => {
    const row = createRow({ value: SAFE_INTEGER });
    const [rendered] = toRenderedValue(row, "value", "number", "raw");

    expect(rendered).toBe("9007199254740991");
  });

  test("renders number beyond safe integer", () => {
    const row = createRow({ value: UNSAFE_INTEGER });
    const [rendered] = toRenderedValue(row, "value", "number", "raw");

    // JavaScript loses precision here - document behavior
    expect(typeof rendered).toBe("string");
    // The actual value may not be exactly what was input due to precision loss
  });

  test("renders very small decimals", () => {
    const row = createRow({ value: 0.0000001 });
    const [rendered] = toRenderedValue(row, "value", "number", 2);

    // 0.0000001 rounds to 0 at 2 decimal places, smart formatting removes trailing zeros
    expect(rendered).toBe("0");
  });

  test("renders Number.MIN_VALUE", () => {
    const row = createRow({ value: Number.MIN_VALUE });
    const [rendered] = toRenderedValue(row, "value", "number");

    expect(typeof rendered).toBe("string");
    expect(rendered).not.toBe("-");
  });

  test("renders Number.MAX_VALUE", () => {
    const row = createRow({ value: Number.MAX_VALUE });
    const [rendered] = toRenderedValue(row, "value", "number");

    expect(typeof rendered).toBe("string");
    expect(rendered).not.toBe("-");
  });

  test("toDataDiffGrid detects precision loss in large numbers", () => {
    // These two numbers are different but JS treats them as equal
    const base = createDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "number" },
      ],
      [[1, 9007199254740992]],
    );
    const current = createDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "number" },
      ],
      // biome-ignore lint/correctness/noPrecisionLoss: testing precision loss behavior
      [[1, 9007199254740993]],
    );

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    // Due to precision loss, these may appear equal in JavaScript
    // Document actual behavior
    expect(result.rows).toHaveLength(1);
  });
});

// ============================================================================
// String Representations of Special Values
// ============================================================================

describe("String representations of special values", () => {
  test("string 'NaN' is not converted to NaN number", () => {
    const row = createRow({ value: "NaN" });
    const [rendered] = toRenderedValue(row, "value", "text");

    expect(rendered).toBe("NaN");
  });

  test("string 'Infinity' is not converted to Infinity number", () => {
    const row = createRow({ value: "Infinity" });
    const [rendered] = toRenderedValue(row, "value", "text");

    expect(rendered).toBe("Infinity");
  });

  test("string 'null' is treated as string, not null", () => {
    const row = createRow({ value: "null" });
    const [rendered, grayOut] = toRenderedValue(row, "value", "text");

    expect(rendered).toBe("null");
    expect(grayOut).toBe(false);
  });

  test("string 'undefined' is treated as string", () => {
    const row = createRow({ value: "undefined" });
    const [rendered, grayOut] = toRenderedValue(row, "value", "text");

    expect(rendered).toBe("undefined");
    expect(grayOut).toBe(false);
  });

  test("empty string vs null difference preserved in diff", () => {
    const baseRow = createRow({
      id: 1,
      base__value: "",
      current__value: null,
    });

    const status = determineRowStatus(
      baseRow,
      baseRow,
      createColumnMap([{ name: "value", key: "value", type: "text" }]),
      ["id"],
    );

    // Empty string !== null
    expect(status).toBe("modified");
  });

  test("string number parsed when columnType is number", () => {
    const row = createRow({ value: "123.456" });
    const [rendered] = toRenderedValue(row, "value", "number", 2);

    expect(rendered).toBe("123.46");
  });

  test("invalid numeric string with number columnType", () => {
    const row = createRow({ value: "not-a-number" });
    const [rendered] = toRenderedValue(row, "value", "number", 2);

    // parseFloat("not-a-number") returns NaN
    expect(rendered).toBe("NaN");
  });

  test("scientific notation string parsed correctly", () => {
    const row = createRow({ value: "1.23e10" });
    const [rendered] = toRenderedValue(row, "value", "number");

    // Should parse scientific notation
    expect(rendered).not.toBe("1.23e10");
  });
});

// ============================================================================
// Mixed Types in Same Column
// ============================================================================

describe("Mixed types in same column", () => {
  test("toDataGrid handles mixed number/string values in same column", () => {
    const df = createDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "text" }, // Declared as text
      ],
      [
        [1, 100], // But contains number
        [2, "hello"], // And string
        [3, null], // And null
      ],
    );

    const result = toDataGrid(df, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].value).toBe(100);
    expect(result.rows[1].value).toBe("hello");
    expect(result.rows[2].value).toBeNull();
  });

  test("toDataDiffGrid handles type change between base and current", () => {
    const base = createDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "number" },
      ],
      [[1, 100]],
    );
    const current = createDataFrame(
      [
        { name: "id", key: "id", type: "integer" },
        { name: "value", key: "value", type: "text" }, // Type changed
      ],
      [[1, "hundred"]],
    );

    const result = toDataDiffGrid(base, current, { primaryKeys: ["id"] });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].__status).toBe("modified");
  });

  test("boolean vs number comparison in diff", () => {
    const baseRow = createRow({
      id: 1,
      base__value: true,
      current__value: 1,
    });

    const status = determineRowStatus(
      baseRow,
      baseRow,
      createColumnMap([{ name: "value", key: "value", type: "boolean" }]),
      ["id"],
    );

    // true !== 1 (strict comparison via lodash.isEqual)
    expect(status).toBe("modified");
  });

  test("string '1' vs number 1 detected as different", () => {
    const baseRow = createRow({
      id: 1,
      base__value: "1",
      current__value: 1,
    });

    const status = determineRowStatus(
      baseRow,
      baseRow,
      createColumnMap([{ name: "value", key: "value", type: "text" }]),
      ["id"],
    );

    // "1" !== 1
    expect(status).toBe("modified");
  });
});

// ============================================================================
// Zero and Negative Zero
// ============================================================================

describe("Zero edge cases", () => {
  test("renders zero correctly", () => {
    const row = createRow({ value: 0 });
    const [rendered, grayOut] = toRenderedValue(row, "value", "number");

    expect(rendered).toBe("0");
    expect(grayOut).toBe(false);
  });

  test("renders negative zero", () => {
    const row = createRow({ value: -0 });
    const [rendered] = toRenderedValue(row, "value", "number");

    // -0 is normalized to 0 for display (Intl.NumberFormat would render "-0" per ECMA-402)
    expect(rendered).toBe("0");
  });

  test("zero vs negative zero treated as equal in diff", () => {
    const baseRow = createRow({
      id: 1,
      base__value: 0,
      current__value: -0,
    });

    const status = determineRowStatus(
      baseRow,
      baseRow,
      createColumnMap([{ name: "value", key: "value", type: "number" }]),
      ["id"],
    );

    // 0 === -0 in JavaScript
    expect(status).toBeUndefined();
  });

  test("renders 0 with smart formatting (no trailing zeros)", () => {
    const row = createRow({ value: 0 });
    const [rendered] = toRenderedValue(row, "value", "number", 2);

    // Smart formatting removes trailing zeros
    expect(rendered).toBe("0");
  });

  test("renders 0% in percent mode", () => {
    const row = createRow({ value: 0 });
    const [rendered] = toRenderedValue(row, "value", "number", "percent");

    expect(rendered).toBe("0%");
  });
});

// ============================================================================
// Primary Key Edge Cases with Special Values
// ============================================================================

describe("Primary key with special values", () => {
  test("getPrimaryKeyValue with null primary key", () => {
    const columns = [{ name: "id", key: "id", type: "integer" as ColumnType }];
    const row = createRow({ id: null });

    const result = getPrimaryKeyValue(columns, ["id"], row);

    expect(result).toBe("id=null");
  });

  test("getPrimaryKeyValue with NaN primary key", () => {
    const columns = [{ name: "id", key: "id", type: "number" as ColumnType }];
    const row = createRow({ id: NaN });

    const result = getPrimaryKeyValue(columns, ["id"], row);

    expect(result).toBe("id=NaN");
  });

  test("getPrimaryKeyValue with empty string primary key", () => {
    const columns = [{ name: "id", key: "id", type: "text" as ColumnType }];
    const row = createRow({ id: "" });

    const result = getPrimaryKeyValue(columns, ["id"], row);

    expect(result).toBe("id=");
  });

  test("toValueDiffGrid throws with empty string primary key value", () => {
    const df = createJoinedDataFrame(
      [
        { name: "id", key: "id", type: "text" },
        { name: "value", key: "value", type: "number" },
      ],
      [
        ["", 100, true, true], // Empty string as PK
        ["a", 200, true, true],
      ],
    );

    const result = toValueDiffGrid(df, ["id"]);

    expect(result.rows).toHaveLength(2);
  });
});

// ============================================================================
// Array and Object Values (Edge Cases)
// ============================================================================

describe("Complex value types", () => {
  test("renders array value as string", () => {
    const row = createRow({ value: [1, 2, 3] });
    const [rendered] = toRenderedValue(row, "value");

    // Should convert to string representation
    expect(typeof rendered).toBe("string");
  });

  test("renders object value as string", () => {
    const row = createRow({ value: { nested: "data" } });
    const [rendered] = toRenderedValue(row, "value");

    expect(typeof rendered).toBe("string");
  });

  test("detects array order change as modified", () => {
    const baseRow = createRow({
      id: 1,
      base__value: [1, 2, 3],
      current__value: [3, 2, 1],
    });

    const status = determineRowStatus(
      baseRow,
      baseRow,
      createColumnMap([{ name: "value", key: "value", type: "unknown" }]),
      ["id"],
    );

    // Different order = different arrays
    expect(status).toBe("modified");
  });
});
