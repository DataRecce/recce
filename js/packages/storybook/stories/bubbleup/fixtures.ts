import type {
  ContinuousBubbleUpData,
  DiscreteBubbleUpData,
} from "./BubbleUpHistogram";

/**
 * Synthetic profile-data fixtures for BubbleUp design exploration.
 * NOT real ColumnProfileStats — see BUBBLEUP-DESIGN-NOTES.md for the
 * fields that would need to grow on the backend to feed these shapes.
 */

// Deterministic-ish PRNG so stories don't churn between renders
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ---------- Low-cardinality string ----------

const COUNTRY_LABELS = [
  "US",
  "GB",
  "DE",
  "FR",
  "JP",
  "CA",
  "AU",
  "BR",
  "IN",
  "MX",
  "IT",
  "ES",
  "NL",
  "SE",
  "NO",
  "DK",
  "FI",
  "PL",
  "CH",
  "AT",
];

/**
 * 12 distinct strings — well under the X-axis-drop threshold (40).
 * Baseline-frequency-descending order is encoded in the array itself.
 */
export const lowCardStringSmall: DiscreteBubbleUpData = (() => {
  const rand = lcg(7);
  const buckets = COUNTRY_LABELS.slice(0, 12).map((value, i) => {
    const base_count = Math.round(800 * Math.exp(-i * 0.35));
    const drift = 0.85 + rand() * 0.4;
    return {
      value,
      base_count,
      current_count: Math.max(0, Math.round(base_count * drift)),
    };
  });
  // sort by base desc to encode the captain's ordering rule
  buckets.sort((a, z) => z.base_count - a.base_count);
  return {
    buckets,
    base_total: buckets.reduce((s, b) => s + b.base_count, 0),
    current_total: buckets.reduce((s, b) => s + b.current_count, 0),
  };
})();

/**
 * 92 distinct strings — over the trim threshold (75). Demonstrates the
 * trim+no-axis branch. Includes 3 deliberate "outlier" buckets where
 * current is much larger than base, to verify the outlier-keep heuristic.
 */
export const lowCardStringLarge: DiscreteBubbleUpData = (() => {
  const rand = lcg(11);
  const buckets = Array.from({ length: 92 }, (_, i) => {
    const value = `airport_${(i + 1).toString().padStart(3, "0")}`;
    // power-law-ish baseline
    const base_count = Math.max(1, Math.round(2500 * Math.exp(-i * 0.06)));
    const drift = 0.8 + rand() * 0.5;
    let current_count = Math.max(0, Math.round(base_count * drift));
    // Inject 3 outliers at known indexes
    if (i === 47) current_count = base_count * 6; // spike
    if (i === 70) current_count = Math.round(base_count * 0.05); // drop
    if (i === 85) current_count = base_count * 12; // far-tail spike
    return { value, base_count, current_count };
  });
  buckets.sort((a, z) => z.base_count - a.base_count);
  return {
    buckets,
    base_total: buckets.reduce((s, b) => s + b.base_count, 0),
    current_total: buckets.reduce((s, b) => s + b.current_count, 0),
  };
})();

// ---------- Low-cardinality numeric ----------

/**
 * 6 HTTP status codes — caller orders by numeric value, NOT by frequency.
 * Note 200 vs 304 are 104 apart, 404 vs 500 are 96 apart — proportional
 * spacing would crush the small-gap pairs. Equal-width is the captain's call.
 */
export const lowCardNumericHttp: DiscreteBubbleUpData = {
  buckets: [
    { value: "200", base_count: 18400, current_count: 17900 },
    { value: "204", base_count: 1200, current_count: 1180 },
    { value: "304", base_count: 4800, current_count: 5100 },
    { value: "404", base_count: 220, current_count: 1850 }, // suspicious spike
    { value: "500", base_count: 35, current_count: 410 }, // also a spike
    { value: "502", base_count: 5, current_count: 90 },
  ],
  base_total: 24660,
  current_total: 26530,
};

// ---------- High-cardinality continuous ----------

/**
 * Order amount distribution, $0–$10,100, 50 bins of varying width.
 * Baseline + current overlap mostly, with current shifting slightly higher.
 */
export const highCardOrderAmount: ContinuousBubbleUpData = (() => {
  const rand = lcg(23);
  const edges = [
    0, 50, 100, 200, 300, 400, 500, 700, 1000, 1500, 2000, 2500, 3000, 3500,
    4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000, 8500, 9000, 9500,
    10000, 10100,
  ];
  const bins = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const mid = (lo + hi) / 2;
    // baseline: log-normal-ish around $500
    const base = Math.max(
      0,
      Math.round(8000 * Math.exp(-Math.pow(Math.log(mid + 1) - 6.2, 2) / 1.5)),
    );
    // current: shifts ~$200 higher with mild noise
    const cur = Math.max(
      0,
      Math.round(
        8000 *
          Math.exp(-Math.pow(Math.log(mid + 1) - 6.4, 2) / 1.5) *
          (0.9 + rand() * 0.2),
      ),
    );
    bins.push({ lo, hi, base_count: base, current_count: cur });
  }
  return {
    bins,
    base_total: bins.reduce((s, b) => s + b.base_count, 0),
    current_total: bins.reduce((s, b) => s + b.current_count, 0),
  };
})();
