import { describe, expect, it } from "vitest";
import {
  coerceCllChangeStatus,
  computeColumnLineage,
} from "../computeColumnLineage";

describe("computeColumnLineage", () => {
  it("walks upstream via parent_map from the selected column", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS" },
          "model.b_STATUS": { name: "STATUS" },
          "model.c_STATUS": { name: "STATUS" },
        },
        parent_map: {
          "model.c_STATUS": ["model.b_STATUS"],
          "model.b_STATUS": ["model.a_STATUS"],
        },
        child_map: {
          "model.a_STATUS": ["model.b_STATUS"],
          "model.b_STATUS": ["model.c_STATUS"],
        },
      },
    };

    const result = computeColumnLineage(
      cll as any,
      "model.c",
      "STATUS",
      new Set(),
    );

    expect(Array.from(result.keys()).sort()).toEqual([
      "model.a",
      "model.b",
      "model.c",
    ]);
  });

  it("walks downstream via child_map from the selected column", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS" },
          "model.b_STATUS": { name: "STATUS" },
          "model.c_STATUS": { name: "STATUS" },
        },
        parent_map: {
          "model.b_STATUS": ["model.a_STATUS"],
          "model.c_STATUS": ["model.b_STATUS"],
        },
        child_map: {
          "model.a_STATUS": ["model.b_STATUS"],
          "model.b_STATUS": ["model.c_STATUS"],
        },
      },
    };

    const result = computeColumnLineage(
      cll as any,
      "model.a",
      "STATUS",
      new Set(),
    );

    expect(Array.from(result.keys()).sort()).toEqual([
      "model.a",
      "model.b",
      "model.c",
    ]);
  });

  it("walks both directions from a middle column", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS" },
          "model.b_STATUS": { name: "STATUS" },
          "model.c_STATUS": { name: "STATUS" },
        },
        parent_map: {
          "model.b_STATUS": ["model.a_STATUS"],
          "model.c_STATUS": ["model.b_STATUS"],
        },
        child_map: {
          "model.a_STATUS": ["model.b_STATUS"],
          "model.b_STATUS": ["model.c_STATUS"],
        },
      },
    };

    const result = computeColumnLineage(
      cll as any,
      "model.b",
      "STATUS",
      new Set(),
    );

    expect(Array.from(result.keys()).sort()).toEqual([
      "model.a",
      "model.b",
      "model.c",
    ]);
    // Selected column appears exactly once
    expect(result.get("model.b")).toHaveLength(1);
  });

  it("deduplicates diamond-reachable columns", () => {
    // a -> b -> d, a -> c -> d. Starting at a, d is reachable via two paths.
    const cll = {
      current: {
        columns: {
          "model.a_X": { name: "X" },
          "model.b_X": { name: "X" },
          "model.c_X": { name: "X" },
          "model.d_X": { name: "X" },
        },
        parent_map: {
          "model.b_X": ["model.a_X"],
          "model.c_X": ["model.a_X"],
          "model.d_X": ["model.b_X", "model.c_X"],
        },
        child_map: {
          "model.a_X": ["model.b_X", "model.c_X"],
          "model.b_X": ["model.d_X"],
          "model.c_X": ["model.d_X"],
        },
      },
    };

    const result = computeColumnLineage(cll as any, "model.a", "X", new Set());

    expect(result.get("model.d")).toHaveLength(1);
    expect(result.get("model.b")).toHaveLength(1);
    expect(result.get("model.c")).toHaveLength(1);
  });

  it("marks impacted columns based on the provided set", () => {
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": { name: "STATUS" },
          "model.b_STATUS": { name: "STATUS" },
        },
        parent_map: {
          "model.b_STATUS": ["model.a_STATUS"],
        },
        child_map: {
          "model.a_STATUS": ["model.b_STATUS"],
        },
      },
    };

    const result = computeColumnLineage(
      cll as any,
      "model.a",
      "STATUS",
      new Set(["model.b_STATUS"]),
    );

    expect(result.get("model.a")?.[0].isImpacted).toBe(false);
    expect(result.get("model.b")?.[0].isImpacted).toBe(true);
  });

  it('coerces wire change_status "unknown" to renderer "modified"', () => {
    // DRC-3409: the loud-fail fallback in recce/util/breaking.py tags
    // unresolvable CTE-affected outer columns as "unknown" rather than
    // silently reporting "no change". Surface those as "modified" so the
    // CLL renderer paints the ~ amber indicator instead of indexing into
    // an empty palette slot and rendering as no-change.
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": {
            name: "STATUS",
            change_status: "unknown",
          },
          "model.b_STATUS": {
            name: "STATUS",
            change_status: "modified",
          },
          "model.c_STATUS": {
            name: "STATUS",
          },
        },
        parent_map: {
          "model.c_STATUS": ["model.b_STATUS"],
          "model.b_STATUS": ["model.a_STATUS"],
        },
        child_map: {
          "model.a_STATUS": ["model.b_STATUS"],
          "model.b_STATUS": ["model.c_STATUS"],
        },
      },
    };

    const result = computeColumnLineage(
      cll as any,
      "model.c",
      "STATUS",
      new Set(),
    );

    // Unknown surfaces as modified; existing modified stays; absent stays absent.
    expect(result.get("model.a")?.[0].changeStatus).toBe("modified");
    expect(result.get("model.b")?.[0].changeStatus).toBe("modified");
    expect(result.get("model.c")?.[0].changeStatus).toBeUndefined();
  });

  it("coerces wire change_status on the start column as well", () => {
    // The selected column itself can carry "unknown" when its outer
    // projection couldn't be linked to a specific CTE source change.
    const cll = {
      current: {
        columns: {
          "model.a_STATUS": {
            name: "STATUS",
            change_status: "unknown",
          },
        },
        parent_map: {},
        child_map: {},
      },
    };

    const result = computeColumnLineage(
      cll as any,
      "model.a",
      "STATUS",
      new Set(),
    );

    expect(result.get("model.a")?.[0].changeStatus).toBe("modified");
  });

  describe("coerceCllChangeStatus", () => {
    it('maps "unknown" to "modified"', () => {
      expect(coerceCllChangeStatus("unknown")).toBe("modified");
    });

    it("passes through added / removed / modified unchanged", () => {
      expect(coerceCllChangeStatus("added")).toBe("added");
      expect(coerceCllChangeStatus("removed")).toBe("removed");
      expect(coerceCllChangeStatus("modified")).toBe("modified");
    });

    it('preserves undefined to keep the "no change" signal', () => {
      expect(coerceCllChangeStatus(undefined)).toBeUndefined();
    });
  });

  it("handles cycles without infinite recursion", () => {
    const cll = {
      current: {
        columns: {
          "model.a_X": { name: "X" },
          "model.b_X": { name: "X" },
        },
        parent_map: {
          "model.a_X": ["model.b_X"],
          "model.b_X": ["model.a_X"],
        },
        child_map: {
          "model.a_X": ["model.b_X"],
          "model.b_X": ["model.a_X"],
        },
      },
    };

    const result = computeColumnLineage(cll as any, "model.a", "X", new Set());

    expect(Array.from(result.keys()).sort()).toEqual(["model.a", "model.b"]);
  });
});
