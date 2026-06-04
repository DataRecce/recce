/**
 * Synthetic payload fixtures for the Paired Histograms GA cells (DRC-3390 Stage A).
 *
 * These match the **frozen** payload schemas Stage B produces:
 *   - Continuous → `{kind:"histogram", base_bin_edges:[12],
 *     current_bin_edges:[12], base_density:[11], current_density:[11],
 *     base_total, current_total}` (per-env quantile bins, constant-area).
 *   - Discrete   → `{kind:"topk", values, base_counts, current_counts,
 *     base_total, current_total, trimmed}` (top-K with gap-on-absent).
 *   - Null       → `{kind:null}` (per-column failure).
 *   - Unsupported envelope → `{status:"unsupported", reason:...}`.
 *
 * Stage A is Storybook-only — no API/backend dependency. The payload
 * types are inlined here as a frozen contract. Stage B introduces the
 * canonical `ProfileDistribution*Payload` exports from `@datarecce/ui/api`;
 * when Stage C wires up `useInlineProfileDistribution`, these fixtures
 * can be replaced with real responses without touching the cells.
 */

// ----------------------------------------------------------------------
// Payload-shape types (Storybook-only)
// ----------------------------------------------------------------------
//
// Continuous histogram fixtures use the CANONICAL
// `ProfileDistributionHistogramPayload` from `@datarecce/ui/api` — that's the
// shape the production cell consumes, so it must not drift.
//
// The top-K (counts) and result types below are deliberately Storybook-LOCAL
// and DIVERGE from the canonical `run.ts` contract: the fixtures bundle
// envelope-level `base_total`/`current_total` onto the counts payload for
// Stage-A display convenience, whereas the wire contract puts those on the
// `ProfileDistributionOkResult` envelope and types counts as `(number|null)[]`.
// Do NOT copy these shapes into production — use the `@datarecce/ui/api` types.
// (Fully canonicalizing the counts fixtures means moving totals to the envelope
// across the Stage-A discrete stories; deferred — storybook-only, no prod impact.)

import type { ProfileDistributionHistogramPayload } from "@datarecce/ui/api";

interface ProfileDistributionTopKPayload {
  kind: "topk";
  /** Heterogeneous by contract — Stage B may return strings, numbers,
   * booleans, dates, NULL, etc. Cells format each entry through
   * `formatValue` to produce a display string. */
  values: unknown[];
  base_counts: number[];
  current_counts: number[];
  base_total: number;
  current_total: number;
  trimmed: boolean;
}

/**
 * Rank-only variant — emitted when the underlying engine (e.g. DuckDB
 * `approx_top_k`) returns the top-K values but no counts. Stage B
 * guarantees both sides switch to rank-only together: a cell never has
 * to render counts on one side and ranks on the other.
 *
 * Values appearing in only one side's top-K carry `null` for the other
 * side's rank. Stage B's slot ordering is base-first (base's top-K in
 * base-rank order), then values present only in current's top-K
 * appended on the right (sorted by current rank ascending).
 */
interface ProfileDistributionTopKRanksPayload {
  kind: "topk";
  mode: "ranks";
  values: string[];
  base_ranks: (number | null)[];
  current_ranks: (number | null)[];
  k: number;
  trimmed: boolean;
}

interface ProfileDistributionNullPayload {
  kind: null;
  reason?: string;
}

type ProfileDistributionColumnPayload =
  | ProfileDistributionHistogramPayload
  | ProfileDistributionTopKPayload
  | ProfileDistributionNullPayload;

type ProfileDistributionResult =
  | { status: "ok"; columns: Record<string, ProfileDistributionColumnPayload> }
  | { status: "unsupported"; reason: string };

// ----------------------------------------------------------------------
// Continuous (histogram) — quantile-binned, constant-area
// ----------------------------------------------------------------------

/**
 * Build a histogram payload from per-bin row proportions instead of
 * raw densities, with **independent base / current edges** (the post-#1398
 * contract). The constant-area contract is `density × span = proportion`,
 * so feeding proportions in (each side summing to ~1.0) lets the tooltip
 * percentages read sensibly. Stage B's real payloads always arrive
 * density-normalized on per-env quantile edges; this helper keeps the
 * fixtures honest.
 */
function continuousFromProportions(
  baseEdges: number[],
  baseProps: number[],
  currentEdges: number[],
  currentProps: number[],
  baseTotal: number,
  currentTotal: number,
): ProfileDistributionHistogramPayload {
  const toDensity = (edges: number[], props: number[]) =>
    props.map((p, i) => {
      const span = edges[i + 1] - edges[i];
      return span > 0 ? p / span : 0;
    });
  return {
    kind: "histogram",
    base_bin_edges: baseEdges,
    current_bin_edges: currentEdges,
    base_density: toDensity(baseEdges, baseProps),
    current_density: toDensity(currentEdges, currentProps),
    base_total: baseTotal,
    current_total: currentTotal,
  };
}

/**
 * 11 quantile bins concentrated in the middle (typical of a long-tailed
 * order-amount distribution).
 *
 * Base and current span $0 → $1000 but break at **different** quantile
 * edges (current's mass shifted slightly right post-deploy), so the merged
 * x-grid has more than 11 segments. Per-bin proportions sum to 1.0 on each
 * side, so each side's tooltip percentages add up to 100%.
 */
export const continuousOrderAmount = continuousFromProportions(
  [0, 10, 25, 50, 80, 120, 165, 220, 290, 400, 600, 1000],
  [0.01, 0.04, 0.08, 0.12, 0.16, 0.2, 0.14, 0.1, 0.08, 0.05, 0.02],
  [0, 8, 22, 48, 95, 140, 185, 245, 320, 430, 640, 1000],
  [0.008, 0.03, 0.07, 0.11, 0.17, 0.22, 0.15, 0.1, 0.07, 0.05, 0.02],
  12_000,
  14_500,
);

/**
 * Symmetric, low-divergence column (timestamps from a stable signup
 * source). Base ≈ Current — edges nearly coincide and densities barely
 * move — so the chart reads as mostly checkerboard with very thin
 * differential strips.
 */
export const continuousStable = continuousFromProportions(
  [
    1704067200, 1704672000, 1705276800, 1705881600, 1706486400, 1707091200,
    1707696000, 1708300800, 1708905600, 1709510400, 1710115200, 1710720000,
  ],
  [0.02, 0.03, 0.06, 0.1, 0.15, 0.28, 0.15, 0.1, 0.06, 0.03, 0.02],
  [
    1704067200, 1704680000, 1705280000, 1705885000, 1706490000, 1707095000,
    1707700000, 1708305000, 1708910000, 1709515000, 1710118000, 1710720000,
  ],
  [0.025, 0.035, 0.06, 0.1, 0.14, 0.27, 0.15, 0.1, 0.06, 0.04, 0.02],
  25_000,
  24_500,
);

/**
 * Added column — exists in current only, no base. The backend emits EMPTY base
 * edges/density for the absent side (not zero-density padded edges), so the
 * cell renders the current side one-sided (gap-on-absent), the same way the
 * discrete cell handles a value present in only one env.
 */
const addedCurrentEdges = [
  0, 50, 100, 150, 200, 300, 400, 500, 700, 900, 1200, 1500,
];
export const continuousAddedOnly = continuousFromProportions(
  [],
  [],
  addedCurrentEdges,
  [0.02, 0.08, 0.2, 0.3, 0.18, 0.1, 0.06, 0.03, 0.02, 0.008, 0.002],
  0,
  18_000,
);

/**
 * TIME column — edges are **seconds since midnight** (0–86399), the shape the
 * backend's `epoch()` cast emits for `TIME` (distinct from the Unix-epoch
 * seconds a TIMESTAMP/DATE emits). An activity bump around midday. Used to
 * exercise the `HH:MM:SS` clock-time tooltip path (vs the calendar-date path
 * a TIMESTAMP takes) — see DRC-3390 review note 1.
 */
const HOUR = 3600;
const timeOfDayEdges = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22].map(
  (h) => h * HOUR,
);
export const continuousEventTime = continuousFromProportions(
  timeOfDayEdges,
  [0.01, 0.02, 0.04, 0.08, 0.13, 0.19, 0.18, 0.13, 0.1, 0.07, 0.05],
  timeOfDayEdges,
  [0.02, 0.03, 0.05, 0.09, 0.14, 0.18, 0.16, 0.12, 0.1, 0.07, 0.04],
  5000,
  5200,
);

// ----------------------------------------------------------------------
// Discrete (top-K) — gap-on-absent
// ----------------------------------------------------------------------

/**
 * HTTP status codes — typical low-card numeric. Note the post-deploy
 * spike in 404 / 500 / 502 counts.
 */
export const discreteHttpStatus: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: ["200", "204", "304", "404", "500", "502"],
  base_counts: [18400, 1200, 4800, 220, 35, 5],
  current_counts: [17900, 1180, 5100, 1850, 410, 90],
  base_total: 18400 + 1200 + 4800 + 220 + 35 + 5,
  current_total: 17900 + 1180 + 5100 + 1850 + 410 + 90,
  trimmed: false,
};

/**
 * Country codes — well-behaved low-card string. Both sides have the same
 * top-K so no gap appears.
 */
export const discreteCountryCode: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: ["US", "GB", "DE", "FR", "JP", "CA", "AU", "BR", "IN", "MX"],
  base_counts: [4200, 1100, 850, 690, 510, 380, 250, 220, 180, 90],
  current_counts: [4350, 1080, 920, 700, 540, 400, 240, 210, 175, 95],
  base_total: 4200 + 1100 + 850 + 690 + 510 + 380 + 250 + 220 + 180 + 90,
  current_total: 4350 + 1080 + 920 + 700 + 540 + 400 + 240 + 210 + 175 + 95,
  trimmed: false,
};

/**
 * Signup source — dramatic shift in distribution post-redesign.
 * Mobile takes over from web.
 */
export const discreteSignupSource: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: ["web", "mobile", "api", "email", "social"],
  base_counts: [4800, 1200, 800, 400, 220],
  current_counts: [2400, 4500, 760, 380, 240],
  base_total: 4800 + 1200 + 800 + 400 + 220,
  current_total: 2400 + 4500 + 760 + 380 + 240,
  trimmed: false,
};

/**
 * Gap-on-absent example — base had `legacy_v1` and `legacy_v2` (no
 * longer present in current); current introduced `cohort_2026` (not in
 * base). The renderer should leave a visible empty half of each slot
 * for the absent side.
 */
export const discreteWithGaps: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: ["primary", "legacy_v1", "legacy_v2", "cohort_2026", "fallback"],
  base_counts: [9000, 1200, 600, 0, 200],
  current_counts: [10100, 0, 0, 1450, 220],
  base_total: 9000 + 1200 + 600 + 0 + 200,
  current_total: 10100 + 0 + 0 + 1450 + 220,
  trimmed: false,
};

/**
 * Trimmed top-K — 92-cardinality column where the backend kept only the
 * 12 most-significant slots. The cell should render the `trimmed`
 * marker in the corner.
 */
export const discreteTrimmedAirports: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: [
    "JFK",
    "LAX",
    "ORD",
    "DFW",
    "ATL",
    "DEN",
    "SFO",
    "SEA",
    "LAS",
    "MIA",
    "BOS",
    "PHX",
  ],
  base_counts: [
    4200, 3800, 3500, 3100, 2900, 2600, 2400, 2100, 1900, 1700, 1500, 1400,
  ],
  current_counts: [
    4400, 3700, 3300, 3000, 2950, 2600, 2500, 2050, 1850, 1750, 1450, 1380,
  ],
  base_total: 35_000,
  current_total: 36_000,
  trimmed: true,
};

/**
 * Demonstrates the heterogeneous-values reality of Stage B's
 * `values: unknown[]` contract — strings, NULL, integer, boolean, big
 * number. Used by stories to validate `formatValue` plumbing.
 */
export const discreteMixedTypes: ProfileDistributionTopKPayload = {
  kind: "topk",
  values: ["primary", null, 42, "a_pretty_long_display_value", true, 1500000],
  base_counts: [4200, 850, 600, 420, 180, 95],
  current_counts: [4000, 920, 580, 380, 220, 80],
  base_total: 12_000,
  current_total: 12_000,
  trimmed: false,
};

// ----------------------------------------------------------------------
// Discrete (top-K) — rank-only (DuckDB `approx_top_k` path)
// ----------------------------------------------------------------------

/**
 * Stable case — base and current top-K agree, in the same order. Renders
 * as two side-by-side descending staircases.
 */
export const discreteRankStable: ProfileDistributionTopKRanksPayload = {
  kind: "topk",
  mode: "ranks",
  values: [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
  ],
  base_ranks: [1, 2, 3, 4, 5, 6, 7, 8],
  current_ranks: [1, 2, 3, 4, 5, 6, 7, 8],
  k: 8,
  trimmed: false,
};

/**
 * Adjacent swaps — same values appear in both top-Ks but with some
 * neighbouring positions transposed. The eye sees base's smooth descent
 * and current bars zig-zagging against it.
 */
export const discreteRankShuffled: ProfileDistributionTopKRanksPayload = {
  kind: "topk",
  mode: "ranks",
  values: [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
  ],
  base_ranks: [1, 2, 3, 4, 5, 6, 7, 8],
  current_ranks: [1, 3, 2, 5, 4, 7, 6, 8],
  k: 8,
  trimmed: false,
};

/**
 * Full inversion — every rank flips. Current bars read as the mirror of
 * base's staircase: the leftmost slot has the tallest base bar and the
 * shortest current bar, and so on.
 */
export const discreteRankDramatic: ProfileDistributionTopKRanksPayload = {
  kind: "topk",
  mode: "ranks",
  values: [
    "alpha",
    "beta",
    "gamma",
    "delta",
    "epsilon",
    "zeta",
    "eta",
    "theta",
  ],
  base_ranks: [1, 2, 3, 4, 5, 6, 7, 8],
  current_ranks: [8, 7, 6, 5, 4, 3, 2, 1],
  k: 8,
  trimmed: false,
};

/**
 * New entrants and dropouts. `alpha`/`gamma` fell out of current's
 * top-K; `omicron`/`sigma` are new to current. Slot order follows
 * Stage B's contract: base's top-K in base-rank order first (positions
 * 1–8), then current-only values appended at the right in current-rank
 * order. Values absent from one side carry a `null` rank.
 */
export const discreteRankWithNewEntrants: ProfileDistributionTopKRanksPayload =
  {
    kind: "topk",
    mode: "ranks",
    values: [
      // Base's top-K in base-rank order:
      "alpha",
      "beta",
      "gamma",
      "delta",
      "epsilon",
      "zeta",
      "eta",
      "theta",
      // Then values in current's top-K but not base's, by current rank:
      "omicron",
      "sigma",
    ],
    // alpha=base#1 dropped from current; gamma=base#3 dropped from current.
    base_ranks: [1, 2, 3, 4, 5, 6, 7, 8, null, null],
    // omicron is current#3, sigma is current#6. beta/delta/epsilon/zeta/eta/theta
    // keep similar positions; alpha/gamma absent on current side.
    current_ranks: [null, 1, null, 2, 4, 5, 7, 8, 3, 6],
    k: 8,
    trimmed: false,
  };

/**
 * Trimmed rank-only top-K — 92-cardinality airports column where the
 * engine returned values without counts. Same trimmed-marker behavior
 * as counts mode.
 */
export const discreteRankTrimmedAirports: ProfileDistributionTopKRanksPayload =
  {
    kind: "topk",
    mode: "ranks",
    values: [
      "JFK",
      "LAX",
      "ORD",
      "DFW",
      "ATL",
      "DEN",
      "SFO",
      "SEA",
      "LAS",
      "MIA",
      "BOS",
      "PHX",
    ],
    base_ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    current_ranks: [1, 2, 4, 3, 5, 7, 6, 8, 10, 9, 12, 11],
    k: 12,
    trimmed: true,
  };

// ----------------------------------------------------------------------
// Failure / unsupported envelopes
// ----------------------------------------------------------------------

export const nullPayload: ProfileDistributionNullPayload = {
  kind: null,
  reason: "column query raised on this side; slot intentionally empty",
};

export const unsupportedResult: ProfileDistributionResult = {
  status: "unsupported",
  reason:
    "Adapter type 'postgres' lacks native HLL / APPROX_PERCENTILE / APPROX_TOP_K.",
};

// ----------------------------------------------------------------------
// Convenience: simulate a whole-task result envelope
// ----------------------------------------------------------------------

/**
 * A multi-column result envelope a SchemaView consumer would receive.
 * Mixes continuous, discrete, gapped, trimmed, and one per-column failure
 * so stories can render the full Compact-mode row stack against one fixture.
 */
export const mixedTaskResult: ProfileDistributionResult = {
  status: "ok",
  columns: {
    order_total_usd: continuousOrderAmount,
    created_at: continuousStable,
    ltv_predicted: continuousAddedOnly,
    response_status: discreteHttpStatus,
    billing_country: discreteCountryCode,
    signup_source: discreteSignupSource,
    cohort: discreteWithGaps,
    origin_airport: discreteTrimmedAirports,
    bad_column: nullPayload,
  },
};

// ----------------------------------------------------------------------
// snake_case → camelCase adapters
// ----------------------------------------------------------------------
//
// Stage B emits payloads in snake_case (matches the run API wire format);
// the React cells take camelCase props. Each story used to inline the
// shape conversion, so the same five-line copy appeared a dozen times.
// These adapters centralize it.

export function toContinuousProps(p: ProfileDistributionHistogramPayload) {
  return {
    baseBinEdges: p.base_bin_edges,
    currentBinEdges: p.current_bin_edges,
    baseDensity: p.base_density,
    currentDensity: p.current_density,
    baseTotal: p.base_total,
    currentTotal: p.current_total,
  };
}

export function toDiscreteProps(p: ProfileDistributionTopKPayload) {
  return {
    values: p.values,
    baseCounts: p.base_counts,
    currentCounts: p.current_counts,
    baseTotal: p.base_total,
    currentTotal: p.current_total,
    trimmed: p.trimmed,
  };
}

export function toDiscreteRanksProps(p: ProfileDistributionTopKRanksPayload) {
  return {
    mode: p.mode,
    values: p.values,
    baseRanks: p.base_ranks,
    currentRanks: p.current_ranks,
    k: p.k,
    trimmed: p.trimmed,
  };
}
