import { useCallback, useState } from "react";

export interface ImpactSets {
  nodeIds: Set<string>;
  columnIds: Set<string>;
  wholeModelImpactedNodeIds: Set<string>;
  wholeModelChangedNodeIds: Set<string>;
}

export interface UsePublishedImpactSetsResult {
  impactedNodeIds: Set<string>;
  impactedColumnIds: Set<string>;
  wholeModelImpactedNodeIds: Set<string>;
  wholeModelChangedNodeIds: Set<string>;
  publish: (sets: ImpactSets) => void;
}

// Stable empty-set reference for the whole-model initial state (before the
// first `publish`). A fresh `new Set()` here would break the `Object.is`
// bailout in `setState`, causing extra renders on refresh.
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

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
  >(() => EMPTY_SET as Set<string>);
  const [wholeModelChangedNodeIds, setWholeModelChangedNodeIds] = useState<
    Set<string>
  >(() => EMPTY_SET as Set<string>);

  const publish = useCallback((sets: ImpactSets) => {
    setImpactedNodeIds(sets.nodeIds);
    setImpactedColumnIds(sets.columnIds);
    setWholeModelImpactedNodeIds(sets.wholeModelImpactedNodeIds);
    setWholeModelChangedNodeIds(sets.wholeModelChangedNodeIds);
  }, []);

  return {
    impactedNodeIds,
    impactedColumnIds,
    wholeModelImpactedNodeIds,
    wholeModelChangedNodeIds,
    publish,
  };
}
