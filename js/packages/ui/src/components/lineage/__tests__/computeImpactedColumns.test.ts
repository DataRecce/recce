import { describe, expect, it } from "vitest";
import { computeImpactedColumns } from "../computeImpactedColumns";

describe("computeImpactedColumns", () => {
  it("returns the directly changed column itself", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS", change_status: "modified" },
        },
        parent_map: {},
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.has("model.a_STATUS")).toBe(true);
  });

  it("returns downstream column that traces to a changed column", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS", change_status: "modified" },
          "model.b_STATUS": { name: "STATUS", change_status: null },
        },
        parent_map: {
          "model.b_STATUS": ["model.a_STATUS"],
        },
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.has("model.b_STATUS")).toBe(true);
  });

  it("returns column impacted through a multi-hop chain", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS", change_status: "modified" },
          "model.b_STATUS": { name: "STATUS", change_status: null },
          "model.c_STATUS": { name: "STATUS", change_status: null },
        },
        parent_map: {
          "model.b_STATUS": ["model.a_STATUS"],
          "model.c_STATUS": ["model.b_STATUS"],
        },
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.has("model.c_STATUS")).toBe(true);
  });

  it("does not mark column with no upstream change", () => {
    const cll = {
      current: {
        columns: {
          "model.a_AMOUNT": { name: "AMOUNT", change_status: null },
          "model.b_AMOUNT": { name: "AMOUNT", change_status: null },
        },
        parent_map: {
          "model.b_AMOUNT": ["model.a_AMOUNT"],
        },
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.has("model.b_AMOUNT")).toBe(false);
  });

  it("handles mixed impacted and non-impacted columns on same node", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS", change_status: "modified" },
          "model.b_STATUS": { name: "STATUS", change_status: null },
          "model.b_AMOUNT": { name: "AMOUNT", change_status: null },
        },
        parent_map: {
          "model.b_STATUS": ["model.a_STATUS"],
        },
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.has("model.b_STATUS")).toBe(true);
    expect(result.has("model.b_AMOUNT")).toBe(false);
  });

  it("handles empty parent_map", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS", change_status: null },
        },
        parent_map: {},
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.size).toBe(0);
  });

  it("handles circular references without infinite loop", () => {
    const cll = {
      current: {
        columns: {
          "model.a_X": { name: "X", change_status: null },
          "model.b_X": { name: "X", change_status: null },
        },
        parent_map: {
          "model.a_X": ["model.b_X"],
          "model.b_X": ["model.a_X"],
        },
        nodes: {},
      },
    };
    const result = computeImpactedColumns(cll as any);
    expect(result.size).toBe(0);
  });
});
