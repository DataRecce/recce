import type { LineageViewContextType } from "../../contexts/lineage/types";
import type { WholeModelTreatmentKind } from "./wholeModelTreatment";

export interface BadgeMeta {
  text: string;
  tooltip: string;
  ariaLabel: string;
  testId: string;
}

export function getBadgeMeta(kind: WholeModelTreatmentKind): BadgeMeta {
  if (kind === "changed") {
    return {
      text: "TABLE",
      tooltip: "Table-wide change",
      ariaLabel: "whole-model change",
      testId: "whole-model-changed-badge",
    };
  }
  if (kind === "impacted") {
    return {
      text: "TABLE",
      tooltip: "Table-wide impact",
      ariaLabel: "whole-model impact",
      testId: "whole-model-impacted-badge",
    };
  }
  return {
    text: "ADD",
    tooltip: "Additive change",
    ariaLabel: "additive change",
    testId: "whole-model-additive-badge",
  };
}

/**
 * Resolve `{isWholeModelChanged, isWholeModelImpacted}` for a node, with
 * changed-wins enforced at the consumer boundary.
 *
 * This is the second half of the changed-wins invariant (Q11): a model
 * that appears in both context sets is treated as changed, never as
 * impacted. The first half lives in `wholeModelTreatmentKind`.
 */
export function pickWholeModelFlags(
  modelId: string,
  ctx: Pick<
    LineageViewContextType,
    "wholeModelChangedNodeIds" | "wholeModelImpactedNodeIds"
  >,
): { isWholeModelChanged: boolean; isWholeModelImpacted: boolean } {
  const isWholeModelChanged = ctx.wholeModelChangedNodeIds.has(modelId);
  const isWholeModelImpacted =
    ctx.wholeModelImpactedNodeIds.has(modelId) && !isWholeModelChanged;
  return { isWholeModelChanged, isWholeModelImpacted };
}
