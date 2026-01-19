/**
 * @file validation.test.ts
 * @description Tests for input validation utilities
 *
 * Tests cover:
 * - DataGridValidationError class
 * - validateDataFrame: structure validation
 * - validateColumns: column schema validation
 * - validateColumnDataAlignment: row-column count matching
 * - validatePrimaryKeyConfig: PK validation with options
 * - Entry point validators: toDataGrid, toDataDiffGrid, toValueDiffGrid
 */

import type { ColumnType, DataFrame, RowData } from "../../../api";
import {
  DataGridValidationError,
  validateColumnDataAlignment,
  validateColumns,
  validateDataFrame,
  validatePrimaryKeyConfig,
  validateToDataDiffGridInputs,
  validateToDataGridInputs,
  validateToValueDiffGridInputs,
} from "../validation";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a valid DataFrame for testing
 */
const createValidDataFrame = (
  columns: Array<{ name: string; key: string; type: ColumnType }> = [
    { name: "id", key: "id", type: "integer" },
    { name: "value", key: "value", type: "text" },
  ],
  data: RowData[] = [
    [1, "a"],
    [2, "b"],
  ],
): DataFrame => ({
  columns,
  data,
});

/**
 * Creates a joined DataFrame with in_a/in_b columns
 */
const createJoinedDataFrame = (): DataFrame => ({
  columns: [
    { name: "id", key: "id", type: "integer" },
    { name: "value", key: "value", type: "text" },
    { name: "in_a", key: "in_a", type: "boolean" },
    { name: "in_b", key: "in_b", type: "boolean" },
  ],
  data: [[1, "test", true, true]],
});

// ============================================================================
// DataGridValidationError Tests
// ============================================================================

describe("DataGridValidationError", () => {
  test("creates error with message only", () => {
    const error = new DataGridValidationError("Test message");

    expect(error.message).toBe("Test message");
    expect(error.name).toBe("DataGridValidationError");
    expect(error.context).toBeUndefined();
    expect(error.details).toBeUndefined();
  });

  test("creates error with context", () => {
    const error = new DataGridValidationError("Test message", "base");

    expect(error.message).toBe("[base] Test message");
    expect(error.context).toBe("base");
  });

  test("creates error with details", () => {
    const error = new DataGridValidationError("Test message", "context", {
      foo: "bar",
    });

    expect(error.details).toEqual({ foo: "bar" });
  });

  test("is instanceof Error", () => {
    const error = new DataGridValidationError("Test");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DataGridValidationError);
  });
});

// ============================================================================
// validateDataFrame Tests
// ============================================================================

describe("validateDataFrame", () => {
  test("accepts valid DataFrame", () => {
    const df = createValidDataFrame();

    expect(() => validateDataFrame(df)).not.toThrow();
  });

  test("accepts undefined (represents empty data)", () => {
    expect(() => validateDataFrame(undefined)).not.toThrow();
  });

  test("accepts null (represents empty data)", () => {
    expect(() => validateDataFrame(null)).not.toThrow();
  });

  test("rejects non-object", () => {
    expect(() => validateDataFrame("string" as unknown as DataFrame)).toThrow(
      DataGridValidationError,
    );
    expect(() => validateDataFrame("string" as unknown as DataFrame)).toThrow(
      "Expected an object",
    );
  });

  test("rejects missing columns property", () => {
    const invalid = { data: [] } as unknown as DataFrame;

    expect(() => validateDataFrame(invalid)).toThrow(
      "Missing 'columns' property",
    );
  });

  test("rejects non-array columns", () => {
    const invalid = { columns: {}, data: [] } as unknown as DataFrame;

    expect(() => validateDataFrame(invalid)).toThrow(
      "'columns' must be an array",
    );
  });

  test("rejects missing data property", () => {
    const invalid = { columns: [] } as unknown as DataFrame;

    expect(() => validateDataFrame(invalid)).toThrow("Missing 'data' property");
  });

  test("rejects non-array data", () => {
    const invalid = { columns: [], data: {} } as unknown as DataFrame;

    expect(() => validateDataFrame(invalid)).toThrow("'data' must be an array");
  });

  test("includes context name in error message", () => {
    const invalid = { data: [] } as unknown as DataFrame;

    expect(() => validateDataFrame(invalid, "base")).toThrow("[base]");
  });

  test("accepts empty columns and data arrays", () => {
    const df: DataFrame = { columns: [], data: [] };

    expect(() => validateDataFrame(df)).not.toThrow();
  });
});

// ============================================================================
// validateColumns Tests
// ============================================================================

describe("validateColumns", () => {
  test("accepts valid columns", () => {
    const columns = [
      { name: "id", key: "id", type: "integer" as ColumnType },
      { name: "value", key: "value", type: "text" as ColumnType },
    ];

    expect(() => validateColumns(columns)).not.toThrow();
  });

  test("rejects null column", () => {
    const columns = [null] as unknown as DataFrame["columns"];

    expect(() => validateColumns(columns)).toThrow(
      "Column at index 0 is not an object",
    );
  });

  test("rejects column with missing key", () => {
    const columns = [
      { name: "test", type: "text" },
    ] as unknown as DataFrame["columns"];

    expect(() => validateColumns(columns)).toThrow("invalid 'key'");
  });

  test("rejects column with empty key", () => {
    const columns = [
      { name: "test", key: "", type: "text" },
    ] as unknown as DataFrame["columns"];

    expect(() => validateColumns(columns)).toThrow("invalid 'key'");
  });

  test("rejects column with non-string name", () => {
    const columns = [
      { key: "test", name: 123, type: "text" },
    ] as unknown as DataFrame["columns"];

    expect(() => validateColumns(columns)).toThrow("invalid 'name'");
  });

  test("rejects column with missing type", () => {
    const columns = [
      { key: "test", name: "test" },
    ] as unknown as DataFrame["columns"];

    expect(() => validateColumns(columns)).toThrow("invalid 'type'");
  });

  test("error includes column key when available", () => {
    const columns = [
      { key: "my_column", name: 123, type: "text" },
    ] as unknown as DataFrame["columns"];

    expect(() => validateColumns(columns)).toThrow("my_column");
  });

  test("accepts empty columns array", () => {
    expect(() => validateColumns([])).not.toThrow();
  });
});

// ============================================================================
// validateColumnDataAlignment Tests
// ============================================================================

describe("validateColumnDataAlignment", () => {
  test("accepts aligned data", () => {
    const df = createValidDataFrame();

    expect(() => validateColumnDataAlignment(df)).not.toThrow();
  });

  test("rejects row with too few values", () => {
    const df: DataFrame = {
      columns: [
        { name: "a", key: "a", type: "text" },
        { name: "b", key: "b", type: "text" },
      ],
      data: [["only_one"]],
    };

    expect(() => validateColumnDataAlignment(df)).toThrow(
      "Row 0 has 1 values but expected 2",
    );
  });

  test("rejects row with too many values", () => {
    const df: DataFrame = {
      columns: [{ name: "a", key: "a", type: "text" }],
      data: [["one", "two", "three"]],
    };

    expect(() => validateColumnDataAlignment(df)).toThrow(
      "Row 0 has 3 values but expected 1",
    );
  });

  test("rejects non-array row", () => {
    const df: DataFrame = {
      columns: [{ name: "a", key: "a", type: "text" }],
      data: ["not_an_array"] as unknown as RowData[],
    };

    expect(() => validateColumnDataAlignment(df)).toThrow(
      "Row at index 0 is not an array",
    );
  });

  test("reports correct row index for misalignment", () => {
    const df: DataFrame = {
      columns: [
        { name: "a", key: "a", type: "text" },
        { name: "b", key: "b", type: "text" },
      ],
      data: [
        ["a", "b"], // OK
        ["c", "d"], // OK
        ["e"], // Missing value
      ],
    };

    expect(() => validateColumnDataAlignment(df)).toThrow("Row 2");
  });

  test("error details include helpful information", () => {
    const df: DataFrame = {
      columns: [
        { name: "col1", key: "col1", type: "text" },
        { name: "col2", key: "col2", type: "text" },
      ],
      data: [["only_one"]],
    };

    try {
      validateColumnDataAlignment(df);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(DataGridValidationError);
      const error = e as DataGridValidationError;
      expect(error.details?.rowIndex).toBe(0);
      expect(error.details?.rowLength).toBe(1);
      expect(error.details?.columnCount).toBe(2);
      expect(error.details?.columns).toEqual(["col1", "col2"]);
    }
  });

  test("accepts empty data array", () => {
    const df: DataFrame = {
      columns: [{ name: "a", key: "a", type: "text" }],
      data: [],
    };

    expect(() => validateColumnDataAlignment(df)).not.toThrow();
  });
});

// ============================================================================
// validatePrimaryKeyConfig Tests
// ============================================================================

describe("validatePrimaryKeyConfig", () => {
  const columns: DataFrame["columns"] = [
    { name: "id", key: "id", type: "integer" },
    { name: "name", key: "name", type: "text" },
  ];

  test("accepts valid primary keys", () => {
    expect(() => validatePrimaryKeyConfig(["id"], columns)).not.toThrow();
  });

  test("accepts multiple primary keys", () => {
    expect(() =>
      validatePrimaryKeyConfig(["id", "name"], columns),
    ).not.toThrow();
  });

  test("accepts undefined when not required", () => {
    expect(() => validatePrimaryKeyConfig(undefined, columns)).not.toThrow();
  });

  test("accepts empty array when not required", () => {
    expect(() => validatePrimaryKeyConfig([], columns)).not.toThrow();
  });

  test("rejects empty array when required", () => {
    expect(() =>
      validatePrimaryKeyConfig([], columns, { required: true }),
    ).toThrow("Primary keys are required");
  });

  test("rejects undefined when required", () => {
    expect(() =>
      validatePrimaryKeyConfig(undefined, columns, { required: true }),
    ).toThrow("Primary keys are required");
  });

  test("rejects non-existent primary key", () => {
    expect(() => validatePrimaryKeyConfig(["nonexistent"], columns)).toThrow(
      "Primary key column 'nonexistent' not found",
    );
  });

  test("case-sensitive by default", () => {
    expect(() => validatePrimaryKeyConfig(["ID"], columns)).toThrow(
      "not found",
    );
  });

  test("case-insensitive when enabled", () => {
    expect(() =>
      validatePrimaryKeyConfig(["ID"], columns, { caseInsensitive: true }),
    ).not.toThrow();
  });

  test("rejects duplicate primary keys", () => {
    expect(() => validatePrimaryKeyConfig(["id", "id"], columns)).toThrow(
      "Duplicate primary key",
    );
  });

  test("rejects duplicate primary keys case-insensitively", () => {
    expect(() =>
      validatePrimaryKeyConfig(["id", "ID"], columns, {
        caseInsensitive: true,
      }),
    ).toThrow("Duplicate primary key");
  });

  test("error includes available columns", () => {
    try {
      validatePrimaryKeyConfig(["missing"], columns);
      expect.fail("Should have thrown");
    } catch (e) {
      const error = e as DataGridValidationError;
      expect(error.details?.availableColumns).toEqual(["id", "name"]);
    }
  });
});

// ============================================================================
// validateToDataGridInputs Tests
// ============================================================================

describe("validateToDataGridInputs", () => {
  test("accepts valid inputs", () => {
    const df = createValidDataFrame();

    expect(() => validateToDataGridInputs(df)).not.toThrow();
  });

  test("accepts undefined DataFrame", () => {
    expect(() => validateToDataGridInputs(undefined)).not.toThrow();
  });

  test("validates primary keys against DataFrame columns", () => {
    const df = createValidDataFrame();

    expect(() =>
      validateToDataGridInputs(df, { primaryKeys: ["id"] }),
    ).not.toThrow();

    expect(() =>
      validateToDataGridInputs(df, { primaryKeys: ["nonexistent"] }),
    ).toThrow("not found");
  });
});

// ============================================================================
// validateToDataDiffGridInputs Tests
// ============================================================================

describe("validateToDataDiffGridInputs", () => {
  test("accepts valid inputs", () => {
    const base = createValidDataFrame();
    const current = createValidDataFrame();

    expect(() => validateToDataDiffGridInputs(base, current)).not.toThrow();
  });

  test("accepts both undefined", () => {
    expect(() =>
      validateToDataDiffGridInputs(undefined, undefined),
    ).not.toThrow();
  });

  test("accepts one undefined", () => {
    const df = createValidDataFrame();

    expect(() => validateToDataDiffGridInputs(df, undefined)).not.toThrow();
    expect(() => validateToDataDiffGridInputs(undefined, df)).not.toThrow();
  });

  test("validates primary keys exist in at least one DataFrame", () => {
    const base = createValidDataFrame(
      [{ name: "id", key: "id", type: "integer" }],
      [[1]],
    );
    const current = createValidDataFrame(
      [{ name: "new_col", key: "new_col", type: "text" }],
      [["a"]],
    );

    // 'id' exists in base
    expect(() =>
      validateToDataDiffGridInputs(base, current, { primaryKeys: ["id"] }),
    ).not.toThrow();

    // 'new_col' exists in current
    expect(() =>
      validateToDataDiffGridInputs(base, current, { primaryKeys: ["new_col"] }),
    ).not.toThrow();

    // 'missing' exists in neither
    expect(() =>
      validateToDataDiffGridInputs(base, current, { primaryKeys: ["missing"] }),
    ).toThrow("not found in either");
  });
});

// ============================================================================
// validateToValueDiffGridInputs Tests
// ============================================================================

describe("validateToValueDiffGridInputs", () => {
  test("accepts valid joined DataFrame with primary keys", () => {
    const df = createJoinedDataFrame();

    expect(() => validateToValueDiffGridInputs(df, ["id"])).not.toThrow();
  });

  test("rejects empty primary keys", () => {
    const df = createJoinedDataFrame();

    expect(() => validateToValueDiffGridInputs(df, [])).toThrow(
      "Primary keys are required",
    );
  });

  test("rejects DataFrame without in_a column", () => {
    const df: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "in_b", key: "in_b", type: "boolean" },
      ],
      data: [[1, true]],
    };

    expect(() => validateToValueDiffGridInputs(df, ["id"])).toThrow(
      "Value diff DataFrame must include lowercase 'in_a' column",
    );
  });

  test("rejects DataFrame without in_b column", () => {
    const df: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "in_a", key: "in_a", type: "boolean" },
      ],
      data: [[1, true]],
    };

    expect(() => validateToValueDiffGridInputs(df, ["id"])).toThrow(
      "Value diff DataFrame must include lowercase 'in_b' column",
    );
  });

  test("accepts lowercase in_a/in_b columns", () => {
    const df: DataFrame = {
      columns: [
        { name: "id", key: "id", type: "integer" },
        { name: "in_a", key: "in_a", type: "boolean" },
        { name: "in_b", key: "in_b", type: "boolean" },
      ],
      data: [[1, true, true]],
    };

    expect(() => validateToValueDiffGridInputs(df, ["id"])).not.toThrow();
  });

  test("throws when case mismatches for primary key", () => {
    const df = createJoinedDataFrame();

    // Should NOT accept "ID" when the column is "id"
    expect(() => validateToValueDiffGridInputs(df, ["ID"])).toThrow(
      "[toValueDiffGrid] Primary key column 'ID' not found in columns",
    );
  });
});
