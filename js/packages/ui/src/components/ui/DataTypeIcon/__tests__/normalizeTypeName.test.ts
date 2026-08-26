import { describe, expect, it } from "vitest";
import { normalizeTypeName } from "..";

describe("normalizeTypeName", () => {
  it.each([
    ["varchar", "VARCHAR"],
    ["decimal(18, 3)", "DECIMAL(18, 3)"],
    ["timestamp_s", "TIMESTAMP_S"],
  ])("normalizes the DuckDB spelling %s", (rawType, expected) => {
    expect(normalizeTypeName(rawType)).toBe(expected);
  });

  it.each([
    ["character varying", "VARCHAR"],
    ["character varying(255)", "VARCHAR(255)"],
    ["double precision", "DOUBLE"],
    ["numeric(12,4)[]", "NUMERIC(12,4)[]"],
  ])("normalizes the PostgreSQL spelling %s", (rawType, expected) => {
    expect(normalizeTypeName(rawType)).toBe(expected);
  });

  it.each([
    ["number(38,0)", "NUMBER(38,0)"],
    ["timestamp_ntz(9)", "TIMESTAMP_NTZ(9)"],
  ])("normalizes the Snowflake spelling %s", (rawType, expected) => {
    expect(normalizeTypeName(rawType)).toBe(expected);
  });

  it("preserves unknown type names exactly", () => {
    expect(normalizeTypeName("MyDomain(12)")).toBe("MyDomain(12)");
  });

  it("preserves quoted parameter content", () => {
    expect(normalizeTypeName("datetime64(3, 'UTC')")).toBe(
      "DATETIME64(3, 'UTC')",
    );
  });

  it.each(["", "   "])(
    "normalizes an empty display value to empty",
    (rawType) => {
      expect(normalizeTypeName(rawType)).toBe("");
    },
  );
});
