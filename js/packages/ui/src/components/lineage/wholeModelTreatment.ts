/**
 * Visual tokens for the DRC-3341 whole-model treatment and the adjacent
 * additive-change badge.
 *
 * Three surfaces paint from these tokens:
 * - NodeView title chip — wraps the model name in the sidebar header,
 *   colored by `fg`/`badgeBg`/`badgeBorder` (re-uses the chip palette).
 * - NodeView inline `[TABLE]` / `[ADD]` badge — small primitive in the
 *   header row, same palette as the title chip.
 * - NodeView left stripe accent — a single-color stripe along the
 *   sidebar panel root, colored by `stripeAccent`.
 * - LineageNode graph badge — same `[TABLE]`/`[ADD]` primitive painted
 *   on the lineage canvas node.
 *
 * Families:
 * - Brown (`"changed"`) — model has a whole-model change of its own.
 * - Amber (`"impacted"`) — model is downstream of a whole-model change.
 * - Green (`"additive"`) — additive-only column change (`non_breaking`).
 */

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

export function wholeModelTreatmentTokens(
  kind: WholeModelTreatmentKind,
  isDark = false,
): WholeModelTreatmentTokens {
  if (kind === "changed" || kind === "column-changed") {
    return {
      stripeAccent: "var(--schema-color-changed-accent)",
      fg: isDark ? "rgb(255 200 80)" : "rgb(160 100 0)",
      badgeBg: isDark ? "rgb(255 173 21 / 0.2)" : "rgb(255 173 21 / 0.25)",
      badgeBorder: "rgb(212 133 11)",
    };
  }
  if (kind === "additive") {
    return {
      stripeAccent: "var(--schema-color-added-accent)",
      fg: isDark ? "rgb(80 200 100)" : "rgb(22 110 40)",
      badgeBg: "rgb(46 160 67 / 0.2)",
      badgeBorder: isDark ? "rgb(80 200 100)" : "rgb(46 160 67)",
    };
  }
  return {
    stripeAccent: "var(--schema-color-impacted-accent)",
    fg: isDark ? "rgb(252 211 77)" : "rgb(146 64 14)",
    badgeBg: isDark ? "rgb(180 83 9 / 0.25)" : "rgb(252 211 77 / 0.35)",
    badgeBorder: isDark ? "rgb(180 83 9)" : "rgb(252 211 77)",
  };
}

/**
 * Resolve the treatment kind from the mutually-exclusive flags. Returns
 * `null` when no treatment applies.
 *
 * Precedence (changed-wins):
 * 1. `changed` — the model itself has a whole-model change.
 * 2. `impacted` — the model is downstream of a whole-model change.
 * 3. `additive` — the model's own change is purely additive.
 *
 * The short-circuit at step 1 is the first half of the changed-wins
 * invariant (Q11). The second half lives in `pickWholeModelFlags`,
 * which zeroes `isWholeModelImpacted` whenever `isWholeModelChanged` is
 * true. Defence-in-depth.
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
