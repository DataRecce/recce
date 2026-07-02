import { describe, expect, it } from "vitest";
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
} from "../styles";
import {
  pickGraphBadge,
  pickTitleChip,
  type TreatmentInputs,
} from "../wholeModelTreatment";

/**
 * Locks the visual tokens produced by `tokensForKind` (exercised through the
 * public `pickTitleChip` / `pickGraphBadge` resolvers) against the shared CLL
 * palette consts in `styles.tsx`, for every kind × (light / dark).
 *
 * These two surfaces are the only callers of `tokensForKind`, so asserting
 * their `.tokens` output covers all five kinds and both modes. If the palette
 * wiring drifts (wrong const, swapped light/dark), this fails loudly.
 */

const BASE: TreatmentInputs = {
  newCllExperience: true,
  isWholeModelChanged: false,
  isWholeModelImpacted: false,
  isImpacted: false,
};

describe("wholeModelTreatment tokens", () => {
  describe("title chip — changed", () => {
    for (const isDark of [false, true] as const) {
      const mode = isDark ? "dark" : "light";
      it(`maps the brown/changed palette in ${mode} mode`, () => {
        const res = pickTitleChip(
          { ...BASE, isWholeModelChanged: true },
          isDark,
        );
        expect(res?.kind).toBe("changed");
        expect(res?.tokens).toEqual({
          stripeAccent: "var(--schema-color-changed-accent)",
          fg: cllChangedBadgeFg[mode],
          badgeBg: cllChangedBadgeBg[mode],
          badgeBorder: cllChangedAccent,
        });
      });
    }
  });

  describe("title chip — impacted", () => {
    for (const isDark of [false, true] as const) {
      const mode = isDark ? "dark" : "light";
      it(`maps the amber/impacted palette in ${mode} mode`, () => {
        const res = pickTitleChip(
          { ...BASE, isWholeModelImpacted: true },
          isDark,
        );
        expect(res?.kind).toBe("impacted");
        expect(res?.tokens).toEqual({
          stripeAccent: "var(--schema-color-impacted-accent)",
          fg: cllImpactedBadgeFg[mode],
          badgeBg: cllImpactedBadgeBg[mode],
          badgeBorder: cllImpactedAccent[mode],
        });
      });
    }
  });

  describe("graph badge — additive", () => {
    for (const isDark of [false, true] as const) {
      const mode = isDark ? "dark" : "light";
      it(`maps the green/additive palette in ${mode} mode`, () => {
        const res = pickGraphBadge(
          { ...BASE, changeCategory: "non_breaking" }, // wire-enum-ok
          isDark,
        );
        expect(res?.kind).toBe("additive");
        expect(res?.tokens).toEqual({
          stripeAccent: "var(--schema-color-added-accent)",
          fg: cllAdditiveBadgeFg[mode],
          badgeBg: cllAdditiveBadgeBg[mode],
          badgeBorder: cllAdditiveAccent[mode],
        });
      });
    }
  });

  describe("graph badge — column-changed", () => {
    for (const isDark of [false, true] as const) {
      const mode = isDark ? "dark" : "light";
      it(`reuses the brown/changed palette in ${mode} mode`, () => {
        const res = pickGraphBadge(
          { ...BASE, changeCategory: "partial_breaking" }, // wire-enum-ok
          isDark,
        );
        expect(res?.kind).toBe("column-changed");
        expect(res?.tokens).toEqual({
          stripeAccent: "var(--schema-color-changed-accent)",
          fg: cllChangedBadgeFg[mode],
          badgeBg: cllChangedBadgeBg[mode],
          badgeBorder: cllChangedAccent,
        });
      });
    }
  });

  describe("graph badge — column-impacted", () => {
    for (const isDark of [false, true] as const) {
      const mode = isDark ? "dark" : "light";
      it(`reuses the amber/impacted palette in ${mode} mode`, () => {
        const res = pickGraphBadge({ ...BASE, isImpacted: true }, isDark);
        expect(res?.kind).toBe("column-impacted");
        expect(res?.tokens).toEqual({
          stripeAccent: "var(--schema-color-impacted-accent)",
          fg: cllImpactedBadgeFg[mode],
          badgeBg: cllImpactedBadgeBg[mode],
          badgeBorder: cllImpactedAccent[mode],
        });
      });
    }
  });
});
