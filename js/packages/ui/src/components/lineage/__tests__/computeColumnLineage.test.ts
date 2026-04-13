import { describe, expect, it } from "vitest";
import { computeColumnLineage } from "../computeColumnLineage";

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
