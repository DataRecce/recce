/**
 * Synthetic payload fixtures for the Paired Histograms GA cells (DRC-3390 PR 3).
 *
 * These match the **frozen** payload schemas PR 2 produces:
 *   - Continuous → `{kind:"histogram", bin_edges:[12], base_density:[11],
 *     current_density:[11], base_total, current_total}` (quantile bins,
 *     constant-area).
 *   - Discrete   → `{kind:"topk", values, base_counts, current_counts,
 *     base_total, current_total, trimmed}` (top-K with gap-on-absent).
 *   - Null       → `{kind:null}` (per-column failure).
 *   - Unsupported envelope → `{status:"unsupported", reason:...}`.
 *
 * The PR 2 backend isn't merged yet, so stories MOCK the payload by
 * importing these directly. When PR 2 lands, swap the data source in
 * the connected `useInlineProfileDistribution` stories — the cells
 * themselves don't change.
 */

import type {
  ProfileDistributionHistogramPayload,
  ProfileDistributionNullPayload,
  ProfileDistributionResult,
  ProfileDistributionTopKPayload,
} from "@datarecce/ui/api";

// ----------------------------------------------------------------------
// Continuous (histogram) — quantile-binned, constant-area
// ----------------------------------------------------------------------

/**
 * 11 quantile bins concentrated in the middle (typical of a long-tailed
 * order-amount distribution). Densities sum to ~1 once weighted by bin
 * width — that's the constant-area contract.
 *
 * Edges span $0 → $1000 with most mass between $50 and $300.
 */
export const continuousOrderAmount: ProfileDistributionHistogramPayload = {
  kind: "histogram",
  bin_edges: [0, 10, 25, 50, 80, 120, 165, 220, 290, 400, 600, 1000],
  base_density: [
    0.001, 0.003, 0.006, 0.01, 0.014, 0.018, 0.015, 0.01, 0.005, 0.002, 0.0004,
  ],
  current_density: [
    0.0008, 0.0025, 0.005, 0.0085, 0.013, 0.019, 0.017, 0.012, 0.006, 0.0028,
    0.0005,
  ],
  base_total: 12_000,
  current_total: 14_500,
};

/**
 * Symmetric, low-divergence column (timestamps from a stable signup
 * source). Base ≈ Current, so the chart should read as mostly checkerboard
 * with very thin differential strips.
 */
export const continuousStable: ProfileDistributionHistogramPayload = {
  kind: "histogram",
  bin_edges: [
    1704067200, 1704672000, 1705276800, 1705881600, 1706486400, 1707091200,
    1707696000, 1708300800, 1708905600, 1709510400, 1710115200, 1710720000,
  ],
  base_density: Array(11)
    .fill(0)
    .map((_, i) => {
      const x = i - 5;
      return Math.max(1e-6, 0.0001 * Math.exp(-(x * x) / 8));
    }),
  current_density: Array(11)
    .fill(0)
    .map((_, i) => {
      const x = i - 5;
      return Math.max(1e-6, 0.0001 * Math.exp(-(x * x) / 8) * 1.03);
    }),
  base_total: 25_000,
  current_total: 24_500,
};

/**
 * Added column — base totals 0, all mass on current side. Renders as a
 * solid-blue chart (current dominates every bin).
 */
export const continuousAddedOnly: ProfileDistributionHistogramPayload = {
  kind: "histogram",
  bin_edges: [0, 50, 100, 150, 200, 300, 400, 500, 700, 900, 1200, 1500],
  base_density: Array(11).fill(0),
  current_density: [
    0.0005, 0.002, 0.004, 0.006, 0.005, 0.003, 0.0015, 0.0008, 0.0004, 0.00018,
    0.00006,
  ],
  base_total: 0,
  current_total: 18_000,
};

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
