import type { ColumnLineageData } from "../../api/cll";
import type { LineageGraph } from "../../contexts/lineage/types";

/**
 * Result of whole-model-impact propagation.
 *
 * - `wholeModelImpactedNodeIds`: every model that is downstream of (or is) a
 *   node whose CLL `change_category` is `"breaking"` (i.e. has a *whole-model
 *   change* in the new vocabulary). The whole-model-changed node itself is
 *   included so the visual treatment lights up the originating model too.
 * - `breakingSourceNodeIds`: the subset of `wholeModelImpactedNodeIds` whose
 *   own `change_category === "breaking"`. These are the "sources" of the
 *   impact wave. Per Q11 ("source wins"), a node that is both a source AND
 *   downstream of another source is still classified as a source — so the
 *   visual layer can simply check `breakingSourceNodeIds.has(id)` and render
 *   the brown (changed) treatment without re-walking the CLL.
 * - `causeMap`: for each whole-model-impacted node, the set of *closest*
 *   upstream whole-model-changed (breaking) model names. BFS guarantees
 *   "closest" — when multiple breaking ancestors reach the node at the same
 *   minimum distance, all of them are recorded. Used to caption the sidebar
 *   header ("Whole-model impact — downstream of <ancestor list>"). A
 *   breaking-source node maps to a single-element set containing its own
 *   name.
 */
export interface WholeModelImpactSets {
  wholeModelImpactedNodeIds: Set<string>;
  breakingSourceNodeIds: Set<string>;
  causeMap: Map<string, Set<string>>;
}

const EMPTY_RESULT: WholeModelImpactSets = {
  wholeModelImpactedNodeIds: new Set<string>(),
  breakingSourceNodeIds: new Set<string>(),
  causeMap: new Map<string, Set<string>>(),
};

/**
 * Walk the lineage graph downstream from every node whose CLL
 * `change_category` is `"breaking"` and mark every visited node as
 * whole-model-impacted.
 *
 * This is the v1 propagation rule for the `--downstream-of-breaking` feature:
 * when an upstream model has a whole-model (breaking) change — `WHERE` /
 * `GROUP BY` / row-shape edit — every downstream model has whole-model
 * impact (every column is affected). Cross-level cases (column-only upstream
 * that becomes whole-model downstream via a JOIN/WHERE/GROUP BY) are
 * deferred — the classifier in `recce/util/breaking.py` is the source of
 * truth.
 *
 * Multi-ancestor handling (Q7): when a node has multiple breaking ancestors
 * at the same minimum BFS distance, the cause map records all of them.
 * Source-wins handling (Q11): the visual layer separately consults
 * `breakingSourceNodeIds` to decide brown-vs-amber treatment.
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

  const wholeModelImpactedNodeIds = new Set<string>();
  const breakingSourceNodeIds = new Set<string>(breakingNodes);
  const causeMap = new Map<string, Set<string>>();
  // Track BFS distance per node so we keep collecting ancestors that arrive
  // at the same minimum distance and stop merging once a deeper layer is
  // reached.
  const distance = new Map<string, number>();

  // Seed every breaking node at distance 0. Each is its own cause — a
  // breaking-source node's sidebar header reads "Whole-model change in this
  // model" (handled in the visual layer; the cause map just records the
  // node's display name).
  let frontier: string[] = [];
  for (const id of breakingNodes) {
    wholeModelImpactedNodeIds.add(id);
    distance.set(id, 0);
    const name = lineageGraph.nodes[id]?.data.name ?? id;
    causeMap.set(id, new Set([name]));
    frontier.push(id);
  }

  // Walk one level at a time. At each step, we propagate the *full* cause
  // set of the parent to its children — so when two breaking ancestors
  // converge at a downstream node, the cause sets union naturally rather
  // than depending on which BFS edge was traversed first.
  let depth = 0;
  while (frontier.length > 0) {
    depth += 1;
    const next: string[] = [];
    const nextSeen = new Set<string>();
    for (const id of frontier) {
      const node = lineageGraph.nodes[id];
      if (!node) continue;
      const parentCauses = causeMap.get(id);
      if (!parentCauses) continue;
      const childIds = Object.keys(node.data.children);
      for (const childId of childIds) {
        const seenAt = distance.get(childId);
        if (seenAt !== undefined && seenAt < depth) {
          // Already locked in at a closer distance — its cause set is
          // already final. (Source-wins: a breaking source node is locked
          // at distance 0, so upstream breaking causes never override it.)
          continue;
        }
        if (seenAt === undefined) {
          // First visit at this depth.
          wholeModelImpactedNodeIds.add(childId);
          distance.set(childId, depth);
          causeMap.set(childId, new Set(parentCauses));
        } else {
          // seenAt === depth — co-equal arrival from another parent.
          const existing = causeMap.get(childId);
          if (existing) {
            for (const c of parentCauses) existing.add(c);
          } else {
            causeMap.set(childId, new Set(parentCauses));
          }
        }
        if (!nextSeen.has(childId)) {
          nextSeen.add(childId);
          next.push(childId);
        }
      }
    }
    frontier = next;
  }

  return { wholeModelImpactedNodeIds, breakingSourceNodeIds, causeMap };
}
