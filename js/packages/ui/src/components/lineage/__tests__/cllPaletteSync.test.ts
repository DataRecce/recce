import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cllAdditiveAccent,
  cllAdditiveBadgeBg,
  cllAdditiveBadgeFg,
  cllChangedAccent,
  cllChangedBadgeBg,
  cllChangedBadgeFg,
  cllChangeStatusBackgroundsDark,
  cllChangeStatusBackgroundsLight,
  cllChangeStatusColors,
  cllImpactedAccent,
  cllImpactedBadgeBg,
  cllImpactedBadgeFg,
} from "../styles";

/**
 * Single-source-of-truth guard for the CLL palette.
 *
 * The CLL colors are declared twice: as TS consts in `lineage/styles.tsx`
 * (consumed by the React lineage canvas) and as `--schema-*` CSS custom
 * properties in `schema/style.css` (consumed by the ag-grid schema view).
 * Both files carry "keep in sync by hand — no build-time check" comments.
 *
 * This test IS that build-time check: it parses `schema/style.css` and asserts
 * every TS const matches its CSS counterpart, so drift on either side fails CI.
 * The TS consts are treated as canonical; the CSS values are verified against
 * them. (A fuller consolidation — deriving the CSS vars from TS at runtime — is
 * deferred; see DRC-3525.)
 */

const cssPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../schema/style.css",
);
const css = readFileSync(cssPath, "utf8");

/** Extract `--name: value` declarations from the first block matching a header. */
function block(header: RegExp): Record<string, string> {
  const m = header.exec(css);
  if (!m) throw new Error(`CSS block not found for header: ${header}`);
  const open = css.indexOf("{", m.index);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);
  const vars: Record<string, string> = {};
  for (const decl of body.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const name = decl.slice(0, i).trim();
    if (!name.startsWith("--")) continue;
    vars[name] = decl.slice(i + 1).trim();
  }
  return vars;
}

const rootVars = block(/:root,\s*\.light\s*\{/);
const darkVars = block(/\n\.dark\s*\{/);
const cllVars = block(/\n\.cll-experience\s*\{/);
const cllDarkVars = block(/\.dark \.cll-experience,/);

/**
 * Resolve a CSS var the way the cascade does inside `.cll-experience`:
 * the `.cll-experience` override wins, otherwise the base `:root`/`.dark` value.
 */
const lightCll = (name: string) => cllVars[name] ?? rootVars[name];
const darkCll = (name: string) => cllDarkVars[name] ?? darkVars[name];

describe("CLL palette TS ↔ CSS sync (styles.tsx ↔ schema/style.css)", () => {
  it("parses the expected CSS blocks", () => {
    expect(Object.keys(rootVars).length).toBeGreaterThan(0);
    expect(Object.keys(darkVars).length).toBeGreaterThan(0);
    expect(Object.keys(cllVars).length).toBeGreaterThan(0);
    expect(Object.keys(cllDarkVars).length).toBeGreaterThan(0);
  });

  it("accent colors match the *-accent vars", () => {
    expect(cllChangeStatusColors.modified).toBe(
      lightCll("--schema-color-changed-accent"),
    );
    expect(cllChangeStatusColors.modified).toBe(
      darkCll("--schema-color-changed-accent"),
    );
    expect(cllChangeStatusColors.impacted).toBe(
      lightCll("--schema-color-impacted-accent"),
    );
    expect(cllChangeStatusColors.impacted).toBe(
      darkCll("--schema-color-impacted-accent"),
    );
    expect(cllChangeStatusColors.added).toBe(
      lightCll("--schema-color-added-accent"),
    );
    expect(cllChangeStatusColors.removed).toBe(
      lightCll("--schema-color-removed-accent"),
    );
  });

  it("row backgrounds match the --schema-color-{changed,impacted,added,removed} vars", () => {
    // light
    expect(cllChangeStatusBackgroundsLight.modified).toBe(
      lightCll("--schema-color-changed"),
    );
    expect(cllChangeStatusBackgroundsLight.impacted).toBe(
      lightCll("--schema-color-impacted"),
    );
    expect(cllChangeStatusBackgroundsLight.added).toBe(
      lightCll("--schema-color-added"),
    );
    expect(cllChangeStatusBackgroundsLight.removed).toBe(
      lightCll("--schema-color-removed"),
    );
    // dark
    expect(cllChangeStatusBackgroundsDark.modified).toBe(
      darkCll("--schema-color-changed"),
    );
    expect(cllChangeStatusBackgroundsDark.impacted).toBe(
      darkCll("--schema-color-impacted"),
    );
    expect(cllChangeStatusBackgroundsDark.added).toBe(
      darkCll("--schema-color-added"),
    );
    expect(cllChangeStatusBackgroundsDark.removed).toBe(
      darkCll("--schema-color-removed"),
    );
  });

  it("impacted badge/accent tokens match the --schema-*impacted* vars", () => {
    expect(cllImpactedAccent.light).toBe(
      lightCll("--schema-color-impacted-accent"),
    );
    expect(cllImpactedAccent.dark).toBe(
      darkCll("--schema-color-impacted-accent"),
    );
    expect(cllImpactedBadgeBg.light).toBe(
      lightCll("--schema-badge-impacted-bg"),
    );
    expect(cllImpactedBadgeBg.dark).toBe(darkCll("--schema-badge-impacted-bg"));
    expect(cllImpactedBadgeFg.light).toBe(
      lightCll("--schema-badge-impacted-fg"),
    );
    expect(cllImpactedBadgeFg.dark).toBe(darkCll("--schema-badge-impacted-fg"));
  });

  it("changed badge/accent tokens match the --schema-*changed* vars", () => {
    expect(cllChangedAccent).toBe(lightCll("--schema-color-changed-accent"));
    expect(cllChangedAccent).toBe(darkCll("--schema-color-changed-accent"));
    expect(cllChangedBadgeBg.light).toBe(lightCll("--schema-badge-changed-bg"));
    expect(cllChangedBadgeBg.dark).toBe(darkCll("--schema-badge-changed-bg"));
    expect(cllChangedBadgeFg.light).toBe(lightCll("--schema-badge-changed-fg"));
    expect(cllChangedBadgeFg.dark).toBe(darkCll("--schema-badge-changed-fg"));
  });

  it("additive badge/accent tokens match the --schema-*added* vars", () => {
    expect(cllAdditiveAccent.light).toBe(
      lightCll("--schema-color-added-accent"),
    );
    // Intentional: the additive accent's *dark* value mirrors the added badge
    // foreground (a brighter green), not --schema-color-added-accent (which
    // stays the mid green in both modes).
    expect(cllAdditiveAccent.dark).toBe(darkCll("--schema-badge-added-fg"));
    expect(cllAdditiveBadgeBg.light).toBe(lightCll("--schema-badge-added-bg"));
    expect(cllAdditiveBadgeBg.dark).toBe(darkCll("--schema-badge-added-bg"));
    expect(cllAdditiveBadgeFg.light).toBe(lightCll("--schema-badge-added-fg"));
    expect(cllAdditiveBadgeFg.dark).toBe(darkCll("--schema-badge-added-fg"));
  });
});
