import { useCallback, useState } from "react";

export interface ImpactSets {
  nodeIds: Set<string>;
  columnIds: Set<string>;
  wholeModelImpactedNodeIds?: Set<string>;
  wholeModelChangedNodeIds?: Set<string>;
}

export interface UsePublishedImpactSetsResult {
  impactedNodeIds: Set<string>;
  impactedColumnIds: Set<string>;
  wholeModelImpactedNodeIds: Set<string>;
  wholeModelChangedNodeIds: Set<string>;
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
  const [wholeModelChangedNodeIds, setWholeModelChangedNodeIds] = useState<
    Set<string>
  >(() => new Set());

  const publish = useCallback((sets: ImpactSets) => {
    setImpactedNodeIds(sets.nodeIds);
    setImpactedColumnIds(sets.columnIds);
    setWholeModelImpactedNodeIds(sets.wholeModelImpactedNodeIds ?? new Set());
    setWholeModelChangedNodeIds(sets.wholeModelChangedNodeIds ?? new Set());
  }, []);

  return {
    impactedNodeIds,
    impactedColumnIds,
    wholeModelImpactedNodeIds,
    wholeModelChangedNodeIds,
    publish,
  };
}
