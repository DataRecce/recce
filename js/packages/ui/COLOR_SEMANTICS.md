# Recce color semantics

## Axes

- Comparison: `base` and `current`; owns orange/blue.
- Structural: `added`, `removed`, `modified`, `unchanged`; owns symbols and labels. A secondary accent is transitional and never a fill.
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

## Transition

Phase B permits `structural.secondaryAccent` on a rail or structural symbol only. Path A removes that use after every audited surface has a redundant non-color cue.

## Compatibility

Physical-color component props are deprecated on introduction of role-first props and removed only in a future major package release.

## Phase B visual gate

The compound semantics matrix is reviewed at a deterministic 1440 px width in Light, Dark, and Grayscale. It combines lineage nodes; query and profile rows; histogram and Top-K charts; and a legend split into Comparison, Structure, and Direction.

On 2026-08-06, the Light and Dark stories were inspected with Chromium's DevTools vision-deficiency emulation for both Protanopia and Deuteranopia. Every structural row and node retained its `+`/`−`/`Δ` symbol and Added/Removed/Modified label. Increase and decrease retained arrows and signed percentages, while equal retained an equality cue and No Change text. Base and Current retained explicit labels and bordered treatments in value cells and chart legends. No compound meaning depended on the emulated color alone.
