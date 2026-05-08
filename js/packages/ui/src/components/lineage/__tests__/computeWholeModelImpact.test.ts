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
    expect(result.wholeModelImpactedNodeIds.size).toBe(0);
    expect(result.breakingSourceNodeIds.size).toBe(0);
    expect(result.causeMap.size).toBe(0);
  });

  it("includes the breaking node itself as whole-model-impacted and source", () => {
    const graph = makeGraph([["a", "b"]]);
    const cll = makeCll(["a"], ["a", "b"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelImpactedNodeIds.has("a")).toBe(true);
    expect(result.breakingSourceNodeIds.has("a")).toBe(true);
    // The breaking node is its own cause — sidebar header reads the cause
    // and decides whether to phrase as "in this model" vs "downstream of X".
    expect(result.causeMap.get("a")).toEqual(new Set(["a"]));
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
    expect(result.wholeModelImpactedNodeIds.has("a")).toBe(true);
    expect(result.wholeModelImpactedNodeIds.has("b")).toBe(true);
    expect(result.wholeModelImpactedNodeIds.has("c")).toBe(true);
    expect(result.wholeModelImpactedNodeIds.has("d")).toBe(true);
    // Only `a` is a source — the rest are downstream-only.
    expect(result.breakingSourceNodeIds).toEqual(new Set(["a"]));
    // All downstream nodes share the same single cause (the only breaking
    // ancestor).
    expect(result.causeMap.get("b")).toEqual(new Set(["a"]));
    expect(result.causeMap.get("c")).toEqual(new Set(["a"]));
    expect(result.causeMap.get("d")).toEqual(new Set(["a"]));
  });

  it("does not propagate whole-model impact to upstream of a breaking node", () => {
    // up -> a (breaking) -> down
    const graph = makeGraph([
      ["up", "a"],
      ["a", "down"],
    ]);
    const cll = makeCll(["a"], ["up", "a", "down"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.wholeModelImpactedNodeIds.has("up")).toBe(false);
    expect(result.wholeModelImpactedNodeIds.has("a")).toBe(true);
    expect(result.wholeModelImpactedNodeIds.has("down")).toBe(true);
  });

  it("picks the closest breaking ancestor when a node has multiple breaking upstreams", () => {
    // a (breaking) -> b (breaking) -> c
    // BFS visits c at distance 1 from b (the closer breaking ancestor),
    // not distance 2 from a.
    const graph = makeGraph([
      ["a", "b"],
      ["b", "c"],
    ]);
    const cll = makeCll(["a", "b"], ["a", "b", "c"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.causeMap.get("c")).toEqual(new Set(["b"]));
    // Both a and b are sources of their own waves. Per Q11 (source wins),
    // b classifies as a source even though it is also downstream of a.
    expect(result.breakingSourceNodeIds).toEqual(new Set(["a", "b"]));
    // b's own cause is itself (it is both impacted-by-a and a source).
    expect(result.causeMap.get("b")).toEqual(new Set(["b"]));
  });

  it("collects ALL closest breaking ancestors at the same BFS distance (Q7)", () => {
    // a (breaking) -> c -> d
    // b (breaking) -> c -> d
    // c sees both `a` and `b` at distance 1 — the cause map for c (and
    // therefore d, at distance 2) should list both ancestors.
    const graph = makeGraph([
      ["a", "c"],
      ["b", "c"],
      ["c", "d"],
    ]);
    const cll = makeCll(["a", "b"], ["a", "b", "c", "d"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.causeMap.get("c")).toEqual(new Set(["a", "b"]));
    expect(result.causeMap.get("d")).toEqual(new Set(["a", "b"]));
  });

  it("handles a diamond — both branches reach the join node from a single cause", () => {
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
    expect(result.wholeModelImpactedNodeIds.size).toBe(4);
    expect(result.causeMap.get("d")).toEqual(new Set(["a"]));
  });

  it("handles a diamond with mixed breaking and non-breaking branch midpoints", () => {
    // a (breaking)         -> mid1            -> tip
    // a                    -> mid2 (breaking) -> tip
    // mid2 is breaking and downstream of a — it classifies as a source
    // (Q11 source wins). tip sees mid2 at distance 1 (the closer breaking
    // ancestor, replacing a at distance 2).
    const graph = makeGraph([
      ["a", "mid1"],
      ["a", "mid2"],
      ["mid1", "tip"],
      ["mid2", "tip"],
    ]);
    const cll = makeCll(["a", "mid2"], ["a", "mid1", "mid2", "tip"]);
    const result = computeWholeModelImpact(graph as any, cll as any);
    expect(result.breakingSourceNodeIds).toEqual(new Set(["a", "mid2"]));
    // tip's only closest cause is mid2 (distance 1), not a (distance 2).
    expect(result.causeMap.get("tip")).toEqual(new Set(["mid2"]));
    // mid1 — non-breaking, distance 1 from a — has cause `a`.
    expect(result.causeMap.get("mid1")).toEqual(new Set(["a"]));
    // mid2 is its own cause (Q11 — source wins absorbs the upstream).
    expect(result.causeMap.get("mid2")).toEqual(new Set(["mid2"]));
  });
});
