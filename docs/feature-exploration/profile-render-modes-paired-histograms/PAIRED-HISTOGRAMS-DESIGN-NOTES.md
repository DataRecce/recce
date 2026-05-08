# Paired Histograms exploration — design notes

Storybook-only exploration on branch `prototype/bubbleup-histograms` (branch name kept; design started under the BubbleUp working title before being renamed to "Paired Histograms" — the Honeycomb trademark wasn't a fit). NO backend work, NO live wiring.

## Direction

**Two render targets, one visual idea.**

- **Cell** (~140×36 px): inline distribution column on the schema-grid row, alongside the existing 5-square strip. Signals *something diverged here*; reads at a glance.
- **Baseball card** (~240×92 px): primary visual on each `SchemaGalleryView` card. Answers *what diverged*; readable, with value labels.

Both surfaces use the same overlap visual: orange (base) + blue (current), 65% alpha, current drawn on top of base. Where bar heights diverge, color separation reads.

## Component split

| Cardinality bucket | Component | Why new |
|---|---|---|
| Low-card string + low-card numeric | `PairedHistogramDiscreteCell` | `TopKBarChart` is a list (~46 px per row × N rows) — it does not shrink to a cell. The new component is a horizontal categorical paired-bar chart at cell density; ~140 LOC inline SVG. Slot padding for category separation, per-slot labels at card density. |
| High-card quantitative (e.g. order amount) | `PairedHistogramContinuousCell` | `HistogramChart` unconditionally renders title + legend (~50 px overhead). At cell density (h=36) there is no room left for the bars. The new component is a continuous paired-bar chart at cell density; ~110 LOC inline SVG. Bars touch (no slot padding) for visual continuity, endpoint min/max labels at card density. |

Both new components live at `js/packages/storybook/stories/paired-histograms/` and are **not** exported via `@datarecce/ui`. They share the same overlap-with-alpha visual, color tokens, and baseline-rule treatment, but render different label semantics for their data shape. Promotion path is `js/packages/ui/src/components/data/` next to `HistogramChart` and `TopKBarChart`.

`HistogramChart` and `TopKBarChart` keep their place — they are the right tools for **detail / popover surfaces** (full-size, with title, axes, legend, hover tooltips, percentage math). They are not cell-level components, and that's fine.

## Files

```
js/packages/storybook/stories/paired-histograms/
├─ PairedHistogramDiscreteCell.tsx          ← new component (categorical)
├─ PairedHistogramContinuousCell.tsx        ← new component (continuous)
├─ surfaceMocks.tsx                  ← GridRowMock + GalleryCardMock
├─ fixtures.ts                       ← DiscreteDistribution + PairedHistogram
├─ PairedHistogramLowCardString.stories.tsx ← cell + card + comparison
├─ PairedHistogramLowCardNumeric.stories.tsx
├─ PairedHistogramHighCardQuant.stories.tsx
└─ PairedHistogramSidebar.stories.tsx
```

11 stories total (5 + 3 + 3, including the side-by-side comparisons).

## Visual rules

- Color tokens lifted from `HistogramChart.tsx:55-58`: base `#F6AD55`, current `#63B3ED`, both rendered with `A5` alpha (~65%). Reused so the two charts speak the same visual language.
- **Slot width is equal** for every category. The earlier "proportional spacing" debate is moot — `PairedHistogramDiscreteCell` only does equal slots, and `HistogramChart`'s category x-axis enforces the same.
- **Bin edges are uniform** for the continuous variant. The earlier variable-width-bin idea was rejected: it implied per-column visual choices the renderer has no business making, and the chart's category x-axis renders edges at equal widths anyway, so the variable widths weren't even visible.
- **Trim heuristic** for low-card: `trimToTopN(d, n)` keeps the top-N values by `max(baseProp, currProp)`, preserving original display order. Surfaces both "value spiked" and "value collapsed" without distorting the natural frequency-desc layout. Outliers that fall outside the top-N belong in a separate "shifted values" panel (out of scope here).

## Surface mocks

`surfaceMocks.tsx` exposes two minimal layout components used by every story:

- `GridRowMock` — single schema-grid row: column name, type chip, 5-square strip, distribution slot. ~560 px wide, ~40 px tall.
- `GalleryCardMock` — `SchemaGalleryView`-style card: column name + badge, type, chart, four-quadrant stats, base/current legend. ~280×~210 px.

These mocks are NOT the real schema-view code; they're sized and styled to approximate the real surfaces so density choices land in context. Promotion to the real components would replace the mocks with imports.

## Backend deltas needed in `ColumnProfileStats`

Today `js/packages/ui/src/hooks/useInlineProfile.ts:7` defines:

```ts
interface ColumnProfileStats {
  not_null_proportion?: number | null;
  min?: string | number | null;
  max?: string | number | null;
  avg?: number | null;
  is_unique?: boolean | null;
  row_count?: number | null;
}
```

To feed Paired Histograms, add ONE optional polymorphic field:

```ts
interface ColumnProfileStats {
  // ...existing fields...
  distribution?:
    | {
        kind: "topk";
        // Two paired arrays in matching display order; sorted by base freq desc.
        values: (string | null)[];
        base_counts: number[];
        current_counts: number[];
        base_total: number;
        current_total: number;
      }
    | {
        kind: "histogram";
        // Uniform bin edges (length N+1), counts per environment (length N).
        bin_edges: number[];
        base_counts: number[];
        current_counts: number[];
        base_total: number;
        current_total: number;
      }
    | null;
}
```

Backend bucketing (which `kind` a column gets) lives server-side based on column type + cardinality probe.

Backend work this would require (NOT in scope):
- New `profile_diff` SQL path returning paired top-N for low-card columns and uniform-edge bin counts for continuous, keyed by base + current.
- Cardinality probe (`COUNT(DISTINCT)`) to decide topk vs histogram. Cap at ~120 distinct before falling back to "no distribution available."
- **Uniform bin edges only.** Width and count are renderer-irrelevant beyond legibility — `(max - min) / 20` rounded to a clean step is fine.

## Open questions

1. **Trim cap for the cell.** I used `n=12` for the trimmed story — that gives ~11 px per slot at 140 px wide. Could go to 10 (12 px slots, more breathing room) or 15 (slots get cramped at ~9 px). Lower-bound choice; would like confirmation against real data.
2. **What happens on cell hover?** The cell signals divergence; the natural follow-up is "show me the baseball card" or "show me the full HistogramChart/TopKBarChart in a popover." Hover-popover surface not designed yet — easiest call is to reuse the existing strip's Tooltip pattern (`schemaCells.tsx:188`) and embed the baseball-card layout inside.
3. **Continuous data with heavy tails.** 21 uniform bins works for `order_total_usd` (synthetic log-normal around ~$500). For genuinely heavy-tailed data (latency, file sizes), uniform bins put almost all mass in bin 0. Two options: (a) backend ships log-spaced edges (still uniform on the log scale, still equal slot widths), (b) backend caps the visible range at p99 and indicates clipping. (a) is the cleaner answer; flagging for backend work.
4. **Color-blind safety.** Orange + blue is the existing app convention but not the most distinguishable pairing for protanopia. A future pass could add a pattern (hatching) on the base bars; deferred unless the captain wants to cover this now.
5. **Animation between base/current toggle states.** Static cells in the grid; not relevant for the cell version. For the baseball card, a 200ms cross-fade between "current only" and "paired" might be nice — not in scope.

## What was rejected

Documented for the record so we don't reinvent these:

- **Variable-width bins** (per-column lo/hi shipping from backend). HistogramChart renders categorically; the widths weren't visible, and shipping per-column visual choices from the backend is the wrong layering.
- **Bending `HistogramChart` to fit cell density.** Tried first; doesn't work — the title row + legend together eat ~50 px of overhead, leaving zero (or negative) chart area at h=36. Modifying `HistogramChart` to suppress them under a flag was the alternative, but it adds a "compact" branch to a component that doesn't otherwise need one. A separate `PairedHistogramContinuousCell` is cheaper, keeps `HistogramChart` simple, and gives us full control over the cell-density visual without a coupled prop matrix.
- **`TopKBarChart` shrunk to cell density.** TopKBarChart is a list view, ~46 px per row. Shrinking it would compress to unreadable. Different layout, different component.
- **Proportional numeric spacing** (HTTP 200/204/304/404/500/502 spaced by numeric distance). Categorical labels get categorical slots. The captain's earlier "equal-width" rule is now enforced by the component, not a per-story flag.
- **Side-by-side bars at cell density.** Overlap with alpha is more legible; side-by-side at cell width crushes individual bars into noise.

## Captures

The earlier iteration left 7 PNGs in this directory of the rejected custom SVG component. Kept as a record of what was tried. Fresh captures against the current stories would produce:

- `LowCardString.CellSmall` / `CellTrimmed` — cell density, 12 / top-12 of 92
- `LowCardString.BaseballCardSmall` / `BaseballCardTrimmed` — card density
- `LowCardString.SizeComparison` — cell vs card on same data
- `LowCardNumeric.CellHttpStatus` / `BaseballCardHttpStatus` / `SizeComparison`
- `HighCardQuant.CellOrderAmount` / `BaseballCardOrderAmount` / `SizeComparison`

Capture pass deferred until the env unblocks Vite (the previous capture cycle hit `EPERM stat-ing @babel/core`; same env limitation persists).
