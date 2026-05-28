import { PairedHistogramDiscrete } from "@datarecce/ui/primitives";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  discreteCountryCode,
  discreteHttpStatus,
  discreteMixedTypes,
  discreteRankDramatic,
  discreteRankShuffled,
  discreteRankStable,
  discreteRankTrimmedAirports,
  discreteRankWithNewEntrants,
  discreteSignupSource,
  discreteTrimmedAirports,
  discreteWithGaps,
  toDiscreteProps,
  toDiscreteRanksProps,
} from "./fixtures";
import { SchemaContainerMock, SchemaRowMock } from "./SchemaRowMock";

/**
 * Top-K paired histogram for categorical columns with **gap-on-absent**
 * semantics: when a value's count is 0 on one side, that bar simply
 * doesn't render, leaving a visible empty half-slot. The renderer's job
 * is to make "category present here / absent there" instantly readable
 * in 28 px of vertical space.
 *
 * GA replacement for the prototype `PairedHistogramDiscreteCell`,
 * rewritten for the PR 2 top-K payload (`values`, `base_counts`,
 * `current_counts`, `trimmed`).
 *
 * Theme follows the storybook toolbar (light / dark) via `useIsDark()`.
 */
const meta: Meta<typeof PairedHistogramDiscrete> = {
  title: "Visualizations/Profile Distribution/Discrete",
  component: PairedHistogramDiscrete,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `Paired bars per category value. Base (orange) on the
left, current (blue) on the right. **Gap-on-absent**: when a value's
count is 0 on one side, the bar isn't drawn — the visible empty space
reads as "this category isn't present on that side." When the backend
had to drop a long tail past K, a tiny "trimmed" marker appears in the
upper-right corner.`,
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof PairedHistogramDiscrete>;

// ---------------------------------------------------------------------
// Cell density
// ---------------------------------------------------------------------

export const CellHttpStatus: Story = {
  name: "Cell — HTTP status codes",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="response_status"
        status="changed"
        distribution={
          <PairedHistogramDiscrete data={toDiscreteProps(discreteHttpStatus)} />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellSignupSource: Story = {
  name: "Cell — signup source (dramatic shift)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="signup_source"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteProps(discreteSignupSource)}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellCountryCode: Story = {
  name: "Cell — country code (stable)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="billing_country"
        status="ok"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteProps(discreteCountryCode)}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

export const CellWithGaps: Story = {
  name: "Cell — gap-on-absent",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="cohort"
        status="changed"
        distribution={
          <PairedHistogramDiscrete data={toDiscreteProps(discreteWithGaps)} />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Two legacy values are present only in base (gaps on the right halves of those slots); one cohort value is present only in current (gap on the left half). The pairing of empty + filled half-slots reads as 'category present on one side, absent on the other' without any text labels.",
      },
    },
  },
};

export const CellTrimmed: Story = {
  name: "Cell — trimmed top-K marker",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="origin_airport"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteProps(discreteTrimmedAirports)}
          />
        }
      />
    </SchemaContainerMock>
  ),
};

// ---------------------------------------------------------------------
// Edge / degenerate inputs
// ---------------------------------------------------------------------

export const EmptyPayload: Story = {
  name: "Empty payload (no values)",
  render: () => (
    <PairedHistogramDiscrete
      data={{
        values: [],
        baseCounts: [],
        currentCounts: [],
        baseTotal: 0,
        currentTotal: 0,
      }}
    />
  ),
};

export const ZeroTotals: Story = {
  name: "All zero counts",
  render: () => (
    <PairedHistogramDiscrete
      data={{
        values: ["a", "b", "c"],
        baseCounts: [0, 0, 0],
        currentCounts: [0, 0, 0],
        baseTotal: 0,
        currentTotal: 0,
      }}
    />
  ),
};

// ---------------------------------------------------------------------
// Rank staircase — rank-only rendering (DuckDB `approx_top_k` path)
// ---------------------------------------------------------------------
//
// When the engine returns top-K values without counts, Stage B emits a
// ranks-mode payload and the cell sizes bars by rank position only:
// `height = (k - rank + 1) / k * chartHeight`. Rank 1 is the tallest
// bar, rank k is the shortest. Slot order is fixed by the wire contract:
// base's top-K in base-rank order, then values present only in current's
// top-K appended on the right.

export const RankStable: Story = {
  name: "Rank — stable (no order change)",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="region_code"
        status="ok"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteRanksProps(discreteRankStable)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Matched staircases = ranks identical between base and current. The two side-by-side descending shapes are the rank-only equivalent of 'no drift.'",
      },
    },
  },
};

export const RankShuffled: Story = {
  name: "Rank — adjacent swaps",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="region_code"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteRanksProps(discreteRankShuffled)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Swapped ranks show as current bars zig-zagging against base's smooth descent. The eye locks onto the spike where adjacent positions traded places.",
      },
    },
  },
};

export const RankDramatic: Story = {
  name: "Rank — full inversion",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="region_code"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteRanksProps(discreteRankDramatic)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Dramatic order reversal — current bars are nearly the mirror of base. The whole top-K has flipped: what used to be #1 is now last.",
      },
    },
  },
};

export const RankWithNewEntrants: Story = {
  name: "Rank — new entrants and dropouts",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="region_code"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteRanksProps(discreteRankWithNewEntrants)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Leftmost slots are base's top-K (some now missing on current — note the gaps on the current side). The rightmost slots are values newly in current's top-K that weren't in base, sorted by current rank — those slots have no base bar.",
      },
    },
  },
};

export const RankTrimmed: Story = {
  name: "Rank — trimmed top-K",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="origin_airport"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            data={toDiscreteRanksProps(discreteRankTrimmedAirports)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "The trimmed marker behaves the same in rank mode — when the original distribution had more values than K, the corner chip signals that the cell shows only the top K.",
      },
    },
  },
};

// ---------------------------------------------------------------------
// Mixed-type values — `values: unknown[]` contract + `formatValue` seam
// ---------------------------------------------------------------------
//
// Stage B's `ProfileDistributionTopKPayload.values` is typed `unknown[]`:
// real-world top-K columns return strings, NULL, integers, booleans,
// big numbers, dates, etc. The cell exposes a `formatValue` prop so
// Stage C can dispatch on column type and pass a column-appropriate
// formatter. The cell itself stays type-blind.
//
// These two stories use the same heterogeneous fixture to show what
// happens with the default `String(v)` versus a column-aware override.

/**
 * Tiny number abbreviator for the "after" story. Stage C will provide
 * something more substantial; this is just enough to demonstrate that a
 * caller-supplied formatter reaches the label and tooltip.
 */
function abbreviateNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function mixedFormatter(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "number" && Math.abs(v) >= 1000) return abbreviateNumber(v);
  return String(v);
}

export const MixedTypesDefault: Story = {
  name: "Mixed types — default formatter",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="mixed_column"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            showLabels
            data={toDiscreteProps(discreteMixedTypes)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '**Before** view: no `formatValue` prop supplied, so the cell falls back to `String(v)`. The NULL bucket renders as the literal text `"null"`, the boolean renders as `"true"`, and the big integer `1500000` becomes a wide digit string that crowds the label. The cell still renders — it just looks ugly. This is what Stage C would ship if it forgot to pass a formatter.',
      },
    },
  },
};

export const MixedTypesCustomFormatter: Story = {
  name: "Mixed types — custom formatter",
  render: () => (
    <SchemaContainerMock>
      <SchemaRowMock
        columnName="mixed_column"
        status="changed"
        distribution={
          <PairedHistogramDiscrete
            showLabels
            formatValue={mixedFormatter}
            data={toDiscreteProps(discreteMixedTypes)}
          />
        }
      />
    </SchemaContainerMock>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "**After** view: a caller-supplied `formatValue` collapses NULL to `∅`, abbreviates `1500000` to `1.5M`, and lets strings/booleans pass through. Stage C will dispatch on `column.type` to pick the right formatter (NULL glyph, number abbreviation, date format, etc.); the cell itself stays type-blind — this single prop is the entire seam.",
      },
    },
  },
};
