import { useCallback, useState } from "react";

export interface ImpactSets {
  nodeIds: Set<string>;
  columnIds: Set<string>;
}

export interface UsePublishedImpactSetsResult {
  impactedNodeIds: Set<string>;
  impactedColumnIds: Set<string>;
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

  const publish = useCallback((sets: ImpactSets) => {
    setImpactedNodeIds(sets.nodeIds);
    setImpactedColumnIds(sets.columnIds);
  }, []);

  return { impactedNodeIds, impactedColumnIds, publish };
}
