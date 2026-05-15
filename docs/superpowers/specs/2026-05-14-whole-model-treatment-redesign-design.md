# Whole-model treatment redesign — title-chip approach

**Status:** Approved (brainstorm phase)
**Date:** 2026-05-14
**Worktree / branch:** `worktree-downstream-of-breaking`
**Related:** DRC-3341 (whole-model treatment, original), DRC-3463 (sidebar header declutter — separate workstream)

## Background

The current whole-model NodeView treatment (DRC-3341) communicates two states by painting an entire panel:

- **Source (`~`)** — this model is the cause of a whole-model change. Brown wash + brown labeled bar above tabs ("Whole-model change in this model").
- **Downstream (`!`)** — this model is downstream of a whole-model change. Yellow wash + yellow labeled bar above tabs ("Whole-model impact").

User feedback: *the yellow bar across the top connotes "warning."* The cumulative yellow surface (faint panel wash + horizontal labeled bar with top/bottom borders) reads as a banner alert rather than as informational context. The left-edge stripe is fine; the wash and the labeled bar are the offenders.

The signal still needs to be **prominent** — users must clearly see they're looking at downstream-affected (or whole-model-changed) data — but it should read as **informational**, not cautionary.

## Vocabulary parallelism

The CLL color system already has a per-column visual language:

- **Yellow `!` glyph + tinted row** = column is impacted
- **Amber `~` glyph + tinted row** = column was changed
- **Green `+` glyph + tinted row** = column was added

The redesign maintains parallelism with this language: the model-level signal uses the same `!` / `~` glyph, the same color, and the same chip-shape building block as the per-column rows — just sized for a model rather than a column.

## Design

### Visual treatment

The model name in the NodeView title row is wrapped in a chip that mirrors the per-column row chip:

- **Background:** the existing `washBg` token (`--schema-color-impacted` for downstream, `--schema-color-changed` for source).
- **Border:** 1px in the `washAccent` token color.
- **Foreground (text + glyph):** the existing `fg` token from `wholeModelTreatmentTokens` (light- and dark-mode aware).
- **Disc:** ~18px filled circle in the `washAccent` color, white `!` or `~` glyph centered, sized at the title's font weight.
- **Shape:** ~6px corner radius (chip, not pill).

Long model names truncate with ellipsis inside the chip; the full name appears in a tooltip on hover.

The 6px left-edge stripe on the panel (`boxShadow: inset 6px 0 0 ...`) is retained.

### What is removed

1. The full-panel `backgroundColor` wash (`treatment.washBg` on the outer `Box`).
2. The labeled header bar above the tabs (the `<Box data-testid="whole-model-impact-header" / "whole-model-source-header">` block, including its top + bottom 1px borders and the `wholeModelHeaderText` string).
3. The redundant in-header `[ALL]` chip in the title row (the chip on **graph nodes** is unchanged).

### What is preserved

- **Per-column rows** in the schema view: existing stripe + tint + glyph treatment is unchanged. In the whole-model case, every row in the column list is tinted by the existing per-row logic — that "wall of tinted rows" is intentional and reinforces the title chip.
- **Graph-node surfaces:** brown/amber/green washes on lineage nodes, the `[ALL]` lineage badge, the green `[ADD]` additive badge — all unchanged.
- **Left edge stripe** on the NodeView panel.
- **Token helper shape:** `wholeModelTreatmentTokens` keeps its existing fields. The new title chip reads `washBg`, `washAccent`, and `fg`. No new tokens are introduced.
- **Treatment-kind precedence:** `wholeModelTreatmentKind` (source > downstream > additive) is unchanged.

## Implementation surfaces

Single primary file:

**`js/packages/ui/src/components/lineage/NodeView.tsx`**

- Remove `backgroundColor: treatment.washBg` from the outer `Box` (keep the `boxShadow` left stripe).
- Remove the `wholeModelHeaderText` variable and the `<Box>` block that renders the header bar above the tabs.
- Remove the in-header `[ALL]` chip from the title row.
- Add a title-chip component (inline or extracted) that wraps the model name when `treatment` is non-null. It reads from `treatment.washBg` (background), `treatment.washAccent` (border + disc fill), and `treatment.fg` (text), and renders the appropriate glyph (`!` for downstream, `~` for source).
- New `data-testid`s: `whole-model-impact-title-chip` and `whole-model-source-title-chip`.

**`js/packages/ui/src/components/lineage/wholeModelTreatment.ts`**

- No structural change.
- Update the file-header docstring so it documents the title-chip as the primary panel surface (today's docstring describes the wash + bar).

## Tests and stories

**Component tests (Vitest + React Testing Library):**

- Title chip renders with the correct `data-testid` for both kinds.
- The previously rendered surfaces are gone: no `whole-model-impact-wash` background, no `whole-model-impact-header` / `whole-model-source-header` element, no `[ALL]` chip in the title row.
- Title-chip color tokens match `wholeModelTreatmentTokens(kind)` for both light and dark modes.

**Storybook:**

- `js/packages/storybook/stories/lineage/WholeModelImpact.stories.tsx` — update the impact and source stories to render the new title chip. Add a long-model-name variant that demonstrates ellipsis + tooltip.

## Out of scope

- **DRC-3463** — clean up the top of the NodeView sidebar (too many buttons). The "long visual distance from chip to columns" concern is a sidebar-density problem, not a treatment problem, and is filed separately.
- Any change to the per-row column treatment (stripe + tint + glyph).
- Any change to graph-node `[ALL]` / `[ADD]` badges or node washes.
- Any change to the amber / yellow / green color tokens themselves.

## Decision log

- **Why title-chip and not "icon-led row above tabs"?** Both options were tried in the brainstorming mockups. The icon-led row (Option B) carried more information (a "all 6 columns affected" count) but introduced a new visual element in a panel slot we're trying to keep clean. The title-chip (Option C) maximizes parallelism with the per-column language: a row is `! customer_id`, a model is `! orders`. The user prefers the parallel-language reading.
- **Why keep the left stripe?** User confirmed the stripe doesn't read as a warning; it gives the panel a subtle "this belongs to the impacted/changed family" identity that survives the title scrolling out of view.
- **Why drop the in-header `[ALL]` chip but keep the lineage-graph `[ALL]` badge?** The title chip already says "whole-model" in the panel context, so the in-header chip is redundant. The lineage-graph badge serves a different surface (scanning the graph) where the title chip isn't visible.
