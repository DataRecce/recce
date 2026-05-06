import { describe, expect, it } from "vitest";
import type { CllNodeData, ColumnLineageData } from "../../../api/cll";
import { computeLineageTabImpactSets } from "../computeLineageTabImpactSets";

function makeCll(
  nodes: Record<string, Partial<CllNodeData>>,
): ColumnLineageData {
  const fullNodes: Record<string, CllNodeData> = {};
  for (const [id, partial] of Object.entries(nodes)) {
    fullNodes[id] = {
      id,
      name: id,
      source_name: id,
      resource_type: "model",
      ...partial,
    };
  }
  return {
    current: {
      nodes: fullNodes,
      columns: {},
      parent_map: {},
      child_map: {},
    },
  };
}

describe("computeLineageTabImpactSets", () => {
  it("returns undefined sets when cll is undefined", () => {
    const result = computeLineageTabImpactSets(undefined);
    expect(result.impactingNodeIds).toBeUndefined();
    expect(result.impactedNodeIds).toBeUndefined();
  });

  it("returns undefined sets when cll is null", () => {
    const result = computeLineageTabImpactSets(null);
    expect(result.impactingNodeIds).toBeUndefined();
    expect(result.impactedNodeIds).toBeUndefined();
  });

  it("returns empty sets when cll has no nodes", () => {
    const result = computeLineageTabImpactSets(makeCll({}));
    expect(result.impactingNodeIds).toEqual(new Set());
    expect(result.impactedNodeIds).toEqual(new Set());
  });

  it("places nodes with impacted=true in BOTH sets", () => {
    const cll = makeCll({
      a: { impacted: true },
      b: {
        impacted: true,
        change_status: "modified",
        change_category: "breaking",
      },
    });
    const { impactingNodeIds, impactedNodeIds } =
      computeLineageTabImpactSets(cll);
    expect(impactedNodeIds).toEqual(new Set(["a", "b"]));
    expect(impactingNodeIds).toEqual(new Set(["a", "b"]));
  });

  it("bridges partial_breaking modified nodes into impactingNodeIds only", () => {
    // The case the PR description calls out: stg_orders has its own
    // partial_breaking change, CLL keeps `impacted=false` because the node
    // itself isn't impacted, but it DOES propagate impact downstream.
    const cll = makeCll({
      stg_orders: {
        impacted: false,
        change_status: "modified",
        change_category: "partial_breaking",
      },
    });
    const { impactingNodeIds, impactedNodeIds } =
      computeLineageTabImpactSets(cll);
    expect(impactingNodeIds).toEqual(new Set(["stg_orders"]));
    expect(impactedNodeIds).toEqual(new Set());
  });

  it("bridges removed nodes into impactingNodeIds only", () => {
    const cll = makeCll({
      legacy_table: { impacted: false, change_status: "removed" },
    });
    const { impactingNodeIds, impactedNodeIds } =
      computeLineageTabImpactSets(cll);
    expect(impactingNodeIds).toEqual(new Set(["legacy_table"]));
    expect(impactedNodeIds).toEqual(new Set());
  });

  it("excludes non_breaking self-modified nodes from BOTH sets", () => {
    // The bug guard: a non_breaking modified parent (e.g., adding an unused
    // column) must NOT mark downstream as impacted, and must NOT mark itself
    // as impacting in the upstream rail of its children.
    const cll = makeCll({
      stg_silent: {
        impacted: false,
        change_status: "modified",
        change_category: "non_breaking",
      },
    });
    const { impactingNodeIds, impactedNodeIds } =
      computeLineageTabImpactSets(cll);
    expect(impactingNodeIds).toEqual(new Set());
    expect(impactedNodeIds).toEqual(new Set());
  });

  it("excludes added nodes when impacted is not true", () => {
    // Added nodes don't impact existing models (downstream consumers don't
    // exist yet). CLL leaves `impacted=false`; the bridge does not promote
    // them.
    const cll = makeCll({
      newly_added: { impacted: false, change_status: "modified" },
    });
    const { impactingNodeIds, impactedNodeIds } =
      computeLineageTabImpactSets(cll);
    expect(impactingNodeIds).toEqual(new Set());
    expect(impactedNodeIds).toEqual(new Set());
  });

  it("handles a mixed graph in a single pass", () => {
    const cll = makeCll({
      breaking_src: {
        impacted: true,
        change_status: "modified",
        change_category: "breaking",
      },
      partial_src: {
        impacted: false,
        change_status: "modified",
        change_category: "partial_breaking",
      },
      removed_src: { impacted: false, change_status: "removed" },
      silent_src: {
        impacted: false,
        change_status: "modified",
        change_category: "non_breaking",
      },
      pure_downstream: { impacted: true },
      untouched: {},
    });
    const { impactingNodeIds, impactedNodeIds } =
      computeLineageTabImpactSets(cll);
    expect(impactingNodeIds).toEqual(
      new Set([
        "breaking_src",
        "partial_src",
        "removed_src",
        "pure_downstream",
      ]),
    );
    expect(impactedNodeIds).toEqual(
      new Set(["breaking_src", "pure_downstream"]),
    );
  });
});
