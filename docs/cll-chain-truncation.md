# CLL chain truncation and expansion

Status: accepted for [DRC-3218](https://linear.app/recce/issue/DRC-3218/cll-column-click-signal-and-resolve-truncation-when-the-impact-chain), 2026-08-26.

## Decision

Show a compact, non-interactive count at each visible column-lineage boundary, and do not add an expansion affordance for now.

The upstream badge reads `← N`; the downstream badge reads `N →`. Its accessible label states the direction, exact number of ancestry columns hidden by the current graph view, and why they are absent. A full visible chain has no badge.

## Options considered

### Button on the annotation

This is the most discoverable expansion option, but it adds a repeated control to already dense column rows. It also turns a diagnostic annotation into a graph-mutating action: one click could introduce many models, rerun layout, and destroy the scoped view the reviewer deliberately selected.

### Context-menu entry

This avoids permanent visual clutter, but makes a consequential expansion hard to discover and easy to invoke without a preview of its size. It would also add another selection/layout transition to the CLL context-menu state machine.

### None for now

This is the selected option. The indicator fixes the correctness problem—partial lineage is no longer presented as complete—without automatically widening the graph or adding another canvas mode. Reviewers can deliberately widen the existing lineage filter or switch to the full view when the count matters.

## DRC-3273 alignment

[DRC-3273](https://linear.app/recce/issue/DRC-3273/keep-cll-from-being-overwhleming) calls out CLL overwhelm as an unresolved product concern. Automatic expansion is therefore rejected. The annotation-button option is also deferred because it encourages incremental expansion without a size preview or collapse story. The compact count provides information without increasing graph density beyond the two boundary rows that already render.

No follow-up implementation issue is filed because the decision is to build no expansion affordance. Revisit only when product research or telemetry establishes all three of the following:

1. Reviewers frequently need to widen a truncated chain.
2. The expansion can preview the number of models and columns before changing layout.
3. The interaction has a clear collapse or restore-view path consistent with DRC-3273.

At that point, file a scoped implementation issue related to both DRC-3218 and DRC-3273 rather than extending this correctness fix.
