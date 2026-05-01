# BubbleUp paired-histogram exploration — design notes

Storybook-only exploration on branch `prototype/bubbleup-histograms` (worktree `recce/.claude/worktrees/bubbleup-prototype/`). NO backend work, NO live wiring — synthetic data shaped like a future profile API would return.

Stories: `js/packages/storybook/stories/bubbleup/*.stories.tsx` — three files (one per cardinality bucket), 13 stories total.
Component: `js/packages/storybook/stories/bubbleup/BubbleUpHistogram.tsx` — local to storybook package, NOT exported via `@datarecce/ui`. If captain greenlights, it would be promoted into `js/packages/ui/src/components/data/`.

## Chart library chosen

**Custom inline SVG**, ~250 lines, no chart library.

**Why:**
- The cell render target is ~220×64 px. Chart.js/react-chartjs-2 (already in `@datarecce/ui` for the full-size HistogramChart) carries ~70 KB minified runtime per chart instance, with axis/legend/tooltip machinery that gets in the way at this density. Hand-rolled SVG is ~1 KB and renders in one paint with no `useMemo` dance for chart data.
- A profile cell may host many of these charts on one page (one per column × one per model in a schema diff). Chart.js scales to 1–10 charts cleanly; 100+ thrashes Canvas.
- The captain's rules (equal-width vs proportional spacing, overlap vs side-by-side, trim+outliers) need direct geometric control. Each is ~15 lines of SVG, vs fighting Chart.js plugins to disable proportional scales.
- `@datarecce/ui` already vendors `chart.js` and `react-chartjs-2`, so promoting later to Chart.js is a 1-day swap if a benefit emerges (built-in tooltips, axis polish). The data shapes in this exploration are library-agnostic.

**Trade-offs accepted:**
- No tooltips on hover yet — would add ~30 lines via `<title>` or a portal popover.
- No animation between base/current toggle states — not relevant for static cells; would add complexity for the high-card variant.
- Accessibility: SVG has `role="img"` + `aria-label`, but bars are not individually focusable. Acceptable for a data-density display; if captain wants per-bar a11y, swap to a `<table>` shadow-DOM layer.

## Data shapes assumed

Two shapes — discrete and continuous — defined in `BubbleUpHistogram.tsx` and seeded in `fixtures.ts`.

### Discrete (low-card string + low-card numeric)

```ts
interface DiscreteBucket {
  value: string;            // string for both variants — numeric callers stringify
  base_count: number;
  current_count: number;
}

interface DiscreteBubbleUpData {
  buckets: DiscreteBucket[];  // caller-ordered: see ordering policy below
  base_total: number;
  current_total: number;
}
```

**Ordering is the caller's job, not the component's**:
- low-card string → caller sorts by descending `base_count`
- low-card numeric → caller sorts by parsed numeric value of `bucket.value`

Component does not re-sort. This keeps the shape uniform across both variants and pushes "what does ordering mean?" out of the component.

### Continuous (high-card quantitative)

```ts
interface ContinuousBin {
  lo: number;
  hi: number;
  base_count: number;
  current_count: number;
}

interface ContinuousBubbleUpData {
  bins: ContinuousBin[];
  base_total: number;
  current_total: number;
}
```

Bins carry their own `lo`/`hi` so width is data-driven, not equal. Callers can hand the component arbitrary bin schemes (uniform, log, quantile) and it just works.

### Backend deltas needed in `ColumnProfileStats`

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

To feed BubbleUp, the type would grow ONE optional field, polymorphic by column type:

```ts
interface ColumnProfileStats {
  // ...existing fields...
  distribution?:
    | { kind: "discrete"; buckets: DiscreteBucket[]; base_total: number; current_total: number }
    | { kind: "continuous"; bins: ContinuousBin[]; base_total: number; current_total: number }
    | null;
}
```

Backend bucketing decision (string vs numeric vs continuous) lives server-side based on column type + cardinality probe — frontend just renders what it gets and applies the trim/axis rules. The `STAT_FIELDS` array at `useInlineProfile.ts:35` would gain `"distribution"` and `dataFrameToStatsMap` would parse the JSON-encoded value.

Backend work this would require (NOT in scope of this exploration):
- A new `profile_diff` SQL path that returns top-N values + counts for low-card columns and bin-edge counts for continuous, keyed by base+current.
- Cardinality probe (`COUNT(DISTINCT)`) to decide which shape to compute; cap at ~120 distinct before falling back to "no distribution available."

## Cardinality bucketing thresholds

Captain's brief specified 40 (drop X axis) and ~75 (start trimming). I confirmed both visually:

- **40**: at 12 buckets the labels read fine with auto-stride; at 40+ the labels collide even with stride. Confirmed.
- **75**: at 92 buckets without trim (see `bubbleup-low-card-string-side-by-side.png` right panel) bars compress to ~2.4 px each — outliers at index 47 (6× spike) and 85 (12× spike) are barely visible. With trim (top-30 baseline + 10 outliers by proportion-delta), the same outliers are unmistakable. Confirmed.

**One nuance worth confirming with captain:** the trim heuristic keeps **top 30 baseline + 10 outliers by `|currProp - baseProp|`** (40 total). This surfaces both "new value spiked" and "old value collapsed." Alternative is a single combined ranking. Current heuristic favors the user's mental model of "the chart should still look like the baseline distribution" — outliers feel like additions, not displacements.

## Baseline + current overlay style

- Baseline: orange `#F6AD55` (matches existing `HistogramChart.tsx:55` constant `BASE_BAR_COLOR`)
- Current: blue `#63B3ED` (matches existing `CURRENT_BAR_COLOR`)
- Both rendered at ~70% alpha

**Discrete: grouped (side-by-side per bucket).** Each bucket is two narrow bars sitting next to each other, ~40% width each. Reads cleanly because bucket count is bounded (≤40 with axis, ≤40 trimmed without).

**Continuous: overlapped.** Both bars share the bin's full x-extent. Current is drawn on top with a thin border so its outline is visible even when both colors mostly overlap.

The contrast is deliberate:
- Discrete: divergence is per-bucket and you want to compare two specific values — grouped wins.
- Continuous: divergence is per-region and you want to see the *shape* of the shift — overlap wins. Side-by-side at this density (see `bubbleup-high-card-quant-side-by-side.png`) reads as visual noise.

**Diff communication today:** color alone (orange vs blue). No explicit delta callout. If captain wants more, candidates:
- A small `Δ` badge with the largest-divergence bucket's name
- A faint red/green overlay on bars where the diff exceeds a threshold
- A "summary line" under the chart: `+12% volume, distribution shift to higher values`

I'd lean toward keeping the cell quiet (just paired bars) and surfacing details on hover/click — the cell is decoration in a schema view; the comparison happens in a separate diff panel.

## Captures

In this directory:

| File | Story | Demonstrates |
|---|---|---|
| `bubbleup-low-card-string-small.png` | `LowCardString.SmallWithXAxis` | 12 countries, X-axis labels, stride works |
| `bubbleup-low-card-string-trimmed.png` | `LowCardString.LargeTrimmedNoAxis` | 92 → 40, no axis, "trimmed" indicator |
| `bubbleup-low-card-string-side-by-side.png` | `LowCardString.SideBySide` | Trimmed vs all-92 — justifies trim |
| `bubbleup-low-card-numeric.png` | `LowCardNumeric.HttpStatusEqualWidth` | HTTP codes equal-width, 404 spike visible |
| `bubbleup-low-card-numeric-side-by-side.png` | `LowCardNumeric.SideBySide` | Equal-width vs proportional — justifies equal-width |
| `bubbleup-high-card-quant.png` | `HighCardQuantitative.OverlappedDefault` | Order amounts, overlap, slight rightward drift visible |
| `bubbleup-high-card-quant-side-by-side.png` | `HighCardQuantitative.OverlappedVsSideBySide` | Overlap vs side-by-side — justifies overlap |

Captures use 2× device-scale, viewport 800×240 for legibility in this doc and on retina displays. Stories themselves render at the natural cell size (240×~90 incl. cell frame).

## Open questions for the captain

1. **Trim heuristic — top-30 baseline + 10 outliers?** That's 40 visible buckets, equal to the X-axis-drop threshold. Could go higher (60+10 = 70) without crossing the next legibility wall. Lower-bound choice; would like confirmation.
2. **Numeric outlier definition.** Today: absolute proportion delta. Could be relative (`|cur/base - 1|`) — surfaces small-base-large-current cases more aggressively. Real production data will pick the winner; for now the absolute version is conservative.
3. **Cell width.** I picked 220×64 px (component-internal default) and the surrounding ProfileCellFrame at 240 px wide. The captain may want the chart to fill the parent grid cell — easy to make `width`/`height` `100%`-relative if so.
4. **What happens to columns that don't fit any bucket?** A `BIGINT` column with 200 distinct values is neither low-card (>75) nor naturally continuous (no obvious binning). Today the backend would fall through to "no chart, just min/max/null%." Worth confirming that's acceptable, or whether to compute a continuous-style histogram for any numeric with cardinality > 75.
5. **Promotion path.** If captain greenlights the design, do we (a) port to `@datarecce/ui` as a new component, or (b) extend the existing `HistogramChart` with a `compact` mode? My instinct is (a) — they serve different surfaces (full-page vs cell) and conflating them complicates the public API.

## Coordination notes

- This worktree was forked from `worktree-profile-baseball` (head `e1f0d4bc`) — the cycle-2 grid/strip layout from ensign A is in the local copy as starting context, but I made zero changes to it. All my work is under `js/packages/storybook/stories/bubbleup/` and this docs directory.
- Storybook ran on port 6010 (ensign A holds 6006). Recce server stays at :8765 (ensign A's instance) for live profile context — captain can flip between the two to compare static cells (in storybook) with live data (in recce).
- pnpm install was needed in the fresh worktree (1m48s); node_modules did not propagate from the parent worktree.
