import { describe, expect, it } from "vitest";
import { computeImpactedColumns } from "../computeImpactedColumns";
import { computeIsImpacted } from "../computeIsImpacted";

describe("computeIsImpacted", () => {
  it("returns true when node has a column with direct change_status", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {
          "model.a_id": { name: "id", change_status: "added" },
        },
        parent_map: {},
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        undefined,
        computeImpactedColumns(cll as any),
      ),
    ).toBe(true);
  });

  it("returns false when node columns have no change_status and no parent_map links", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {
          "model.a_id": { name: "id", change_status: null },
        },
        parent_map: {},
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        undefined,
        computeImpactedColumns(cll as any),
      ),
    ).toBe(false);
  });

  it("returns true when model has a changeStatus", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {},
        parent_map: {},
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        "modified",
        computeImpactedColumns(cll as any),
      ),
    ).toBe(true);
  });

  it("returns false when node is not in CLL data at all and no changeStatus", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {},
        parent_map: {},
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        undefined,
        computeImpactedColumns(cll as any),
      ),
    ).toBe(false);
  });

  it("returns false when cll is null", () => {
    expect(
      computeIsImpacted("model.a", null, undefined, new Set<string>()),
    ).toBe(false);
  });

  it("returns true when node not in CLL but has changeStatus", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {},
        parent_map: {},
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        "added",
        computeImpactedColumns(cll as any),
      ),
    ).toBe(true);
  });

  it("returns true when node has a column impacted via parent_map walk", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {
          "model.upstream_STATUS": {
            name: "STATUS",
            change_status: "modified",
          },
          "model.a_STATUS": { name: "STATUS", change_status: null },
        },
        parent_map: {
          "model.a_STATUS": ["model.upstream_STATUS"],
        },
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        undefined,
        computeImpactedColumns(cll as any),
      ),
    ).toBe(true);
  });

  it("returns false when node columns have no upstream change in parent_map", () => {
    const cll = {
      current: {
        nodes: {},
        columns: {
          "model.a_AMOUNT": { name: "AMOUNT", change_status: null },
        },
        parent_map: {},
      },
    };
    expect(
      computeIsImpacted(
        "model.a",
        cll as any,
        undefined,
        computeImpactedColumns(cll as any),
      ),
    ).toBe(false);
  });
});
