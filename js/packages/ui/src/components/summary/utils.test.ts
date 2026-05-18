/**
 * @file utils.test.ts
 * @description Tests for change summary utilities
 *
 * Regression coverage for DRC-3409: `unknown` column statuses (surfaced when
 * the breaking analyzer can't trace a CTE-internal change) must be counted in
 * the column-change summary, otherwise dashboard counters silently understate
 * models that show a `?` badge.
 */

import type {
  LineageGraph,
  LineageGraphNode,
} from "../../contexts/lineage/types";
import { calculateChangeSummary } from "./utils";

function makeNode(
  id: string,
  columns: Record<string, "added" | "removed" | "modified" | "unknown">,
): LineageGraphNode {
  return {
    id,
    type: "lineageGraphNode",
    position: { x: 0, y: 0 },
    data: {
      id,
      name: id,
      changeStatus: "modified",
      change: {
        category: "partial_breaking",
        columns,
      },
      parents: {},
      children: {},
    },
  } as LineageGraphNode;
}

function makeGraph(nodes: LineageGraphNode[]): LineageGraph {
  return {
    nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
    edges: {},
    modifiedSet: nodes.map((n) => n.id),
    manifestMetadata: {},
    catalogMetadata: {},
  };
}

describe("calculateChangeSummary", () => {
  it("counts added/removed/modified columns", () => {
    const graph = makeGraph([
      makeNode("model.a", {
        new_col: "added",
        dropped: "removed",
        renamed: "modified",
      }),
    ]);

    const result = calculateChangeSummary(graph);

    expect(result.col_added).toBe(1);
    expect(result.col_removed).toBe(1);
    expect(result.col_changed).toBe(1);
  });

  it("counts unknown columns as col_changed (DRC-3409 regression)", () => {
    const graph = makeGraph([
      makeNode("model.cte_unknown", {
        order_id: "unknown",
        customer_id: "unknown",
        w: "unknown",
      }),
    ]);

    const result = calculateChangeSummary(graph);

    // Without this rollup, a model showing the `?` badge would still report
    // col_changed === 0, silently understating the change footprint.
    expect(result.col_changed).toBe(3);
    expect(result.col_added).toBe(0);
    expect(result.col_removed).toBe(0);
  });

  it("counts mixed known + unknown columns together", () => {
    const graph = makeGraph([
      makeNode("model.mixed", {
        new_col: "added",
        w: "unknown",
        renamed: "modified",
      }),
    ]);

    const result = calculateChangeSummary(graph);

    expect(result.col_added).toBe(1);
    expect(result.col_changed).toBe(2); // modified + unknown
    expect(result.col_removed).toBe(0);
  });
});
