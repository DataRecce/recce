import { describe, expect, it } from "vitest";
import { buildColumnTooltip } from "../tooltipText";

describe("buildColumnTooltip", () => {
  it("returns name + type for added column", () => {
    expect(
      buildColumnTooltip({
        name: "new_col",
        status: "added",
        currentType: "VARCHAR(50)",
      }),
    ).toBe("new_col added VARCHAR(50)");
  });

  it("returns 'deleted name' for removed column", () => {
    expect(
      buildColumnTooltip({
        name: "old_col",
        status: "removed",
        baseType: "INT",
      }),
    ).toBe("deleted old_col");
  });

  it("returns type change description for type_changed", () => {
    expect(
      buildColumnTooltip({
        name: "col",
        status: "type_changed",
        baseType: "VARCHAR(50)",
        currentType: "VARCHAR(10)",
      }),
    ).toBe("col, was VARCHAR(50) now VARCHAR(10)");
  });

  it("returns changed definition for definition_changed", () => {
    expect(
      buildColumnTooltip({
        name: "col",
        status: "definition_changed",
        currentType: "VARCHAR(10)",
      }),
    ).toBe("col VARCHAR(10) changed definition");
  });

  it("returns name + type for unchanged column", () => {
    expect(
      buildColumnTooltip({
        name: "col",
        status: "unchanged",
        currentType: "VARCHAR(50)",
      }),
    ).toBe("col VARCHAR(50)");
  });

  it("appends CLL suffix for unchanged column when cllAvailable", () => {
    expect(
      buildColumnTooltip({
        name: "col",
        status: "unchanged",
        currentType: "VARCHAR(50)",
        cllAvailable: true,
      }),
    ).toBe("col VARCHAR(50) \u00b7 Click for column lineage");
  });

  it("does NOT append CLL suffix for removed column even when cllAvailable", () => {
    expect(
      buildColumnTooltip({
        name: "old_col",
        status: "removed",
        baseType: "INT",
        cllAvailable: true,
      }),
    ).toBe("deleted old_col");
  });

  it("returns name + type when no status provided", () => {
    expect(
      buildColumnTooltip({
        name: "customer_id",
        currentType: "BIGINT",
      }),
    ).toBe("customer_id BIGINT");
  });

  it("returns type change when no status but types differ", () => {
    expect(
      buildColumnTooltip({
        name: "col",
        baseType: "VARCHAR(50)",
        currentType: "BIGINT",
      }),
    ).toBe("col, was VARCHAR(50) now BIGINT");
  });

  it("returns just name when no status and no types", () => {
    expect(buildColumnTooltip({ name: "col" })).toBe("col");
  });
});
