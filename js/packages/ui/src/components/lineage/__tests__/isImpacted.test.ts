import { describe, expect, it } from "vitest";
import { computeIsImpacted } from "../computeIsImpacted";

describe("computeIsImpacted", () => {
  it("returns true when CLL marks node as impacted", () => {
    const cll = {
      current: {
        nodes: { "model.a": { impacted: true } },
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, undefined)).toBe(true);
  });

  it("returns false when CLL marks node as not impacted and no other signals", () => {
    const cll = {
      current: {
        nodes: { "model.a": { impacted: false } },
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, undefined)).toBe(false);
  });

  it("returns true when a column belonging to the node has a change_status", () => {
    const cll = {
      current: {
        nodes: { "model.a": { impacted: false } },
        columns: {
          "model.a_id": { name: "id", change_status: "added" },
          "model.a_name": { name: "name", change_status: null },
        },
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, undefined)).toBe(true);
  });

  it("returns true when model has a changeStatus even if CLL says not impacted", () => {
    const cll = {
      current: {
        nodes: { "model.a": { impacted: false } },
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, "modified")).toBe(true);
  });

  it("returns false when node is not in CLL data at all and no changeStatus", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, undefined)).toBe(false);
  });

  it("returns false when cll is null", () => {
    expect(computeIsImpacted("model.a", null, undefined)).toBe(false);
  });

  it("returns true when node not in CLL but has changeStatus", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, "added")).toBe(true);
  });

  it("returns true when node has columns with change_status on the node object", () => {
    const cll = {
      current: {
        nodes: {
          "model.a": {
            impacted: false,
            columns: {
              amount: { name: "amount", type: "integer", change_status: "modified" },
              id: { name: "id", type: "integer", change_status: undefined },
            },
          },
        },
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, undefined)).toBe(true);
  });

  it("returns false when node has columns but none with change_status", () => {
    const cll = {
      current: {
        nodes: {
          "model.a": {
            impacted: false,
            columns: {
              amount: { name: "amount", type: "integer" },
              id: { name: "id", type: "integer" },
            },
          },
        },
        columns: {},
        parent_map: {},
      },
    };
    expect(computeIsImpacted("model.a", cll as any, undefined)).toBe(false);
  });
});
