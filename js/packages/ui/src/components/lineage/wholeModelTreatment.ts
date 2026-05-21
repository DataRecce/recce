/**
 * Resolution pipeline + visual tokens for the DRC-3341 whole-model
 * treatment and the adjacent column-only / additive badges.
 *
 * Top-to-bottom: source → flags → kind → (tokens | surface metadata).
 *
 * Two surfaces consume this pipeline:
 *
 * - NodeView title chip + left stripe — wraps the model name in the sidebar
 *   header (colored by `fg` / `badgeBg` / `badgeBorder`) and paints a single
 *   accent stripe along the sidebar panel root (colored by `stripeAccent`).
 *   Only whole-model kinds (`changed`, `impacted`) reach this surface;
 *   `getTitleChipMeta` returns null for the others.
 *
 * - LineageNode graph badge — `[ADD]` / `[COLUMN]` primitive painted on the
 *   lineage canvas node. Only per-column kinds (`additive`, `column-changed`,
 *   `column-impacted`) reach this surface; `getGraphBadgeMeta` returns null
 *   for whole-model kinds.
 *
 * Palettes:
 * - Brown — `changed` (whole-model) and `column-changed` (column-only).
 * - Amber — `impacted` (whole-model) and `column-impacted` (column-only).
 * - Green — `additive` (column-only).
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

// ============================================================================
// Types
// ============================================================================

export type WholeModelTreatmentKind =
  | "changed"
  | "impacted"
  | "additive"
  | "column-changed"
  | "column-impacted";

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

export interface GraphBadgeMeta {
  text: string;
  tooltip: string;
  ariaLabel: string;
  testId: string;
}

export interface TitleChipMeta {
  tooltip: string;
  ariaLabel: string;
}

// ============================================================================
// Source → flags
// ============================================================================

/**
 * Resolve `{isWholeModelChanged, isWholeModelImpacted}` for a node, with
 * changed-wins enforced at the consumer boundary.
 *
 * This is the second half of the changed-wins invariant (Q11): a model
 * that appears in both context sets is treated as changed, never as
 * impacted. The first half lives in `wholeModelTreatmentKind`'s
 * short-circuit. Defence-in-depth.
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

// ============================================================================
// Flags → kind
// ============================================================================

/**
 * Resolve the treatment kind from the mutually-exclusive flags. Returns
 * `null` when no treatment applies.
 *
 * Precedence (changed-wins):
 * 1. `changed` — model has a whole-model change of its own.
 * 2. `impacted` — model is downstream of a whole-model change.
 * 3. `additive` — model's own change is purely additive (`non_breaking`).
 * 4. `column-changed` — model's own change is column-only (`partial_breaking`).
 * 5. `column-impacted` — model is downstream of a column-only change.
 */
export function wholeModelTreatmentKind(flags: {
  isWholeModelChanged?: boolean;
  isWholeModelImpacted?: boolean;
  isAdditive?: boolean;
  isColumnChanged?: boolean;
  isColumnImpacted?: boolean;
}): WholeModelTreatmentKind | null {
  if (flags.isWholeModelChanged) return "changed";
  if (flags.isWholeModelImpacted) return "impacted";
  if (flags.isAdditive) return "additive";
  if (flags.isColumnChanged) return "column-changed";
  if (flags.isColumnImpacted) return "column-impacted";
  return null;
}

// ============================================================================
// Kind → visual tokens
// ============================================================================

export function wholeModelTreatmentTokens(
  kind: WholeModelTreatmentKind,
  isDark = false,
): WholeModelTreatmentTokens {
  const mode = isDark ? "dark" : "light";
  switch (kind) {
    case "changed":
    case "column-changed":
      return {
        stripeAccent: "var(--schema-color-changed-accent)",
        fg: cllChangedBadgeFg[mode],
        badgeBg: cllChangedBadgeBg[mode],
        badgeBorder: cllChangedAccent,
      };
    case "additive":
      return {
        stripeAccent: "var(--schema-color-added-accent)",
        fg: cllAdditiveBadgeFg[mode],
        badgeBg: cllAdditiveBadgeBg[mode],
        badgeBorder: cllAdditiveAccent[mode],
      };
    case "impacted":
    case "column-impacted":
      return {
        stripeAccent: "var(--schema-color-impacted-accent)",
        fg: cllImpactedBadgeFg[mode],
        badgeBg: cllImpactedBadgeBg[mode],
        badgeBorder: cllImpactedAccent[mode],
      };
  }
}

// ============================================================================
// Kind → surface metadata
// ============================================================================

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

// ============================================================================
// Unified hover tooltip
// ============================================================================

/**
 * Treatment-only suffix for hover tooltips. Returns the kind's user-facing
 * label (`Whole-model change`, `Additive change`, …) or `undefined` if no
 * treatment applies. Used by both the LineageNode card and the NodeView
 * sidebar to keep their hover text in sync.
 */
export function getTreatmentTooltipSuffix(flags: {
  wholeModelImpact: boolean;
  isWholeModelChanged: boolean;
  isWholeModelImpacted: boolean;
  isImpacted: boolean;
  changeCategory?: ChangeCategory;
}): string | undefined {
  if (!flags.wholeModelImpact) return undefined;
  const kind = wholeModelTreatmentKind({
    isWholeModelChanged: flags.isWholeModelChanged,
    isWholeModelImpacted: flags.isWholeModelImpacted,
    isAdditive: flags.changeCategory === "non_breaking",
    isColumnChanged: flags.changeCategory === "partial_breaking",
    isColumnImpacted: flags.isImpacted,
  });
  if (!kind) return undefined;
  return getTitleChipMeta(kind)?.tooltip ?? getGraphBadgeMeta(kind)?.tooltip;
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
  flags: Parameters<typeof getTreatmentTooltipSuffix>[0],
): string {
  const base = formatNodeTooltip(
    node.name,
    node.resourceType,
    node.materialized,
  );
  const suffix = getTreatmentTooltipSuffix(flags);
  return suffix ? `${base} - ${suffix}` : base;
}
