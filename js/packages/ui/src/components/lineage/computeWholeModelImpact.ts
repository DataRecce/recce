import type { ColumnLineageData } from "../../api/cll";
import type { LineageGraph } from "../../contexts/lineage/types";

/**
 * Result of whole-model-impact propagation.
 *
 * - `nodeIds`: every model that is downstream of (or is) a node whose CLL
 *   `change_category` is `"breaking"`. The breaking node itself is included
 *   so the visual treatment lights up the originating model too.
 * - `causeMap`: for each whole-model-impacted node, the *closest* upstream
 *   breaking model name. Used to caption the sidebar header
 *   ("Whole-model impact — downstream of <name>"). When a node has multiple
 *   breaking ancestors, BFS picks the nearest; the breaking node itself maps
 *   to its own name.
 */
export interface WholeModelImpactSets {
  nodeIds: Set<string>;
  causeMap: Map<string, string>;
}

const EMPTY_RESULT: WholeModelImpactSets = {
  nodeIds: new Set<string>(),
  causeMap: new Map<string, string>(),
};

/**
 * Walk the lineage graph downstream from every node whose CLL
 * `change_category` is `"breaking"` and mark every visited node as
 * whole-model-impacted.
 *
 * This is the v1 propagation rule for the `--downstream-of-breaking` feature:
 * when an upstream model has a breaking change (WHERE / GROUP BY / row-shape
 * edit), every downstream model has whole-model impact (every column is
 * affected). Cross-level cases (column-level partial-breaking that becomes
 * model-level breaking via a downstream JOIN/WHERE/GROUP BY) are deferred —
 * the classifier in `recce/util/breaking.py` is the source of truth.
 *
 * Cheap BFS — runs only when the `downstream_of_breaking` server flag is on.
 */
export function computeWholeModelImpact(
  lineageGraph: LineageGraph,
  cll: ColumnLineageData,
): WholeModelImpactSets {
  const breakingNodes: string[] = [];
  for (const [nodeId, cllNode] of Object.entries(cll.current.nodes)) {
    if (cllNode.change_category === "breaking") {
      breakingNodes.push(nodeId);
    }
  }
  if (breakingNodes.length === 0) return EMPTY_RESULT;

  const nodeIds = new Set<string>();
  const causeMap = new Map<string, string>();

  // Seed the BFS frontier with every breaking node. The breaking node itself
  // counts as whole-model-impacted (its own model is affected) and is its own
  // cause for the sidebar header. We expand outward one level at a time so the
  // first time a node is reached, it's reached from the *closest* breaking
  // ancestor — that wins the cause-map slot.
  let frontier: { id: string; cause: string }[] = breakingNodes.map((id) => ({
    id,
    cause: lineageGraph.nodes[id]?.data.name ?? id,
  }));
  for (const seed of frontier) {
    nodeIds.add(seed.id);
    causeMap.set(seed.id, seed.cause);
  }

  while (frontier.length > 0) {
    const next: { id: string; cause: string }[] = [];
    for (const { id, cause } of frontier) {
      const node = lineageGraph.nodes[id];
      if (!node) continue;
      const childIds = Object.keys(node.data.children);
      for (const childId of childIds) {
        if (nodeIds.has(childId)) continue;
        nodeIds.add(childId);
        causeMap.set(childId, cause);
        next.push({ id: childId, cause });
      }
    }
    frontier = next;
  }

  return { nodeIds, causeMap };
}
