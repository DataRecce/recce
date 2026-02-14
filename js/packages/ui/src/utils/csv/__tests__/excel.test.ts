/**
 * Tests for Excel formatting utilities
 */
import * as XLSX from "xlsx";
import { toExcelBuffer } from "../excel";

/**
 * Helper to parse an Excel buffer back into columns and rows
 */
function parseExcelBuffer(buffer: Uint8Array): {
  columns: string[];
  rows: unknown[][];
} {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  if (jsonData.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = (jsonData[0] as unknown[]).map(String);
  const rows = jsonData.slice(1);

  return { columns, rows };
}

describe("toExcelBuffer", () => {
  describe("basic formatting", () => {
    test("should return an ArrayBuffer", () => {
      const columns = ["name", "age"];
      const rows = [["Alice", 30]];

      const result = toExcelBuffer(columns, rows);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test("should produce a valid Excel file with correct headers and data", () => {
      const columns = ["name", "age"];
      const rows = [
        ["Alice", 30],
        ["Bob", 25],
      ];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.columns).toEqual(["name", "age"]);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0]).toEqual(["Alice", 30]);
      expect(parsed.rows[1]).toEqual(["Bob", 25]);
    });

    test("should handle single column", () => {
      const columns = ["value"];
      const rows = [[1], [2], [3]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.columns).toEqual(["value"]);
      expect(parsed.rows).toEqual([[1], [2], [3]]);
    });

    test("should handle empty rows (headers only)", () => {
      const columns = ["col1", "col2"];
      const rows: unknown[][] = [];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.columns).toEqual(["col1", "col2"]);
      expect(parsed.rows).toHaveLength(0);
    });

    test("should create a single sheet named 'Sheet1'", () => {
      const columns = ["col"];
      const rows = [["data"]];

      const buffer = toExcelBuffer(columns, rows);
      const workbook = XLSX.read(buffer, { type: "array" });

      expect(workbook.SheetNames).toEqual(["Sheet1"]);
    });
  });

  describe("null and undefined handling", () => {
    test("should convert null to empty cell", () => {
      const columns = ["value"];
      const rows = [[null]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      // Null values should result in empty/undefined cells
      expect(parsed.rows).toHaveLength(1);
      expect(
        parsed.rows[0][0] === undefined || parsed.rows[0][0] === null,
      ).toBe(true);
    });

    test("should convert undefined to empty cell", () => {
      const columns = ["value"];
      const rows = [[undefined]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows).toHaveLength(1);
      expect(
        parsed.rows[0][0] === undefined || parsed.rows[0][0] === null,
      ).toBe(true);
    });

    test("should handle mixed null and values", () => {
      const columns = ["a", "b", "c"];
      const rows = [[1, null, 3]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe(1);
      expect(
        parsed.rows[0][1] === undefined || parsed.rows[0][1] === null,
      ).toBe(true);
      expect(parsed.rows[0][2]).toBe(3);
    });
  });

  describe("data type handling", () => {
    test("should preserve numbers as numbers", () => {
      const columns = ["num"];
      const rows = [[42], [3.14], [-100]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe(42);
      expect(parsed.rows[1][0]).toBe(3.14);
      expect(parsed.rows[2][0]).toBe(-100);
    });

    test("should preserve strings as strings", () => {
      const columns = ["text"];
      const rows = [["hello"], ["world"]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe("hello");
      expect(parsed.rows[1][0]).toBe("world");
    });

    test("should convert booleans to booleans", () => {
      const columns = ["bool"];
      const rows = [[true], [false]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe(true);
      expect(parsed.rows[1][0]).toBe(false);
    });

    test("should JSON stringify objects", () => {
      const columns = ["obj"];
      const rows = [[{ key: "value" }]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe('{"key":"value"}');
    });

    test("should JSON stringify arrays", () => {
      const columns = ["arr"];
      const rows = [[[1, 2, 3]]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe("[1,2,3]");
    });
  });

  describe("unicode support", () => {
    test("should handle unicode characters", () => {
      const columns = ["unicode"];
      const rows = [["Hello \u4e16\u754c"], ["\u00e9\u00e0\u00fc"]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe("Hello \u4e16\u754c");
      expect(parsed.rows[1][0]).toBe("\u00e9\u00e0\u00fc");
    });
  });

  describe("value_diff-like data", () => {
    test("should handle typical value diff export data", () => {
      const columns = ["column_name", "matched", "matched_percent"];
      const rows = [
        ["user_id", 1000, 1.0],
        ["email", 950, 0.95],
        ["status", 800, 0.8],
      ];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.columns).toEqual([
        "column_name",
        "matched",
        "matched_percent",
      ]);
      expect(parsed.rows).toHaveLength(3);
      expect(parsed.rows[0]).toEqual(["user_id", 1000, 1]);
      expect(parsed.rows[1]).toEqual(["email", 950, 0.95]);
      expect(parsed.rows[2]).toEqual(["status", 800, 0.8]);
    });
  });

  describe("special characters in values", () => {
    test("should preserve commas in values", () => {
      const columns = ["name"];
      const rows = [["Smith, John"]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe("Smith, John");
    });

    test("should preserve double quotes in values", () => {
      const columns = ["quote"];
      const rows = [['He said "hello"']];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe('He said "hello"');
    });

    test("should preserve newlines in values", () => {
      const columns = ["text"];
      const rows = [["line1\nline2"]];

      const buffer = toExcelBuffer(columns, rows);
      const parsed = parseExcelBuffer(buffer);

      expect(parsed.rows[0][0]).toBe("line1\nline2");
    });
  });
});
