/**
 * @file selectChangedColumns.test.ts
 * @description DRC-3390 Stage C — column scoping for the inline distribution.
 */

import { describe, expect, it } from "vitest";
import type { NodeData } from "../../../../api";
import { selectChangedColumns } from "../toSchemaDataGrid";

const col = (type: string) => ({ name: "c", type });

const base: NodeData["columns"] = {
  amount: col("DOUBLE"),
  status: col("VARCHAR"),
  removed_col: col("INT"),
  reordered_col: col("INT"),
  unchanged: col("VARCHAR"),
};
const current: NodeData["columns"] = {
  amount: col("DOUBLE"),
  status: col("INT"), // type changed
  added_col: col("INT"),
  reordered_col: col("INT"),
  unchanged: col("VARCHAR"),
};

describe("selectChangedColumns", () => {
  it("includes added, removed, and type-changed columns", () => {
    const changed = selectChangedColumns({ base, current });
    expect(changed.sort()).toEqual(
      ["added_col", "removed_col", "status"].sort(),
    );
    expect(changed).not.toContain("unchanged");
    expect(changed).not.toContain("reordered_col");
  });

  it("includes columns flagged by breaking-change analysis", () => {
    const changed = selectChangedColumns({
      base,
      current,
      columnChanges: { amount: "modified" },
    });
    expect(changed).toContain("amount");
  });

  it("includes impacted columns keyed by nodeId", () => {
    const changed = selectChangedColumns({
      base,
      current,
      impactedColumns: new Set(["model.x_amount"]),
      nodeId: "model.x",
    });
    expect(changed).toContain("amount");
  });

  it("does not treat impacted columns of OTHER nodes as changed", () => {
    const changed = selectChangedColumns({
      base: { amount: col("DOUBLE") },
      current: { amount: col("DOUBLE") },
      impactedColumns: new Set(["model.other_amount"]),
      nodeId: "model.x",
    });
    expect(changed).toEqual([]);
  });

  it("returns empty when nothing changed (whole-model / unchanged is decided by caller)", () => {
    const same: NodeData["columns"] = { a: col("INT"), b: col("VARCHAR") };
    expect(selectChangedColumns({ base: same, current: same })).toEqual([]);
  });
});
