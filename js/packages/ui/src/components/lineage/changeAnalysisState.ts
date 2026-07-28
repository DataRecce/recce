import type { CllInput } from "../../api/cll";
import type { LineageGraph } from "../../contexts/lineage/types";

/**
 * Pure state transitions for CLL change analysis ("Impact Radius").
 *
 * `changeAnalysisMode` is an independent boolean, deliberately kept out of
 * `viewOptions.column_level_lineage`: column clicks replace the CllInput
 * wholesale, so a flag stored inside it would be lost on every navigation.
 * The transitions below are the single source of truth for how the two pieces
 * of state move together; the lineage view and its controls call them instead
 * of re-deriving the rules inline.
 *
 * Internal to the lineage package — not exported from any barrel.
 */

/**
 * CllInput for Impact Radius. Without a node id this is Layer 2 (global
 * impact); with one it is the node-scoped radius used by the context menu.
 */
export function impactRadiusCllInput(nodeId?: string): CllInput {
  return nodeId
    ? { node_id: nodeId, change_analysis: true, no_upstream: true }
    : { change_analysis: true, no_upstream: true };
}

/**
 * CllInput for a column click (Layer 3). Carries only the node and column —
 * change analysis lives in `changeAnalysisMode`, not here.
 */
export function columnClickCllInput(nodeId: string, column: string): CllInput {
  return { node_id: nodeId, column };
}

/**
 * The CllInput actually sent to the API. An explicit `change_analysis` from
 * viewOptions wins; otherwise the independent mode flag is injected, which is
 * what keeps change analysis attached across column navigation.
 */
export function buildCllApiInput(
  cllInput: CllInput,
  changeAnalysisMode: boolean,
): CllInput {
  return {
    ...cllInput,
    change_analysis: cllInput.change_analysis ?? changeAnalysisMode,
  };
}

/**
 * `changeAnalysisMode` after the CLL input changes.
 *
 * Clearing CLL turns change analysis off, except in the new CLL experience
 * where impact is a one-way ratchet and stays on.
 */
export function nextChangeAnalysisMode({
  cllInput,
  changeAnalysisMode,
  newCllExperience,
}: {
  cllInput: CllInput | undefined;
  changeAnalysisMode: boolean;
  newCllExperience: boolean;
}): boolean {
  if (!cllInput && !newCllExperience) {
    return false;
  }
  return changeAnalysisMode;
}

/**
 * CllInput for reset (the X button) when there is no history entry to restore.
 * In the new CLL experience with impact on, reset drops from Layer 3 back to
 * Layer 2 instead of clearing CLL entirely.
 */
export function resolveResetCllInput({
  changeAnalysisMode,
  newCllExperience,
}: {
  changeAnalysisMode: boolean;
  newCllExperience: boolean;
}): CllInput | undefined {
  return newCllExperience && changeAnalysisMode
    ? impactRadiusCllInput()
    : undefined;
}

/**
 * Whether a node renders its change-analysis treatment.
 *
 * While the radius is scoped to a single node (node id, no column) only that
 * node shows it; once a column is selected every changed node does.
 */
export function isNodeShowingChangeAnalysis({
  nodeId,
  changeAnalysisMode,
  cllInput,
  lineageGraph,
}: {
  nodeId: string;
  changeAnalysisMode: boolean;
  cllInput: CllInput | undefined;
  lineageGraph: LineageGraph | undefined;
}): boolean {
  if (!lineageGraph || !changeAnalysisMode) {
    return false;
  }

  const node =
    nodeId in lineageGraph.nodes ? lineageGraph.nodes[nodeId] : undefined;

  if (cllInput?.node_id && !cllInput.column) {
    return cllInput.node_id === nodeId && !!node?.data.changeStatus;
  }
  return !!node?.data.changeStatus;
}
