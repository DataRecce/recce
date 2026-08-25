# Recce color semantics

## Axes

- Comparison: `base` and `current`; owns orange/blue.
- Structural: `added`, `removed`, `modified`, `unchanged`; owns symbols and labels. A secondary accent is transitional. It fills the lineage node status block and the MiniMap node; on every other surface it stays on a border or a symbol.
- Direction: `increase`, `decrease`, `equal`; owns arrows and signed text and is neutral.
- Categorical overlap: purple crosshatch; it is not a structural status.
- Execution, CLL transformation, CLL impact, and interaction states are separate namespaces.

## Namespace ownership and alias rules

| Namespace | Owner | Allowed alias |
| --- | --- | --- |
| `comparison` | `theme/semanticColors.ts` | None with structure or direction |
| `structural` | `theme/semanticColors.ts` + `StructuralChangeIndicator` | Secondary status accent during Phase B only |
| `direction` | `theme/semanticColors.ts` | Neutral UI foreground only |
| `categorical.overlap` | `theme/semanticColors.ts`; consumed by DRC-2852 | None with modified/impact |
| execution status | MUI status palette and run-status components | May reuse generic success/error/info only outside diff identity |
| CLL transformation | lineage column transformation tokens | No comparison aliases |
| CLL impact | lineage impact CSS/tokens | No structural modified alias |
| interaction | MUI interaction state | No comparison aliases on adjacent diff data |

Canvas consumers call `getSemanticColorTheme()`. Migrated structural/comparison UI is styled from TypeScript/MUI rather than duplicated CSS values; remaining CLL CSS belongs to the separate CLL namespaces above.

Dark comparison chart fills deliberately use lower opacity than their light-theme counterparts. The semantic comparison border must retain at least 3:1 contrast against the fill after the fill is alpha-composited over the semantic neutral chart background; tests perform that compositing rather than comparing the raw eight-digit hex values.

## Transition

Phase B permits `structural.secondaryAccent` on a border, a structural symbol, and the lineage node status block and MiniMap node fill. Path A removes that use after every audited surface has a redundant non-color cue.

## Compatibility

Physical-color component props are deprecated on introduction of role-first props and removed only in a future major package release.

Structural edges use pairwise-distinct dash patterns in addition to accessible status names: Added is long-dashed, Removed is short-dashed, Modified alternates long and short dashes, and Unchanged is solid.

## Phase B visual gate

The compound semantics matrix is reviewed at a deterministic 1440 px width in Light, Dark, and Grayscale. It combines lineage nodes; production query/profile grids and row-count direction renderers; histogram and Top-K charts; and a legend split into Comparison, Structure, and Direction. The histogram retains explicit Base/Current values for every bin, while Top-K labels Current as the upper bar and Base as the lower bar, so grayscale never leaves series identity to hue alone.

On 2026-08-06, the Light and Dark stories were inspected with Chromium's DevTools vision-deficiency emulation for both Protanopia and Deuteranopia. Every structural row and node retained its `+`/`−`/`Δ` symbol and Added/Removed/Modified label. Increase and decrease retained arrows and signed percentages, while equal retained an equality cue and No Change text. Base and Current retained explicit labels and bordered treatments in value cells and chart legends. No compound meaning depended on the emulated color alone.

The review was repeated after the production direction, chart-fill, lineage-status, inline-legend, and edge-pattern migration. Each Light/Dark CVD combination retained 16 structural cues, eight role-tagged comparison treatments, and six production direction cues in the matrix; manual inspection also confirmed the chart value and position keys remained legible.

The committed Phase B snapshots use Playwright's repository-default platform suffix and are canonical for Darwin arm64, Node 26.5.0, and Playwright 1.62.1's bundled Chromium. The repository's Ubuntu JavaScript workflow runs lint and unit/build gates but does not invoke `test:visual`, and the other existing visual suites do not commit cross-platform baselines. Do not relabel Darwin pixels as Linux baselines. If visual regression moves into Ubuntu CI, generate and review native Linux snapshots in that workflow before making them canonical.
