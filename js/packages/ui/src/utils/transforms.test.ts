/**
 * @file transforms.test.ts
 * @description Tests for @datarecce/ui transforms utilities
 *
 * Tests verify:
 * - dataFrameToRowObjects conversion
 * - keyToNumber parsing and hashing
 * - hashStringToNumber consistency
 * - getCaseInsensitive lookups
 * - getValueAtPath lookups
 */

import type { DataFrame, RowObjectType } from "../api";
import {
  dataFrameToRowObjects,
  getCaseInsensitive,
  getValueAtPath,
  hashStringToNumber,
  keyToNumber,
} from "./transforms";

// =============================================================================
// dataFrameToRowObjects Tests
// =============================================================================

describe("dataFrameToRowObjects", () => {
  it("converts empty DataFrame to empty array", () => {
    const df: DataFrame = {
      columns: [],
      data: [],
    };

    const result = dataFrameToRowObjects(df);

    expect(result).toEqual([]);
  });

  it("converts single row DataFrame", () => {
    const df: DataFrame = {
      columns: [
        { key: "name", name: "name", type: "text" },
        { key: "age", name: "age", type: "number" },
      ],
      data: [["Alice", 30]],
    };

    const result = dataFrameToRowObjects(df);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: "Alice",
      age: 30,
      __status: undefined,
      _index: 1,
    });
  });

  it("converts multiple row DataFrame", () => {
    const df: DataFrame = {
      columns: [
        { key: "id", name: "id", type: "number" },
        { key: "value", name: "value", type: "text" },
      ],
      data: [
        [1, "a"],
        [2, "b"],
        [3, "c"],
      ],
    };

    const result = dataFrameToRowObjects(df);

    expect(result).toHaveLength(3);
    expect(result[0]._index).toBe(1);
    expect(result[1]._index).toBe(2);
    expect(result[2]._index).toBe(3);
    expect(result[0].id).toBe(1);
    expect(result[1].value).toBe("b");
  });

  it("handles null values in data", () => {
    const df: DataFrame = {
      columns: [{ key: "col", name: "col", type: "text" }],
      data: [[null]],
    };

    const result = dataFrameToRowObjects(df);

    expect(result[0].col).toBeNull();
  });

  it("handles columns with extra metadata", () => {
    const df: DataFrame = {
      columns: [
        { key: "name", name: "Name", type: "text" },
        { key: "count", name: "Count", type: "number" },
      ],
      data: [["Test", 42]],
    };

    const result = dataFrameToRowObjects(df);

    expect(result[0].name).toBe("Test");
    expect(result[0].count).toBe(42);
  });

  it("always sets __status to undefined", () => {
    const df: DataFrame = {
      columns: [{ key: "a", name: "a", type: "number" }],
      data: [[1], [2], [3]],
    };

    const result = dataFrameToRowObjects(df);

    result.forEach((row) => {
      expect(row.__status).toBeUndefined();
    });
  });

  it("creates 1-based _index for each row", () => {
    const df: DataFrame = {
      columns: [{ key: "x", name: "x", type: "number" }],
      data: [[10], [20], [30], [40], [50]],
    };

    const result = dataFrameToRowObjects(df);

    expect(result.map((r) => r._index)).toEqual([1, 2, 3, 4, 5]);
  });
});

// =============================================================================
// keyToNumber Tests
// =============================================================================

describe("keyToNumber", () => {
  it("parses integer strings", () => {
    expect(keyToNumber("123")).toBe(123);
    expect(keyToNumber("0")).toBe(0);
    expect(keyToNumber("-42")).toBe(-42);
  });

  it("parses float strings", () => {
    expect(keyToNumber("3.14")).toBe(3.14);
    expect(keyToNumber("-0.5")).toBe(-0.5);
    expect(keyToNumber("1.0")).toBe(1.0);
  });

  it("parses scientific notation", () => {
    expect(keyToNumber("1e10")).toBe(1e10);
    expect(keyToNumber("2.5e-3")).toBe(0.0025);
  });

  it("hashes non-numeric strings", () => {
    const result = keyToNumber("hello");
    expect(typeof result).toBe("number");
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("returns consistent hash for same string", () => {
    const first = keyToNumber("test-key");
    const second = keyToNumber("test-key");
    expect(first).toBe(second);
  });

  it("returns different hashes for different strings", () => {
    const hash1 = keyToNumber("key1");
    const hash2 = keyToNumber("key2");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", () => {
    const result = keyToNumber("");
    expect(typeof result).toBe("number");
    expect(Number.isFinite(result)).toBe(true);
  });

  it("hashes Infinity string", () => {
    // "Infinity" as a string should be hashed, not parsed
    const result = keyToNumber("Infinity");
    expect(result).not.toBe(Number.POSITIVE_INFINITY);
    expect(Number.isFinite(result)).toBe(true);
  });

  it("hashes NaN string", () => {
    // "NaN" as a string should be hashed, not become NaN
    const result = keyToNumber("NaN");
    expect(Number.isNaN(result)).toBe(false);
    expect(Number.isFinite(result)).toBe(true);
  });
});

// =============================================================================
// hashStringToNumber Tests
// =============================================================================

describe("hashStringToNumber", () => {
  it("returns 0 for empty string", () => {
    expect(hashStringToNumber("")).toBe(0);
  });

  it("returns non-negative number", () => {
    const testStrings = ["a", "test", "Hello World", "!@#$%"];
    testStrings.forEach((str) => {
      expect(hashStringToNumber(str)).toBeGreaterThanOrEqual(0);
    });
  });

  it("returns consistent hash for same input", () => {
    const str = "consistent-input";
    expect(hashStringToNumber(str)).toBe(hashStringToNumber(str));
  });

  it("returns different hashes for different inputs", () => {
    const hash1 = hashStringToNumber("string1");
    const hash2 = hashStringToNumber("string2");
    expect(hash1).not.toBe(hash2);
  });

  it("handles unicode characters", () => {
    const result = hashStringToNumber("こんにちは");
    expect(typeof result).toBe("number");
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("handles very long strings", () => {
    const longString = "a".repeat(10000);
    const result = hashStringToNumber(longString);
    expect(typeof result).toBe("number");
    expect(Number.isFinite(result)).toBe(true);
  });

  it("returns integer values", () => {
    const testStrings = ["abc", "xyz", "123abc"];
    testStrings.forEach((str) => {
      const hash = hashStringToNumber(str);
      expect(Number.isInteger(hash)).toBe(true);
    });
  });
});

// =============================================================================
// getCaseInsensitive Tests
// =============================================================================

/**
 * Helper to create a RowObjectType for testing
 */
function createRowObject(props: Record<string, unknown>): RowObjectType {
  return {
    __status: undefined,
    ...props,
  } as RowObjectType;
}

describe("getCaseInsensitive", () => {
  it("finds lowercase key with lowercase search", () => {
    const obj = createRowObject({ name: "Alice" });
    expect(getCaseInsensitive(obj, "name")).toBe("Alice");
  });

  it("finds uppercase key with lowercase search", () => {
    const obj = createRowObject({ NAME: "Bob" });
    expect(getCaseInsensitive(obj, "name")).toBe("Bob");
  });

  it("finds mixed-case key with lowercase search", () => {
    const obj = createRowObject({ UserName: "Charlie" });
    expect(getCaseInsensitive(obj, "username")).toBe("Charlie");
  });

  it("finds key with uppercase search", () => {
    const obj = createRowObject({ name: "Dave" });
    expect(getCaseInsensitive(obj, "NAME")).toBe("Dave");
  });

  it("returns undefined for non-existent key", () => {
    const obj = createRowObject({ name: "Eve" });
    expect(getCaseInsensitive(obj, "age")).toBeUndefined();
  });

  it("handles empty object", () => {
    const obj = createRowObject({});
    expect(getCaseInsensitive(obj, "key")).toBeUndefined();
  });

  it("prefers lowercase key when both exist", () => {
    // When both 'name' and 'NAME' exist, lowercase should be preferred
    const obj = createRowObject({ name: "lower", NAME: "upper" });
    expect(getCaseInsensitive(obj, "name")).toBe("lower");
  });

  it("handles numeric values", () => {
    const obj = createRowObject({ Count: 42 });
    expect(getCaseInsensitive(obj, "count")).toBe(42);
  });

  it("handles null values", () => {
    const obj = createRowObject({ Value: null });
    expect(getCaseInsensitive(obj, "value")).toBeNull();
  });

  it("handles special row object properties", () => {
    const obj: RowObjectType = {
      __status: "added",
      _index: 5,
      data: "test",
    };
    expect(getCaseInsensitive(obj, "__status")).toBe("added");
    expect(getCaseInsensitive(obj, "_INDEX")).toBe(5);
  });
});

// =============================================================================
// getValueAtPath Tests
// =============================================================================

describe("getValueAtPath", () => {
  it("finds lowercase path in lowercase key", () => {
    const obj = { name: "Alice" };
    expect(getValueAtPath(obj, "name")).toBe("Alice");
  });

  it("finds lowercase path in uppercase key", () => {
    const obj = { NAME: "Bob" };
    expect(getValueAtPath(obj, "name")).toBe("Bob");
  });

  it("finds uppercase path in uppercase key", () => {
    const obj = { NAME: "Charlie" };
    expect(getValueAtPath(obj, "NAME")).toBe("Charlie");
  });

  it("finds exact match as fallback", () => {
    const obj = { MixedCase: "Dave" };
    expect(getValueAtPath(obj, "MixedCase")).toBe("Dave");
  });

  it("returns undefined for non-existent path", () => {
    const obj = { name: "Eve" };
    expect(getValueAtPath(obj, "age")).toBeUndefined();
  });

  it("handles empty object", () => {
    const obj = {};
    expect(getValueAtPath(obj, "key")).toBeUndefined();
  });

  it("handles numeric values", () => {
    const obj = { count: 100 };
    expect(getValueAtPath(obj, "COUNT")).toBe(100);
  });

  it("handles null values", () => {
    const obj = { value: null };
    expect(getValueAtPath(obj, "value")).toBeNull();
  });

  it("handles undefined values", () => {
    const obj: Record<string, string | undefined> = { value: undefined };
    expect(getValueAtPath(obj, "value")).toBeUndefined();
  });

  it("prefers lowercase match over uppercase", () => {
    const obj = { name: "lower", NAME: "upper" };
    expect(getValueAtPath(obj, "NaMe")).toBe("lower");
  });
});
