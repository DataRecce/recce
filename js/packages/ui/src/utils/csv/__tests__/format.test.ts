/**
 * Tests for CSV formatting utilities
 */
import { toCSV, toTSV } from "../format";

describe("toCSV", () => {
  describe("basic formatting", () => {
    test("should format simple data with headers", () => {
      const columns = ["name", "age"];
      const rows = [
        ["Alice", 30],
        ["Bob", 25],
      ];

      const result = toCSV(columns, rows);

      // Should have BOM prefix
      expect(result.startsWith("\uFEFF")).toBe(true);
      // Should have correct content
      expect(result).toContain("name,age");
      expect(result).toContain("Alice,30");
      expect(result).toContain("Bob,25");
    });

    test("should use CRLF line endings", () => {
      const columns = ["col1"];
      const rows = [["a"], ["b"]];

      const result = toCSV(columns, rows);

      // Remove BOM for easier checking
      const content = result.slice(1);
      expect(content).toBe("col1\r\na\r\nb");
    });

    test("should handle empty rows", () => {
      const columns = ["col1", "col2"];
      const rows: unknown[][] = [];

      const result = toCSV(columns, rows);

      expect(result).toBe("\uFEFFcol1,col2");
    });

    test("should handle single column", () => {
      const columns = ["value"];
      const rows = [[1], [2], [3]];

      const result = toCSV(columns, rows);
      const content = result.slice(1);

      expect(content).toBe("value\r\n1\r\n2\r\n3");
    });
  });

  describe("special character escaping", () => {
    test("should escape values containing commas", () => {
      const columns = ["name"];
      const rows = [["Smith, John"]];

      const result = toCSV(columns, rows);

      expect(result).toContain('"Smith, John"');
    });

    test("should escape values containing double quotes", () => {
      const columns = ["quote"];
      const rows = [['He said "hello"']];

      const result = toCSV(columns, rows);

      // Quotes should be doubled and wrapped
      expect(result).toContain('"He said ""hello"""');
    });

    test("should escape values containing newlines", () => {
      const columns = ["text"];
      const rows = [["line1\nline2"]];

      const result = toCSV(columns, rows);

      expect(result).toContain('"line1\nline2"');
    });

    test("should escape values containing carriage returns", () => {
      const columns = ["text"];
      const rows = [["line1\rline2"]];

      const result = toCSV(columns, rows);

      expect(result).toContain('"line1\rline2"');
    });

    test("should escape values with multiple special characters", () => {
      const columns = ["complex"];
      const rows = [['value with "quotes", commas, and\nnewlines']];

      const result = toCSV(columns, rows);

      expect(result).toContain(
        '"value with ""quotes"", commas, and\nnewlines"',
      );
    });

    test("should not escape values without special characters", () => {
      const columns = ["simple"];
      const rows = [["plain text"]];

      const result = toCSV(columns, rows);
      const content = result.slice(1);

      expect(content).toBe("simple\r\nplain text");
    });
  });

  describe("null and undefined handling", () => {
    test("should convert null to empty string", () => {
      const columns = ["value"];
      const rows = [[null]];

      const result = toCSV(columns, rows);
      const content = result.slice(1);

      expect(content).toBe("value\r\n");
    });

    test("should convert undefined to empty string", () => {
      const columns = ["value"];
      const rows = [[undefined]];

      const result = toCSV(columns, rows);
      const content = result.slice(1);

      expect(content).toBe("value\r\n");
    });

    test("should handle mixed null and values", () => {
      const columns = ["a", "b", "c"];
      const rows = [[1, null, 3]];

      const result = toCSV(columns, rows);

      expect(result).toContain("1,,3");
    });
  });

  describe("data type handling", () => {
    test("should convert numbers to strings", () => {
      const columns = ["num"];
      const rows = [[42], [3.14], [-100]];

      const result = toCSV(columns, rows);

      expect(result).toContain("42");
      expect(result).toContain("3.14");
      expect(result).toContain("-100");
    });

    test("should convert booleans to strings", () => {
      const columns = ["bool"];
      const rows = [[true], [false]];

      const result = toCSV(columns, rows);

      expect(result).toContain("true");
      expect(result).toContain("false");
    });

    test("should JSON stringify objects", () => {
      const columns = ["obj"];
      const rows = [[{ key: "value" }]];

      const result = toCSV(columns, rows);

      // Objects get JSON stringified, quotes get doubled and wrapped
      // {"key":"value"} becomes "{""key"":""value""}"
      expect(result).toContain('"{""key"":""value""}"');
    });

    test("should JSON stringify arrays", () => {
      const columns = ["arr"];
      const rows = [[[1, 2, 3]]];

      const result = toCSV(columns, rows);

      // Arrays get JSON stringified, contains commas so gets quoted
      expect(result).toContain('"[1,2,3]"');
    });
  });

  describe("UTF-8 BOM", () => {
    test("should include UTF-8 BOM at start for Excel compatibility", () => {
      const columns = ["col"];
      const rows = [["data"]];

      const result = toCSV(columns, rows);

      expect(result.charCodeAt(0)).toBe(0xfeff);
    });

    test("should handle unicode characters", () => {
      const columns = ["unicode"];
      const rows = [["Hello \u4e16\u754c"], ["\u00e9\u00e0\u00fc"]];

      const result = toCSV(columns, rows);

      expect(result).toContain("Hello \u4e16\u754c");
      expect(result).toContain("\u00e9\u00e0\u00fc");
    });
  });
});

describe("toTSV", () => {
  describe("basic formatting", () => {
    test("should format simple data with tab-separated headers and rows", () => {
      const columns = ["name", "age"];
      const rows = [
        ["Alice", 30],
        ["Bob", 25],
      ];

      const result = toTSV(columns, rows);

      expect(result).toContain("name\tage");
      expect(result).toContain("Alice\t30");
      expect(result).toContain("Bob\t25");
    });

    test("should use CRLF line endings", () => {
      const columns = ["col1"];
      const rows = [["a"], ["b"]];

      const result = toTSV(columns, rows);

      expect(result).toBe("col1\r\na\r\nb");
    });

    test("should NOT include UTF-8 BOM", () => {
      const columns = ["col"];
      const rows = [["data"]];

      const result = toTSV(columns, rows);

      // TSV for clipboard pasting should not include BOM
      expect(result.charCodeAt(0)).not.toBe(0xfeff);
    });

    test("should handle empty rows", () => {
      const columns = ["col1", "col2"];
      const rows: unknown[][] = [];

      const result = toTSV(columns, rows);

      expect(result).toBe("col1\tcol2");
    });

    test("should handle single column", () => {
      const columns = ["value"];
      const rows = [[1], [2], [3]];

      const result = toTSV(columns, rows);

      expect(result).toBe("value\r\n1\r\n2\r\n3");
    });
  });

  describe("special character handling", () => {
    test("should replace tab characters in values with spaces", () => {
      const columns = ["text"];
      const rows = [["before\tafter"]];

      const result = toTSV(columns, rows);

      // Tabs within values must be replaced to avoid column misalignment
      expect(result).toBe("text\r\nbefore after");
    });

    test("should replace newline characters in values with spaces", () => {
      const columns = ["text"];
      const rows = [["line1\nline2"]];

      const result = toTSV(columns, rows);

      // Newlines within values must be replaced to avoid row misalignment
      expect(result).toBe("text\r\nline1 line2");
    });

    test("should replace carriage return characters in values with spaces", () => {
      const columns = ["text"];
      const rows = [["line1\rline2"]];

      const result = toTSV(columns, rows);

      expect(result).toBe("text\r\nline1 line2");
    });

    test("should replace CRLF sequences in values with spaces", () => {
      const columns = ["text"];
      const rows = [["line1\r\nline2"]];

      const result = toTSV(columns, rows);

      expect(result).toBe("text\r\nline1 line2");
    });

    test("should preserve commas (not a delimiter in TSV)", () => {
      const columns = ["name"];
      const rows = [["Smith, John"]];

      const result = toTSV(columns, rows);

      // Commas are fine in TSV - not a delimiter
      expect(result).toBe("name\r\nSmith, John");
    });

    test("should preserve double quotes (not special in TSV)", () => {
      const columns = ["quote"];
      const rows = [['He said "hello"']];

      const result = toTSV(columns, rows);

      expect(result).toBe('quote\r\nHe said "hello"');
    });
  });

  describe("null and undefined handling", () => {
    test("should convert null to empty string", () => {
      const columns = ["value"];
      const rows = [[null]];

      const result = toTSV(columns, rows);

      expect(result).toBe("value\r\n");
    });

    test("should convert undefined to empty string", () => {
      const columns = ["value"];
      const rows = [[undefined]];

      const result = toTSV(columns, rows);

      expect(result).toBe("value\r\n");
    });

    test("should handle mixed null and values", () => {
      const columns = ["a", "b", "c"];
      const rows = [[1, null, 3]];

      const result = toTSV(columns, rows);

      expect(result).toBe("a\tb\tc\r\n1\t\t3");
    });
  });

  describe("data type handling", () => {
    test("should convert numbers to strings", () => {
      const columns = ["num"];
      const rows = [[42], [3.14], [-100]];

      const result = toTSV(columns, rows);

      expect(result).toBe("num\r\n42\r\n3.14\r\n-100");
    });

    test("should convert booleans to strings", () => {
      const columns = ["bool"];
      const rows = [[true], [false]];

      const result = toTSV(columns, rows);

      expect(result).toBe("bool\r\ntrue\r\nfalse");
    });

    test("should JSON stringify objects", () => {
      const columns = ["obj"];
      const rows = [[{ key: "value" }]];

      const result = toTSV(columns, rows);

      expect(result).toBe('obj\r\n{"key":"value"}');
    });

    test("should JSON stringify arrays", () => {
      const columns = ["arr"];
      const rows = [[[1, 2, 3]]];

      const result = toTSV(columns, rows);

      expect(result).toBe("arr\r\n[1,2,3]");
    });
  });

  describe("unicode support", () => {
    test("should handle unicode characters", () => {
      const columns = ["unicode"];
      const rows = [["Hello \u4e16\u754c"], ["\u00e9\u00e0\u00fc"]];

      const result = toTSV(columns, rows);

      expect(result).toContain("Hello \u4e16\u754c");
      expect(result).toContain("\u00e9\u00e0\u00fc");
    });
  });

  describe("Google Sheets compatibility", () => {
    test("should produce output that maps to spreadsheet cells", () => {
      const columns = ["Column A", "Column B", "Column C"];
      const rows = [
        ["row1a", "row1b", "row1c"],
        ["row2a", "row2b", "row2c"],
      ];

      const result = toTSV(columns, rows);
      const lines = result.split("\r\n");

      // Header row should have 3 tab-separated values
      expect(lines[0].split("\t")).toEqual([
        "Column A",
        "Column B",
        "Column C",
      ]);
      // Data rows should have 3 tab-separated values
      expect(lines[1].split("\t")).toEqual(["row1a", "row1b", "row1c"]);
      expect(lines[2].split("\t")).toEqual(["row2a", "row2b", "row2c"]);
    });

    test("should handle value_diff-like data (column name, matched count, matched percent)", () => {
      const columns = ["column_name", "matched", "matched_percent"];
      const rows = [
        ["user_id", 1000, 1.0],
        ["email", 950, 0.95],
        ["status", 800, 0.8],
      ];

      const result = toTSV(columns, rows);
      const lines = result.split("\r\n");

      expect(lines).toHaveLength(4); // header + 3 data rows
      expect(lines[0]).toBe("column_name\tmatched\tmatched_percent");
      expect(lines[1]).toBe("user_id\t1000\t1");
      expect(lines[2]).toBe("email\t950\t0.95");
      expect(lines[3]).toBe("status\t800\t0.8");
    });
  });
});
