/**
 * Tests for CSV data extractors
 */
import type { CSVExportOptions } from "../extractors";
import { extractCSVData, supportsCSVExport } from "../extractors";

describe("supportsCSVExport", () => {
  test("should return true for supported run types", () => {
    const supportedTypes = [
      "query",
      "query_base",
      "query_diff",
      "profile",
      "profile_diff",
      "row_count",
      "row_count_diff",
      "value_diff",
      "value_diff_detail",
      "top_k_diff",
    ];

    for (const type of supportedTypes) {
      expect(supportsCSVExport(type)).toBe(true);
    }
  });

  test("should return false for unsupported run types", () => {
    expect(supportsCSVExport("unknown")).toBe(false);
    expect(supportsCSVExport("lineage")).toBe(false);
    expect(supportsCSVExport("")).toBe(false);
  });
});

describe("extractCSVData", () => {
  describe("query extractor", () => {
    test("should extract DataFrame columns and rows", () => {
      const result = {
        columns: [
          { key: "id", name: "id", type: "integer" },
          { key: "name", name: "name", type: "string" },
        ],
        data: [
          [1, "Alice"],
          [2, "Bob"],
        ],
      };

      const csvData = extractCSVData("query", result);

      expect(csvData).not.toBeNull();
      expect(csvData?.columns).toEqual(["id", "name"]);
      expect(csvData?.rows).toEqual([
        [1, "Alice"],
        [2, "Bob"],
      ]);
    });

    test("should return null for empty result", () => {
      expect(extractCSVData("query", null)).toBeNull();
      expect(extractCSVData("query", undefined)).toBeNull();
      expect(extractCSVData("query", {})).toBeNull();
    });

    test("should return null for missing columns or data", () => {
      expect(extractCSVData("query", { columns: [] })).toBeNull();
      expect(extractCSVData("query", { data: [] })).toBeNull();
    });
  });

  describe("query_diff extractor", () => {
    describe("inline mode (default)", () => {
      test("should merge rows with same values", () => {
        const result = {
          base: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
            ],
            data: [
              [1, 100],
              [2, 200],
            ],
          },
          current: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
            ],
            data: [
              [1, 100],
              [2, 200],
            ],
          },
        };

        const csvData = extractCSVData("query_diff", result);

        expect(csvData).not.toBeNull();
        expect(csvData?.columns).toEqual(["id", "value"]);
        // Same values should be shown as-is
        expect(csvData?.rows).toEqual([
          [1, 100],
          [2, 200],
        ]);
      });

      test("should show diff format for different values", () => {
        const result = {
          base: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
            ],
            data: [[1, 100]],
          },
          current: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
            ],
            data: [[1, 150]],
          },
        };

        const csvData = extractCSVData("query_diff", result);

        expect(csvData).not.toBeNull();
        expect(csvData?.columns).toEqual(["id", "value"]);
        // Different values should show "(base) (current)" format
        expect(csvData?.rows).toEqual([[1, "(100) (150)"]]);
      });

      test("should handle null values in diff", () => {
        const result = {
          base: {
            columns: [{ key: "value", name: "value", type: "integer" }],
            data: [[null]],
          },
          current: {
            columns: [{ key: "value", name: "value", type: "integer" }],
            data: [[100]],
          },
        };

        const csvData = extractCSVData("query_diff", result);

        expect(csvData?.rows).toEqual([["(100)"]]);
      });
    });

    describe("side_by_side mode", () => {
      test("should create base__ and current__ columns", () => {
        const result = {
          base: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
            ],
            data: [[1, 100]],
          },
          current: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
            ],
            data: [[1, 150]],
          },
        };

        const options: CSVExportOptions = { displayMode: "side_by_side" };
        const csvData = extractCSVData("query_diff", result, options);

        expect(csvData).not.toBeNull();
        expect(csvData?.columns).toEqual([
          "base__id",
          "current__id",
          "base__value",
          "current__value",
        ]);
        expect(csvData?.rows).toEqual([[1, 1, 100, 150]]);
      });

      test("should handle different row counts", () => {
        const result = {
          base: {
            columns: [{ key: "id", name: "id", type: "integer" }],
            data: [[1], [2], [3]],
          },
          current: {
            columns: [{ key: "id", name: "id", type: "integer" }],
            data: [[1]],
          },
        };

        const options: CSVExportOptions = { displayMode: "side_by_side" };
        const csvData = extractCSVData("query_diff", result, options);

        expect(csvData?.rows).toEqual([
          [1, 1],
          [2, null],
          [3, null],
        ]);
      });
    });

    describe("joined diff (with primary keys)", () => {
      test("should group rows by primary key in inline mode", () => {
        const result = {
          diff: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
              { key: "in_a", name: "in_a", type: "boolean" },
              { key: "in_b", name: "in_b", type: "boolean" },
            ],
            data: [
              [1, 100, true, false], // base only
              [1, 150, false, true], // current only
            ],
          },
        };

        const options: CSVExportOptions = { primaryKeys: ["id"] };
        const csvData = extractCSVData("query_diff", result, options);

        expect(csvData).not.toBeNull();
        expect(csvData?.columns).toEqual(["id", "value"]);
        // Should merge rows with same primary key
        expect(csvData?.rows).toEqual([[1, "(100) (150)"]]);
      });

      test("should handle side_by_side mode with primary keys", () => {
        const result = {
          diff: {
            columns: [
              { key: "id", name: "id", type: "integer" },
              { key: "value", name: "value", type: "integer" },
              { key: "in_a", name: "in_a", type: "boolean" },
              { key: "in_b", name: "in_b", type: "boolean" },
            ],
            data: [
              [1, 100, true, false],
              [1, 150, false, true],
            ],
          },
        };

        const options: CSVExportOptions = {
          displayMode: "side_by_side",
          primaryKeys: ["id"],
        };
        const csvData = extractCSVData("query_diff", result, options);

        expect(csvData?.columns).toEqual([
          "base__id",
          "current__id",
          "base__value",
          "current__value",
        ]);
        expect(csvData?.rows).toEqual([[1, 1, 100, 150]]);
      });
    });

    test("should return single DataFrame if only one exists", () => {
      const result = {
        current: {
          columns: [{ key: "id", name: "id", type: "integer" }],
          data: [[1], [2]],
        },
      };

      const csvData = extractCSVData("query_diff", result);

      expect(csvData?.columns).toEqual(["id"]);
      expect(csvData?.rows).toEqual([[1], [2]]);
    });
  });

  describe("row_count_diff extractor", () => {
    test("should extract node counts with calculated diff", () => {
      const result = {
        model_a: { base: 100, curr: 120 },
        model_b: { base: 200, curr: 180 },
      };

      const csvData = extractCSVData("row_count_diff", result);

      expect(csvData).not.toBeNull();
      expect(csvData?.columns).toEqual([
        "node",
        "base_count",
        "current_count",
        "diff",
        "diff_percent",
      ]);
      expect(csvData?.rows).toContainEqual(["model_a", 100, 120, 20, "20.00%"]);
      expect(csvData?.rows).toContainEqual([
        "model_b",
        200,
        180,
        -20,
        "-10.00%",
      ]);
    });

    test("should handle null counts", () => {
      const result = {
        model_a: { base: null, curr: 100 },
      };

      const csvData = extractCSVData("row_count_diff", result);

      expect(csvData?.rows).toContainEqual(["model_a", null, 100, null, null]);
    });
  });

  describe("profile_diff extractor", () => {
    test("should combine base and current with source column", () => {
      const result = {
        base: {
          columns: [
            { key: "column", name: "column", type: "string" },
            { key: "count", name: "count", type: "integer" },
          ],
          data: [["col1", 100]],
        },
        current: {
          columns: [
            { key: "column", name: "column", type: "string" },
            { key: "count", name: "count", type: "integer" },
          ],
          data: [["col1", 150]],
        },
      };

      const csvData = extractCSVData("profile_diff", result);

      expect(csvData).not.toBeNull();
      expect(csvData?.columns).toEqual(["_source", "column", "count"]);
      expect(csvData?.rows).toEqual([
        ["base", "col1", 100],
        ["current", "col1", 150],
      ]);
    });
  });

  describe("value_diff extractor", () => {
    test("should extract data from nested data property", () => {
      const result = {
        data: {
          columns: [
            { key: "pk", name: "pk", type: "string" },
            { key: "status", name: "status", type: "string" },
          ],
          data: [
            ["key1", "modified"],
            ["key2", "added"],
          ],
        },
      };

      const csvData = extractCSVData("value_diff", result);

      expect(csvData?.columns).toEqual(["pk", "status"]);
      expect(csvData?.rows).toEqual([
        ["key1", "modified"],
        ["key2", "added"],
      ]);
    });
  });

  describe("top_k_diff extractor", () => {
    test("should extract values and counts from base and current", () => {
      const result = {
        base: {
          values: ["a", "b"],
          counts: [10, 5],
          valids: 15,
        },
        current: {
          values: ["a", "c"],
          counts: [12, 3],
          valids: 15,
        },
      };

      const csvData = extractCSVData("top_k_diff", result);

      expect(csvData).not.toBeNull();
      expect(csvData?.columns).toEqual(["_source", "value", "count"]);
      expect(csvData?.rows).toEqual([
        ["base", "a", 10],
        ["base", "b", 5],
        ["current", "a", 12],
        ["current", "c", 3],
      ]);
    });

    test("should handle missing base or current", () => {
      const result = {
        base: null,
        current: {
          values: ["a"],
          counts: [10],
          valids: 10,
        },
      };

      const csvData = extractCSVData("top_k_diff", result);

      expect(csvData?.rows).toEqual([["current", "a", 10]]);
    });

    test("should return null when both base and current are missing values", () => {
      const result = {
        base: { values: null, counts: [], valids: 0 },
        current: { values: null, counts: [], valids: 0 },
      };

      const csvData = extractCSVData("top_k_diff", result);

      expect(csvData).toBeNull();
    });
  });

  describe("error handling", () => {
    test("should return null for unsupported run type", () => {
      const csvData = extractCSVData("unsupported", { some: "data" });

      expect(csvData).toBeNull();
    });

    test("should return null and log error for malformed data", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional mock
        .mockImplementation(() => {});

      // Pass data that will cause an error in the extractor
      const result = {
        base: "invalid", // Should be object with columns/data
        current: "invalid",
      };

      const csvData = extractCSVData("query_diff", result);

      // Should not throw, just return null
      expect(csvData).toBeNull();

      consoleSpy.mockRestore();
    });
  });
});
