import { describe, expect, it } from "vitest";
import { computeWholeModelImpact } from "../computeWholeModelImpact";

/**
 * Build a minimal LineageGraph with the given parent→child edges.
 * Each node carries a display name = the node id (so cause-map lookups have
 * something to match on).
 */
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

function makeCll(breakingNodes: string[], allNodeIds: string[]) {
  const nodes: Record<string, any> = {};
  for (const id of allNodeIds) {
    nodes[id] = {
      id,
      name: id,
      source_name: id,
      resource_type: "model",
      change_category: breakingNodes.includes(id) ? "breaking" : "non_breaking",
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
  it("returns empty sets when no node is breaking", () => {
    const graph = makeGraph([
      ["a", "b"],
      ["b", "c"],
    ]);
    const cll = makeCll([], ["a", "b", "c"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.nodeIds.size).toBe(0);
    expect(result.causeMap.size).toBe(0);
  });

  it("includes the breaking node itself as whole-model-impacted", () => {
    const graph = makeGraph([["a", "b"]]);
    const cll = makeCll(["a"], ["a", "b"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.nodeIds.has("a")).toBe(true);
    // The breaking node is its own cause — sidebar header reads the cause
    // and decides whether to phrase as "in this model" vs "downstream of X".
    expect(result.causeMap.get("a")).toBe("a");
  });

  it("propagates whole-model impact to every downstream node (transitively)", () => {
    // a (breaking) -> b -> c -> d
    const graph = makeGraph([
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ]);
    const cll = makeCll(["a"], ["a", "b", "c", "d"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.nodeIds.has("a")).toBe(true);
    expect(result.nodeIds.has("b")).toBe(true);
    expect(result.nodeIds.has("c")).toBe(true);
    expect(result.nodeIds.has("d")).toBe(true);
    // All downstream nodes share the same cause (the only breaking ancestor).
    expect(result.causeMap.get("b")).toBe("a");
    expect(result.causeMap.get("c")).toBe("a");
    expect(result.causeMap.get("d")).toBe("a");
  });

  it("does not propagate whole-model impact to upstream of a breaking node", () => {
    // up -> a (breaking) -> down
    const graph = makeGraph([
      ["up", "a"],
      ["a", "down"],
    ]);
    const cll = makeCll(["a"], ["up", "a", "down"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.nodeIds.has("up")).toBe(false);
    expect(result.nodeIds.has("a")).toBe(true);
    expect(result.nodeIds.has("down")).toBe(true);
  });

  it("picks the closest breaking ancestor when a node has multiple breaking upstreams", () => {
    // a (breaking) -> b (breaking) -> c
    // BFS visits b at distance 1 from b *before* it would visit c at
    // distance 2 from a, so c's cause should be b.
    const graph = makeGraph([
      ["a", "b"],
      ["b", "c"],
    ]);
    const cll = makeCll(["a", "b"], ["a", "b", "c"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.causeMap.get("c")).toBe("b");
  });

  it("handles a diamond — both branches reach the join node", () => {
    // a (breaking) -> b -> d
    // a            -> c -> d
    const graph = makeGraph([
      ["a", "b"],
      ["a", "c"],
      ["b", "d"],
      ["c", "d"],
    ]);
    const cll = makeCll(["a"], ["a", "b", "c", "d"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.nodeIds.size).toBe(4);
    expect(result.causeMap.get("d")).toBe("a");
  });
});
