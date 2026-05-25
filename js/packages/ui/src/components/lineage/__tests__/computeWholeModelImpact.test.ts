import { describe, expect, it } from "vitest";
import { computeWholeModelImpact } from "../computeWholeModelImpact";

function makeGraph(edges: [string, string][]) {
  const nodes: Record<string, any> = {};
  function ensure(id: string) {
    nodes[id] ??= {
      id,
      data: {
        id,
        name: id,
        parents: {} as Record<string, unknown>,
        children: {} as Record<string, unknown>,
      },
    };
    return nodes[id];
  }
  for (const [src, dst] of edges) {
    const s = ensure(src);
    const d = ensure(dst);
    s.data.children[dst] = {};
    d.data.parents[src] = {};
  }
  return {
    nodes,
    edges: {},
    modifiedSet: [],
    manifestMetadata: {},
    catalogMetadata: {},
  };
}

function makeCll(changedNodes: string[], allNodeIds: string[]) {
  const nodes: Record<string, any> = {};
  for (const id of allNodeIds) {
    nodes[id] = {
      id,
      name: id,
      source_name: id,
      resource_type: "model",
      change_category: changedNodes.includes(id) ? "breaking" : "non_breaking",
    };
  }
  return {
    current: {
      nodes,
      columns: {},
      parent_map: {},
      child_map: {},
    },
  };
}

describe("computeWholeModelImpact", () => {
  it("returns empty sets when no node has a whole-model change", () => {
    const graph = makeGraph([
      ["a", "b"],
      ["b", "c"],
    ]);
    const cll = makeCll([], ["a", "b", "c"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelImpactedNodeIds.size).toBe(0);
    expect(result.wholeModelChangedNodeIds.size).toBe(0);
  });

  it("includes a whole-model-changed model in both sets", () => {
    const graph = makeGraph([["a", "b"]]);
    const cll = makeCll(["a"], ["a", "b"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelChangedNodeIds).toEqual(new Set(["a"]));
    expect(result.wholeModelImpactedNodeIds.has("a")).toBe(true);
  });

  it("propagates whole-model impact downstream transitively", () => {
    // a (changed) -> b -> c
    const graph = makeGraph([
      ["a", "b"],
      ["b", "c"],
    ]);
    const cll = makeCll(["a"], ["a", "b", "c"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelImpactedNodeIds).toEqual(new Set(["a", "b", "c"]));
    expect(result.wholeModelChangedNodeIds).toEqual(new Set(["a"]));
  });

  it("unions impacted sets across two changed sources with overlapping downstream", () => {
    // a (changed) -> shared -> tip
    // b (changed) -> shared -> tip
    const graph = makeGraph([
      ["a", "shared"],
      ["b", "shared"],
      ["shared", "tip"],
    ]);
    const cll = makeCll(["a", "b"], ["a", "b", "shared", "tip"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelImpactedNodeIds).toEqual(
      new Set(["a", "b", "shared", "tip"]),
    );
    expect(result.wholeModelChangedNodeIds).toEqual(new Set(["a", "b"]));
  });

  it("terminates on a cycle (a -> b -> a)", () => {
    // If BFS forgot to track `visited`, this would loop forever and
    // vitest would time out before reaching the assertion.
    const graph = makeGraph([
      ["a", "b"],
      ["b", "a"],
    ]);
    const cll = makeCll(["a"], ["a", "b"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelImpactedNodeIds).toEqual(new Set(["a", "b"]));
    expect(result.wholeModelChangedNodeIds).toEqual(new Set(["a"]));
  });
});
