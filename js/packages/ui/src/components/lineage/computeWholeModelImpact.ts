import type { ColumnLineageData } from "../../api/cll";
import type { LineageGraph } from "../../contexts/lineage/types";

/**
 * Result of whole-model impact propagation.
 *
 * - `wholeModelImpactedNodeIds`: every BFS-reachable downstream node,
 *   including the whole-model-changed models themselves (a changed model is
 *   trivially "impacted by itself" — keeps consumers from special-casing).
 * - `wholeModelChangedNodeIds`: subset of the above whose own CLL
 *   `change_category === "breaking"`. These are the roots of the impact
 *   waves. Per Q11 (changed-wins), consumers paint a node in this set as
 *   *changed* even though it also appears in `wholeModelImpactedNodeIds`.
 */
export interface WholeModelImpactSets {
  wholeModelImpactedNodeIds: Set<string>;
  wholeModelChangedNodeIds: Set<string>;
}

/**
 * BFS the lineage graph downstream from every node whose CLL
 * `change_category === "breaking"`. Cheap — runs only when the
 * `new_cll_experience` server flag is on.
 */
export function computeWholeModelImpact(
  lineageGraph: LineageGraph,
  cll: ColumnLineageData,
): WholeModelImpactSets {
  const changedNodes: string[] = [];
  for (const [nodeId, cllNode] of Object.entries(cll.current.nodes)) {
    if (cllNode.change_category === "breaking") {
      changedNodes.push(nodeId);
    }
  }
  if (changedNodes.length === 0) {
    return {
      wholeModelImpactedNodeIds: new Set<string>(),
      wholeModelChangedNodeIds: new Set<string>(),
    };
  }

  const wholeModelImpactedNodeIds = new Set<string>(changedNodes);
  const wholeModelChangedNodeIds = new Set<string>(changedNodes);

  const visited = new Set<string>(changedNodes);
  let frontier: string[] = [...changedNodes];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = lineageGraph.nodes[id];
      if (!node) continue;
      for (const childId of Object.keys(node.data.children)) {
        if (visited.has(childId)) continue;
        visited.add(childId);
        wholeModelImpactedNodeIds.add(childId);
        next.push(childId);
      }
    }
    frontier = next;
  }

  return { wholeModelImpactedNodeIds, wholeModelChangedNodeIds };
}
