import { describe, expect, it } from "vitest";
import { supportsHistogramDiff } from "../HistogramDiffForm";

describe("supportsHistogramDiff", () => {
  it("should return true for supported numeric types", () => {
    const supportedNumericTypes = [
      "INT",
      "INTEGER",
      "BIGINT",
      "SMALLINT",
      "TINYINT",
      "FLOAT",
      "DOUBLE",
      "DECIMAL",
      "NUMERIC",
      "REAL",
    ];

    for (const type of supportedNumericTypes) {
      expect(supportsHistogramDiff(type)).toBe(true);
      expect(supportsHistogramDiff(type.toLowerCase())).toBe(true);
    }
  });

  it("should return false for string data types", () => {
    const stringTypes = [
      "CHAR",
      "VARCHAR",
      "VARCHAR(255)",
      "NVARCHAR(50)",
      "TEXT",
      "LONGTEXT",
      "CLOB",
      "JSON",
    ];

    for (const type of stringTypes) {
      expect(supportsHistogramDiff(type)).toBe(false);
      expect(supportsHistogramDiff(type.toLowerCase())).toBe(false);
    }
  });

  it("should return false for boolean data types", () => {
    const booleanTypes = ["BOOLEAN", "BOOL", "BIT", "TINYINT(1)"];

    for (const type of booleanTypes) {
      expect(supportsHistogramDiff(type)).toBe(false);
      expect(supportsHistogramDiff(type.toLowerCase())).toBe(false);
    }
  });

  it("should return false for datetime and timestamp types", () => {
    const datetimeTypes = [
      "DATE",
      "DATETIME",
      "TIMESTAMP",
      "TIMESTAMPTZ",
      "TIMESTAMP WITH TIME ZONE",
      "TIMESTAMP_NTZ",
      "DATETIME2",
    ];

    for (const type of datetimeTypes) {
      expect(supportsHistogramDiff(type)).toBe(false);
      expect(supportsHistogramDiff(type.toLowerCase())).toBe(false);
    }
  });

  it("should return false for TIME and TIMETZ types", () => {
    const timeTypes = ["TIME", "TIMETZ", "time", "timetz"];

    for (const type of timeTypes) {
      expect(supportsHistogramDiff(type)).toBe(false);
    }
  });
});
