/**
 * Synthetic profile-data fixtures for the Paired Histograms design exploration.
 *
 * Two shapes:
 *   - DiscreteDistribution → feeds PairedHistogramDiscreteCell (low-card
 *     string + low-card numeric).
 *   - PairedHistogram → feeds PairedHistogramContinuousCell (high-card
 *     quantitative).
 *
 * Both are uniform-bin / equal-slot. The earlier variable-width-bin idea
 * was rejected — backend ships uniform geometry, the renderer makes the
 * visual choices (slot equal-width, color, alpha).
 */

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export interface DiscreteDistribution {
  /** Display order. Caller's responsibility (frequency-desc, numeric-asc, etc.) */
  values: string[];
  baseCounts: number[];
  currentCounts: number[];
  baseTotal: number;
  currentTotal: number;
}

/**
 * Trim a discrete distribution to the top-N values by max(baseProp, currProp),
 * preserving original display order. Used to fit a 92-value distribution into
 * a cell-density chart that can only render ~12 slots cleanly.
 */
export function trimToTopN(
  d: DiscreteDistribution,
  n: number,
): DiscreteDistribution {
  if (d.values.length <= n) return d;
  const score = (i: number) => {
    const bp = d.baseTotal > 0 ? d.baseCounts[i] / d.baseTotal : 0;
    const cp = d.currentTotal > 0 ? d.currentCounts[i] / d.currentTotal : 0;
    return Math.max(bp, cp);
  };
  const indexed = d.values.map((_, i) => ({ i, s: score(i) }));
  indexed.sort((a, z) => z.s - a.s);
  const keep = indexed
    .slice(0, n)
    .map((x) => x.i)
    .sort((a, z) => a - z);
  return {
    values: keep.map((i) => d.values[i]),
    baseCounts: keep.map((i) => d.baseCounts[i]),
    currentCounts: keep.map((i) => d.currentCounts[i]),
    baseTotal: d.baseTotal,
    currentTotal: d.currentTotal,
  };
}

// ---------- Low-cardinality string (12 country codes) ----------

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
];

export const lowCardStringSmall: DiscreteDistribution = (() => {
  const rand = lcg(7);
  const baseCounts = COUNTRY_LABELS.map((_, i) =>
    Math.round(800 * Math.exp(-i * 0.35)),
  );
  const currentCounts = baseCounts.map((c) => {
    const drift = 0.85 + rand() * 0.4;
    return Math.max(0, Math.round(c * drift));
  });
  return {
    values: COUNTRY_LABELS,
    baseCounts,
    currentCounts,
    baseTotal: baseCounts.reduce((s, c) => s + c, 0),
    currentTotal: currentCounts.reduce((s, c) => s + c, 0),
  };
})();

// ---------- Low-cardinality string (92 airport codes — needs trim) ----------

/**
 * 92 distinct values with three deliberate spikes/drops at indexes 47, 70, 85.
 * `trimToTopN(lowCardStringLarge, 12)` produces the cell-friendly version.
 * The full 92-value version is what the baseball-card might want to expose
 * via a "view all" interaction (not in scope here).
 */
export const lowCardStringLarge: DiscreteDistribution = (() => {
  const rand = lcg(11);
  const values = Array.from(
    { length: 92 },
    (_, i) => `airport_${(i + 1).toString().padStart(3, "0")}`,
  );
  const baseCounts = values.map((_, i) =>
    Math.max(1, Math.round(2500 * Math.exp(-i * 0.06))),
  );
  const currentCounts = baseCounts.map((c, i) => {
    const drift = 0.8 + rand() * 0.5;
    let v = Math.max(0, Math.round(c * drift));
    if (i === 47) v = c * 6;
    if (i === 70) v = Math.round(c * 0.05);
    if (i === 85) v = c * 12;
    return v;
  });
  return {
    values,
    baseCounts,
    currentCounts,
    baseTotal: baseCounts.reduce((s, c) => s + c, 0),
    currentTotal: currentCounts.reduce((s, c) => s + c, 0),
  };
})();

// ---------- Low-cardinality numeric (HTTP status codes) ----------

export const lowCardNumericHttp: DiscreteDistribution = {
  values: ["200", "204", "304", "404", "500", "502"],
  baseCounts: [18400, 1200, 4800, 220, 35, 5],
  currentCounts: [17900, 1180, 5100, 1850, 410, 90],
  baseTotal: 18400 + 1200 + 4800 + 220 + 35 + 5,
  currentTotal: 17900 + 1180 + 5100 + 1850 + 410 + 90,
};

// ---------- High-cardinality continuous (order amount) ----------

export interface PairedHistogram {
  binEdges: number[];
  baseCounts: number[];
  currentCounts: number[];
  baseTotal: number;
  currentTotal: number;
}

export const highCardOrderAmount: PairedHistogram = (() => {
  const rand = lcg(23);
  const binCount = 21;
  const binWidth = 500;
  const binEdges = Array.from({ length: binCount + 1 }, (_, i) => i * binWidth);
  const baseCounts = binEdges.slice(0, -1).map((lo) => {
    const mid = lo + binWidth / 2;
    return Math.max(
      0,
      Math.round(8000 * Math.exp(-((Math.log(mid + 1) - 6.2) ** 2) / 1.5)),
    );
  });
  const currentCounts = binEdges.slice(0, -1).map((lo) => {
    const mid = lo + binWidth / 2;
    return Math.max(
      0,
      Math.round(
        8000 *
          Math.exp(-((Math.log(mid + 1) - 6.4) ** 2) / 1.5) *
          (0.9 + rand() * 0.2),
      ),
    );
  });
  return {
    binEdges,
    baseCounts,
    currentCounts,
    baseTotal: baseCounts.reduce((s, c) => s + c, 0),
    currentTotal: currentCounts.reduce((s, c) => s + c, 0),
  };
})();
