/**
 * Visual tokens for the DRC-3341 whole-model treatment.
 *
 * Brown family = the model is itself a whole-model-changed source.
 * Amber family = the model is downstream of a whole-model change.
 *
 * Per Q9 of the spec: "if you see a badge, look at color — brown is the
 * cause, amber is the effect." All sites that render the wash, "ALL" badge,
 * or header line should source their colors from this helper so the brown
 * vs amber split is defined exactly once.
 */

export type WholeModelTreatmentKind = "source" | "downstream";

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
  return {
    washBg: "var(--schema-color-impacted)",
    washAccent: "var(--schema-color-impacted-accent)",
    fg: isDark ? "rgb(252 211 77)" : "rgb(146 64 14)",
    badgeBg: isDark ? "rgb(180 83 9 / 0.25)" : "rgb(252 211 77 / 0.35)",
    badgeBorder: isDark ? "rgb(180 83 9)" : "rgb(252 211 77)",
  };
}

/**
 * Resolve the treatment kind from the two mutually-exclusive flags exposed
 * by `LineageViewContext`. Returns `null` when neither applies.
 *
 * Q11 source-wins is enforced upstream: a node that is both a source and
 * downstream of another source must arrive with `isBreakingSource=true` and
 * `isWholeModelImpactedDownstream=false`. This helper does NOT re-derive
 * that — it trusts the inputs.
 */
export function wholeModelTreatmentKind(flags: {
  isBreakingSource?: boolean;
  isWholeModelImpactedDownstream?: boolean;
}): WholeModelTreatmentKind | null {
  if (flags.isBreakingSource) return "source";
  if (flags.isWholeModelImpactedDownstream) return "downstream";
  return null;
}
