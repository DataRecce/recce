/**
 * Visual tokens for the DRC-3341 whole-model treatment and the adjacent
 * additive-change badge.
 *
 * - Brown family (`"source"`) — model is itself a whole-model-changed
 *   source. Renders the panel wash, "ALL" badge, and header line.
 * - Amber family (`"downstream"`) — model is downstream of a whole-model
 *   change. Same surfaces as source, amber-colored.
 * - Green family (`"additive"`) — model has an additive-only change
 *   (per spec §Vocabulary: `non_breaking`). Only renders a small green
 *   "ADD" badge on the lineage graph node; no sidebar wash or header
 *   (the per-column green `+` glyph already calls out the added column
 *   in the schema view).
 *
 * Per Q9 of the spec: "if you see a badge, look at color — brown is the
 * cause, amber is the effect." Green extends that: a safe local addition
 * that doesn't propagate. Every site that paints these badges sources
 * its colors from this helper.
 */

export type WholeModelTreatmentKind = "source" | "downstream" | "additive";

export interface WholeModelTreatmentTokens {
  /** Sidebar / panel wash background. */
  washBg: string;
  /** Sidebar / panel wash left-edge accent stripe. */
  washAccent: string;
  /** "ALL" badge text + header line text + header line border. */
  fg: string;
  /** "ALL" badge background. */
  badgeBg: string;
  /** "ALL" badge border. */
  badgeBorder: string;
}

export function wholeModelTreatmentTokens(
  kind: WholeModelTreatmentKind,
  isDark = false,
): WholeModelTreatmentTokens {
  if (kind === "source") {
    return {
      washBg: "var(--schema-color-changed)",
      washAccent: "var(--schema-color-changed-accent)",
      fg: isDark ? "rgb(255 200 80)" : "rgb(160 100 0)",
      badgeBg: isDark ? "rgb(255 173 21 / 0.2)" : "rgb(255 173 21 / 0.25)",
      badgeBorder: "rgb(212 133 11)",
    };
  }
  if (kind === "additive") {
    // Reuses the existing `--schema-color-added*` tokens that the per-row
    // green `+` glyph already uses for added columns in the schema view.
    // wash* fields are not painted today (additive renders badge-only),
    // but they're populated for parity with source/downstream so a future
    // panel-level signal can opt in without changing this contract.
    return {
      washBg: "var(--schema-color-added)",
      washAccent: "var(--schema-color-added-accent)",
      fg: isDark ? "rgb(80 200 100)" : "rgb(22 110 40)",
      badgeBg: "rgb(46 160 67 / 0.2)",
      badgeBorder: isDark ? "rgb(80 200 100)" : "rgb(46 160 67)",
    };
  }
  return {
    washBg: "var(--schema-color-impacted)",
    washAccent: "var(--schema-color-impacted-accent)",
    fg: isDark ? "rgb(252 211 77)" : "rgb(146 64 14)",
    badgeBg: isDark ? "rgb(180 83 9 / 0.25)" : "rgb(252 211 77 / 0.35)",
    badgeBorder: isDark ? "rgb(180 83 9)" : "rgb(252 211 77)",
  };
}

/**
 * Resolve the badge kind from the mutually-exclusive flags exposed by
 * `LineageViewContext` + the node's classifier category. Returns `null`
 * when no badge applies.
 *
 * Precedence (strongest signal wins):
 * 1. `source` — model is itself a whole-model-changed source.
 * 2. `downstream` — model is downstream of a whole-model change.
 * 3. `additive` — model's own change is purely additive AND the model is
 *    not under any whole-model treatment. The brown/amber badges win over
 *    green: an additive change consumed by a row-tainted upstream is
 *    still tainted at the row level.
 *
 * Q11 source-wins is enforced upstream by the consumer (e.g.
 * `GraphNodeOss` zeroes `isWholeModelImpactedDownstream` when
 * `isBreakingSource` is true). This helper trusts the inputs.
 */
export function wholeModelTreatmentKind(flags: {
  isBreakingSource?: boolean;
  isWholeModelImpactedDownstream?: boolean;
  isAdditive?: boolean;
}): WholeModelTreatmentKind | null {
  if (flags.isBreakingSource) return "source";
  if (flags.isWholeModelImpactedDownstream) return "downstream";
  if (flags.isAdditive) return "additive";
  return null;
}
