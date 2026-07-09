/**
 * Resolution pipeline + visual tokens for the DRC-3341 whole-model
 * treatment and the adjacent column-only / additive badges.
 *
 * Two render surfaces, each with its own classifier:
 *
 * - **Title chip** (NodeView) — wraps the model name in the sidebar header,
 *   plus the left stripe on the panel root. Only paints whole-model kinds
 *   (`changed`, `impacted`). Call `pickTitleChip`.
 *
 * - **Graph badge** (LineageNode) — `[ADD]` / `[COLUMN]` chip on the lineage
 *   canvas node. Only paints column-only kinds (`additive`, `column-changed`,
 *   `column-impacted`). Call `pickGraphBadge`.
 *
 * Palettes (shared across surfaces):
 * - Brown — `changed` and `column-changed`.
 * - Amber — `impacted` and `column-impacted`.
 * - Green — `additive`.
 *
 * Precedence (changed-wins, Q11) is enforced inside the classifiers:
 * `isWholeModelChanged` outranks `isWholeModelImpacted`, and whole-model
 * kinds outrank column-only kinds. Callers don't need to pre-zero flags.
 */

import type { LineageViewContextType } from "../../contexts/lineage/types";
import type { ChangeCategory } from "./nodes";
import {
  cllAdditiveAccent,
  cllAdditiveBadgeBg,
  cllAdditiveBadgeFg,
  cllChangedAccent,
  cllChangedBadgeBg,
  cllChangedBadgeFg,
  cllImpactedAccent,
  cllImpactedBadgeBg,
  cllImpactedBadgeFg,
  formatNodeTooltip,
} from "./styles";

// =============================================================================
// Types
// =============================================================================

export type TitleChipKind = "changed" | "impacted";
export type GraphBadgeKind = "additive" | "column-changed" | "column-impacted";

/**
 * Raw inputs consumed by the surface classifiers. `newCllExperience` gates
 * the entire pipeline (the `new_cll_experience` server flag); when false,
 * every classifier returns `null` and no treatment renders.
 */
export interface TreatmentInputs {
  newCllExperience: boolean;
  isWholeModelChanged: boolean;
  isWholeModelImpacted: boolean;
  isImpacted: boolean;
  changeCategory?: ChangeCategory;
}

export interface WholeModelTreatmentTokens {
  /** Left stripe accent on the panel + chip border on the title chip. */
  stripeAccent: string;
  /** Foreground text color (chip text + badge text). */
  fg: string;
  /** Chip / badge background. */
  badgeBg: string;
  /** Chip / badge border. */
  badgeBorder: string;
}

export interface TitleChipResolution {
  kind: TitleChipKind;
  tooltip: string;
  ariaLabel: string;
  tokens: WholeModelTreatmentTokens;
}

export interface GraphBadgeResolution {
  kind: GraphBadgeKind;
  text: string;
  tooltip: string;
  ariaLabel: string;
  testId: string;
  tokens: WholeModelTreatmentTokens;
}

// =============================================================================
// Source → flags
// =============================================================================

/**
 * Resolve `{isWholeModelChanged, isWholeModelImpacted}` for a node as raw
 * set lookups. Precedence between the two is enforced by the surface
 * classifiers (`pickTitleChip`, `pickGraphBadge`), not here.
 */
export function pickWholeModelFlags(
  modelId: string,
  ctx: Pick<
    LineageViewContextType,
    "wholeModelChangedNodeIds" | "wholeModelImpactedNodeIds"
  >,
): { isWholeModelChanged: boolean; isWholeModelImpacted: boolean } {
  return {
    isWholeModelChanged: ctx.wholeModelChangedNodeIds.has(modelId),
    isWholeModelImpacted: ctx.wholeModelImpactedNodeIds.has(modelId),
  };
}

// =============================================================================
// Surface classifiers
// =============================================================================

const TITLE_CHIP_LABELS: Record<
  TitleChipKind,
  { tooltip: string; ariaLabel: string }
> = {
  changed: {
    tooltip: "Whole-model change",
    ariaLabel: "whole-model change",
  },
  impacted: {
    tooltip: "Whole-model impact",
    ariaLabel: "whole-model impact",
  },
};

const GRAPH_BADGE_LABELS: Record<
  GraphBadgeKind,
  { text: string; tooltip: string; ariaLabel: string; testId: string }
> = {
  additive: {
    text: "ADD",
    tooltip: "Additive change",
    ariaLabel: "additive change",
    testId: "whole-model-additive-badge",
  },
  "column-changed": {
    text: "COLUMN",
    tooltip: "Column-only change",
    ariaLabel: "column-only change",
    testId: "column-changed-badge",
  },
  "column-impacted": {
    text: "COLUMN",
    tooltip: "Column-only impact",
    ariaLabel: "column-only impact",
    testId: "column-impacted-badge",
  },
};

function classifyTitleChip(inputs: TreatmentInputs): TitleChipKind | null {
  if (!inputs.newCllExperience) return null;
  if (inputs.isWholeModelChanged) return "changed";
  if (inputs.isWholeModelImpacted) return "impacted";
  return null;
}

function classifyGraphBadge(inputs: TreatmentInputs): GraphBadgeKind | null {
  if (!inputs.newCllExperience) return null;
  // Whole-model kinds short-circuit the badge — their signal lives on the
  // NodeView title chip + stripe instead.
  if (inputs.isWholeModelChanged || inputs.isWholeModelImpacted) return null;
  // Precedence: own column change (partial_breaking) > impact > own additive
  // change (non_breaking). isImpacted must outrank "non_breaking" so a node
  // that is impacted upstream but only additively changed itself surfaces the
  // actionable column-impacted badge rather than the benign additive one
  // (DRC-3813). partial_breaking still wins over impact per changed-wins (Q11).
  if (inputs.changeCategory === "partial_breaking") return "column-changed";
  if (inputs.isImpacted) return "column-impacted";
  if (inputs.changeCategory === "non_breaking") return "additive";
  return null;
}

/**
 * Resolve the title chip for NodeView's header (and the matching left
 * stripe). Returns `null` when no whole-model treatment applies.
 */
export function pickTitleChip(
  inputs: TreatmentInputs,
  isDark: boolean,
): TitleChipResolution | null {
  const kind = classifyTitleChip(inputs);
  if (!kind) return null;
  return {
    kind,
    ...TITLE_CHIP_LABELS[kind],
    tokens: tokensForKind(kind, isDark),
  };
}

/**
 * Resolve the per-column graph badge for a LineageNode. Returns `null`
 * when the node has no badge — either because the server flag is off,
 * no column-only treatment applies, or a whole-model kind takes precedence.
 */
export function pickGraphBadge(
  inputs: TreatmentInputs,
  isDark: boolean,
): GraphBadgeResolution | null {
  const kind = classifyGraphBadge(inputs);
  if (!kind) return null;
  return {
    kind,
    ...GRAPH_BADGE_LABELS[kind],
    tokens: tokensForKind(kind, isDark),
  };
}

// =============================================================================
// Visual tokens
// =============================================================================

function tokensForKind(
  kind: TitleChipKind | GraphBadgeKind,
  isDark: boolean,
): WholeModelTreatmentTokens {
  const mode = isDark ? "dark" : "light";
  if (kind === "changed" || kind === "column-changed") {
    return {
      stripeAccent: "var(--schema-color-changed-accent)",
      fg: cllChangedBadgeFg[mode],
      badgeBg: cllChangedBadgeBg[mode],
      badgeBorder: cllChangedAccent,
    };
  }
  if (kind === "additive") {
    return {
      stripeAccent: "var(--schema-color-added-accent)",
      fg: cllAdditiveBadgeFg[mode],
      badgeBg: cllAdditiveBadgeBg[mode],
      badgeBorder: cllAdditiveAccent[mode],
    };
  }
  // impacted | column-impacted
  return {
    stripeAccent: "var(--schema-color-impacted-accent)",
    fg: cllImpactedBadgeFg[mode],
    badgeBg: cllImpactedBadgeBg[mode],
    badgeBorder: cllImpactedAccent[mode],
  };
}

// =============================================================================
// Unified hover tooltip
// =============================================================================

/**
 * Treatment-only suffix for hover tooltips. Returns the user-facing label
 * for whichever surface applies, or `undefined` if no treatment applies.
 * Used by both the LineageNode card and the NodeView sidebar to keep their
 * hover text in sync.
 */
export function getTreatmentTooltipSuffix(
  inputs: TreatmentInputs,
): string | undefined {
  const titleKind = classifyTitleChip(inputs);
  if (titleKind) return TITLE_CHIP_LABELS[titleKind].tooltip;
  const badgeKind = classifyGraphBadge(inputs);
  if (badgeKind) return GRAPH_BADGE_LABELS[badgeKind].tooltip;
  return undefined;
}

/**
 * Full title-row tooltip used by both LineageNode and NodeView. Combines
 * `formatNodeTooltip` ("name - kind") with the treatment suffix when one
 * applies, producing e.g. "orders - table - Whole-model change".
 */
export function getTitleRowTooltip(
  node: {
    name: string;
    resourceType?: string;
    materialized?: string;
  },
  inputs: TreatmentInputs,
): string {
  const base = formatNodeTooltip(
    node.name,
    node.resourceType,
    node.materialized,
  );
  const suffix = getTreatmentTooltipSuffix(inputs);
  return suffix ? `${base} - ${suffix}` : base;
}
