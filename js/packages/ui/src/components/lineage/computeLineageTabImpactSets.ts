import type { ColumnLineageData } from "../../api";

export interface LineageTabImpactSets {
  /**
   * Nodes that propagate impact downward. Drives the upstream rail in the
   * Lineage tab — answers "does this parent affect me?".
   *
   * Superset of `impactedNodeIds`. The bridge cases (`partial_breaking`,
   * `removed`) are added because CLL leaves their own `impacted` flag false
   * even though they propagate impact through their children.
   */
  impactingNodeIds: Set<string> | undefined;
  /**
   * Nodes with `cll.impacted === true`. Drives the downstream rail and the
   * unchanged-but-impacted dot color. Strict by design — a `non_breaking`
   * self-modified parent must NOT appear here.
   */
  impactedNodeIds: Set<string> | undefined;
}

/**
 * Build the per-direction impact sets the Lineage tab consumes from CLL.
 *
 * Returns `undefined` sets when CLL is absent so callers can skip wiring
 * marks (matches the "no impact analysis" rendering path).
 */
export function computeLineageTabImpactSets(
  cll: ColumnLineageData | undefined | null,
): LineageTabImpactSets {
  const cllNodes = cll?.current.nodes;
  if (!cllNodes) {
    return { impactingNodeIds: undefined, impactedNodeIds: undefined };
  }
  const impacting = new Set<string>();
  const impacted = new Set<string>();
  for (const [id, n] of Object.entries(cllNodes)) {
    if (n.impacted === true) {
      impacted.add(id);
      impacting.add(id);
    } else if (
      n.change_category === "partial_breaking" ||
      n.change_status === "removed"
    ) {
      impacting.add(id);
    }
  }
  return { impactingNodeIds: impacting, impactedNodeIds: impacted };
}
