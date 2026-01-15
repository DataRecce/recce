/**
 * Tests for CSV utility functions
 */
import { generateCSVFilename, generateTimestamp } from "../index";

describe("generateTimestamp", () => {
  test("should return timestamp in YYYYMMDD-HHmmss format", () => {
    const timestamp = generateTimestamp();

    // Should match format like 20240101-123456
    expect(timestamp).toMatch(/^\d{8}-\d{6}$/);
  });

  test("should generate consistent length timestamps", () => {
    const timestamps = Array.from({ length: 5 }, () => generateTimestamp());

    for (const ts of timestamps) {
      expect(ts.length).toBe(15); // 8 + 1 + 6 = 15 characters
    }
  });
});

describe("generateCSVFilename", () => {
  describe("basic filename generation", () => {
    test("should include run type in filename", () => {
      const filename = generateCSVFilename("query_diff", {});

      expect(filename).toMatch(/^query-diff-.*\.csv$/);
    });

    test("should replace underscores with hyphens in run type", () => {
      const filename = generateCSVFilename("row_count_diff", {});

      expect(filename).toContain("row-count-diff");
      expect(filename).not.toContain("_");
    });

    test("should end with .csv extension", () => {
      const filename = generateCSVFilename("query", {});

      expect(filename).toMatch(/\.csv$/);
    });

    test("should include timestamp", () => {
      const filename = generateCSVFilename("query", {});

      // Should have timestamp pattern before .csv
      expect(filename).toMatch(/\d{8}-\d{6}\.csv$/);
    });
  });

  describe("node name extraction", () => {
    test("should include single node name from node_names array", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["my_model"],
      });

      expect(filename).toContain("my_model");
    });

    test("should not include node name if multiple in array", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["model1", "model2"],
      });

      expect(filename).not.toContain("model1");
      expect(filename).not.toContain("model2");
      expect(filename).toContain("result");
    });

    test("should include model name from params", () => {
      const filename = generateCSVFilename("profile", {
        model: "customers",
      });

      expect(filename).toContain("customers");
    });

    test("should prefer node_names over model", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["from_node"],
        model: "from_model",
      });

      expect(filename).toContain("from_node");
      expect(filename).not.toContain("from_model");
    });
  });

  describe("node name sanitization", () => {
    test("should convert to lowercase", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["MyModel"],
      });

      expect(filename).toContain("mymodel");
      expect(filename).not.toContain("MyModel");
    });

    test("should preserve dots for schema.table patterns", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["schema.table_name"],
      });

      expect(filename).toContain("schema.table_name");
    });

    test("should replace special characters with hyphens", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["model/with/slashes"],
      });

      expect(filename).toContain("model-with-slashes");
      expect(filename).not.toContain("/");
    });

    test("should handle spaces", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["model with spaces"],
      });

      expect(filename).toContain("model-with-spaces");
    });

    test("should preserve underscores and hyphens", () => {
      const filename = generateCSVFilename("query", {
        node_names: ["my_model-name"],
      });

      expect(filename).toContain("my_model-name");
    });
  });

  describe("fallback behavior", () => {
    test("should use 'result' when no node name available", () => {
      const filename = generateCSVFilename("query", {});

      expect(filename).toMatch(/^query-result-\d{8}-\d{6}\.csv$/);
    });

    test("should handle undefined params", () => {
      const filename = generateCSVFilename("query", undefined);

      expect(filename).toMatch(/^query-result-\d{8}-\d{6}\.csv$/);
    });

    test("should handle empty node_names array", () => {
      const filename = generateCSVFilename("query", {
        node_names: [],
      });

      expect(filename).toContain("result");
    });
  });
});
