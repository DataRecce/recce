import type { LineageViewContextType } from "../../contexts/lineage/types";
import type { WholeModelTreatmentKind } from "./wholeModelTreatment";

export interface GraphBadgeMeta {
  text: string;
  tooltip: string;
  ariaLabel: string;
  testId: string;
}

/**
 * Metadata for the LineageNode graph-badge surface. Returns `null` for
 * whole-model kinds (`changed`, `impacted`) — those are signalled by
 * NodeView's title chip + left stripe, not by a graph badge.
 */
export function getGraphBadgeMeta(
  kind: WholeModelTreatmentKind,
): GraphBadgeMeta | null {
  switch (kind) {
    case "additive":
      return {
        text: "ADD",
        tooltip: "Additive change",
        ariaLabel: "additive change",
        testId: "whole-model-additive-badge",
      };
    case "column-changed":
      return {
        text: "COLUMN",
        tooltip: "Column-only change",
        ariaLabel: "column-only change",
        testId: "column-changed-badge",
      };
    case "column-impacted":
      return {
        text: "COLUMN",
        tooltip: "Column-only impact",
        ariaLabel: "column-only impact",
        testId: "column-impacted-badge",
      };
    case "changed":
    case "impacted":
      return null;
  }
}

export interface TitleChipMeta {
  tooltip: string;
  ariaLabel: string;
}

/**
 * Metadata for the NodeView title-chip surface. Returns `null` for
 * per-column kinds (`additive`, `column-changed`, `column-impacted`) —
 * those are signalled by a LineageNode graph badge, not by a title chip.
 */
export function getTitleChipMeta(
  kind: WholeModelTreatmentKind,
): TitleChipMeta | null {
  switch (kind) {
    case "changed":
      return {
        tooltip: "Whole-model change",
        ariaLabel: "whole-model change",
      };
    case "impacted":
      return {
        tooltip: "Whole-model impact",
        ariaLabel: "whole-model impact",
      };
    case "additive":
    case "column-changed":
    case "column-impacted":
      return null;
  }
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
