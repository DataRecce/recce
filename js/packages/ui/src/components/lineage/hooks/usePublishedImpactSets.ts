import { useCallback, useState } from "react";

export interface ImpactSets {
  nodeIds: Set<string>;
  columnIds: Set<string>;
  /**
   * Optional whole-model-impacted node IDs from the
   * `--downstream-of-breaking` propagation. Populated only when the
   * `downstream_of_breaking` server flag is on; left undefined otherwise.
   */
  wholeModelImpactedNodeIds?: Set<string>;
  /**
   * Optional set of node IDs whose own `change_category === "breaking"` —
   * the *sources* of whole-model impact waves. Subset of
   * `wholeModelImpactedNodeIds`. Drives the brown-vs-amber treatment
   * (Q9/Q10/Q11 of the `downstream-of-breaking` design): a node in this
   * set renders with the brown "changed" color family even if it is also
   * downstream of another source ("source wins").
   */
  breakingSourceNodeIds?: Set<string>;
  /**
   * Optional cause map: whole-model-impacted nodeId → set of names of the
   * closest upstream breaking models. A breaking-source node maps to its
   * own name. Drives the sidebar header text.
   */
  wholeModelImpactCauseMap?: Map<string, Set<string>>;
}

export interface UsePublishedImpactSetsResult {
  impactedNodeIds: Set<string>;
  impactedColumnIds: Set<string>;
  wholeModelImpactedNodeIds: Set<string>;
  breakingSourceNodeIds: Set<string>;
  wholeModelImpactCauseMap: Map<string, Set<string>>;
  publish: (sets: ImpactSets) => void;
}

// State (not refs) so downstream memos re-render when impact CLL populates the
// snapshot. A ref mutation would leave SchemaView latched on the initial empty
// Set. See PR #1315 for the race this guards against.
export function usePublishedImpactSets(): UsePublishedImpactSetsResult {
  const [impactedNodeIds, setImpactedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [impactedColumnIds, setImpactedColumnIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [wholeModelImpactedNodeIds, setWholeModelImpactedNodeIds] = useState<
    Set<string>
  >(() => new Set());
  const [breakingSourceNodeIds, setBreakingSourceNodeIds] = useState<
    Set<string>
  >(() => new Set());
  const [wholeModelImpactCauseMap, setWholeModelImpactCauseMap] = useState<
    Map<string, Set<string>>
  >(() => new Map());

  const publish = useCallback((sets: ImpactSets) => {
    setImpactedNodeIds(sets.nodeIds);
    setImpactedColumnIds(sets.columnIds);
    setWholeModelImpactedNodeIds(sets.wholeModelImpactedNodeIds ?? new Set());
    setBreakingSourceNodeIds(sets.breakingSourceNodeIds ?? new Set());
    setWholeModelImpactCauseMap(sets.wholeModelImpactCauseMap ?? new Map());
  }, []);

  return {
    impactedNodeIds,
    impactedColumnIds,
    wholeModelImpactedNodeIds,
    breakingSourceNodeIds,
    wholeModelImpactCauseMap,
    publish,
  };
}
