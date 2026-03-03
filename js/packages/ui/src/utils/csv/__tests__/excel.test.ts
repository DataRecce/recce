/**
 * Tests for Excel formatting utilities (write-excel-file)
 */
import readXlsxFile from "read-excel-file";
import { toExcelBlob } from "../excel";

/**
 * Helper to parse an Excel Blob back into columns and rows
 */
async function parseExcelBlob(blob: Blob): Promise<{
  columns: string[];
  rows: unknown[][];
}> {
  // read-excel-file accepts Blob in browser environments
  const jsonData = await readXlsxFile(blob);

  if (jsonData.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = (jsonData[0] as unknown[]).map(String);
  const rows = jsonData.slice(1);

  return { columns, rows };
}

describe("toExcelBlob", () => {
  describe("basic formatting", () => {
    test("should return a Blob", async () => {
      const columns = ["name", "age"];
      const rows = [["Alice", 30]];

      const result = await toExcelBlob(columns, rows);

      expect(result).toBeInstanceOf(Blob);
    });

    test("should produce a valid Excel file with correct headers and data", async () => {
      const columns = ["name", "age"];
      const rows = [
        ["Alice", 30],
        ["Bob", 25],
      ];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.columns).toEqual(["name", "age"]);
      expect(parsed.rows).toHaveLength(2);
      expect(parsed.rows[0]).toEqual(["Alice", 30]);
      expect(parsed.rows[1]).toEqual(["Bob", 25]);
    });

    test("should handle single column", async () => {
      const columns = ["value"];
      const rows = [[1], [2], [3]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.columns).toEqual(["value"]);
      expect(parsed.rows).toEqual([[1], [2], [3]]);
    });

    test("should handle empty rows (headers only)", async () => {
      const columns = ["col1", "col2"];
      const rows: unknown[][] = [];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.columns).toEqual(["col1", "col2"]);
      expect(parsed.rows).toHaveLength(0);
    });
  });

  describe("null and undefined handling", () => {
    test("should convert null to empty cell", async () => {
      const columns = ["value"];
      const rows = [[null]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      // All-null rows are omitted by the Excel reader (no data cells)
      // Verify the blob is valid and has no data rows
      expect(parsed.rows).toHaveLength(0);
    });

    test("should convert undefined to empty cell", async () => {
      const columns = ["value"];
      const rows = [[undefined]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      // All-undefined rows are omitted by the Excel reader (no data cells)
      expect(parsed.rows).toHaveLength(0);
    });

    test("should handle mixed null and values", async () => {
      const columns = ["a", "b", "c"];
      const rows = [[1, null, 3]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe(1);
      expect(
        parsed.rows[0][1] === undefined || parsed.rows[0][1] === null,
      ).toBe(true);
      expect(parsed.rows[0][2]).toBe(3);
    });
  });

  describe("data type handling", () => {
    test("should preserve numbers as numbers", async () => {
      const columns = ["num"];
      const rows = [[42], [3.14], [-100]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe(42);
      expect(parsed.rows[1][0]).toBe(3.14);
      expect(parsed.rows[2][0]).toBe(-100);
    });

    test("should preserve strings as strings", async () => {
      const columns = ["text"];
      const rows = [["hello"], ["world"]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe("hello");
      expect(parsed.rows[1][0]).toBe("world");
    });

    test("should convert booleans to booleans", async () => {
      const columns = ["bool"];
      const rows = [[true], [false]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe(true);
      expect(parsed.rows[1][0]).toBe(false);
    });

    test("should JSON stringify objects", async () => {
      const columns = ["obj"];
      const rows = [[{ key: "value" }]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe('{"key":"value"}');
    });

    test("should JSON stringify arrays", async () => {
      const columns = ["arr"];
      const rows = [[[1, 2, 3]]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe("[1,2,3]");
    });
  });

  describe("unicode support", () => {
    test("should handle unicode characters", async () => {
      const columns = ["unicode"];
      const rows = [["Hello \u4e16\u754c"], ["\u00e9\u00e0\u00fc"]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe("Hello \u4e16\u754c");
      expect(parsed.rows[1][0]).toBe("\u00e9\u00e0\u00fc");
    });
  });

  describe("value_diff-like data", () => {
    test("should handle typical value diff export data", async () => {
      const columns = ["column_name", "matched", "matched_percent"];
      const rows = [
        ["user_id", 1000, 1.0],
        ["email", 950, 0.95],
        ["status", 800, 0.8],
      ];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

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
    test("should preserve commas in values", async () => {
      const columns = ["name"];
      const rows = [["Smith, John"]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe("Smith, John");
    });

    test("should preserve double quotes in values", async () => {
      const columns = ["quote"];
      const rows = [['He said "hello"']];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe('He said "hello"');
    });

    test("should preserve newlines in values", async () => {
      const columns = ["text"];
      const rows = [["line1\nline2"]];

      const blob = await toExcelBlob(columns, rows);
      const parsed = await parseExcelBlob(blob);

      expect(parsed.rows[0][0]).toBe("line1\nline2");
    });
  });
});
