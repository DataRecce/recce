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
   * Optional cause map: whole-model-impacted nodeId → name of the closest
   * upstream breaking model. Drives the sidebar header text.
   */
  wholeModelImpactCauseMap?: Map<string, string>;
}

export interface UsePublishedImpactSetsResult {
  impactedNodeIds: Set<string>;
  impactedColumnIds: Set<string>;
  wholeModelImpactedNodeIds: Set<string>;
  wholeModelImpactCauseMap: Map<string, string>;
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
  const [wholeModelImpactCauseMap, setWholeModelImpactCauseMap] = useState<
    Map<string, string>
  >(() => new Map());

  const publish = useCallback((sets: ImpactSets) => {
    setImpactedNodeIds(sets.nodeIds);
    setImpactedColumnIds(sets.columnIds);
    setWholeModelImpactedNodeIds(sets.wholeModelImpactedNodeIds ?? new Set());
    setWholeModelImpactCauseMap(sets.wholeModelImpactCauseMap ?? new Map());
  }, []);

  return {
    impactedNodeIds,
    impactedColumnIds,
    wholeModelImpactedNodeIds,
    wholeModelImpactCauseMap,
    publish,
  };
}
