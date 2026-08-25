import { formatAsAbbreviatedNumber } from "../../utils/formatters";

interface EdgeUnit {
  divisor: number;
  suffix: string;
}

const EDGE_UNITS: EdgeUnit[] = [
  { divisor: 1e12, suffix: "T" },
  { divisor: 1e9, suffix: "B" },
  { divisor: 1e6, suffix: "M" },
  { divisor: 1e3, suffix: "K" },
];

function labelsAreDistinct(
  values: number[],
  format: (value: number) => string,
): boolean {
  return new Set(values.map(format)).size === values.length;
}

/**
 * Creates one shared formatter for a histogram domain. Compact labels remain
 * unchanged when they identify every edge. For narrow, high-offset domains,
 * the formatter adds only as much precision as is needed to keep every tick
 * and tooltip endpoint distinguishable.
 */
export function createHistogramEdgeFormatter(
  binEdges: number[],
): (value: number) => string {
  const distinctEdges = [...new Set(binEdges.filter(Number.isFinite))];
  const abbreviated = (value: number) =>
    String(formatAsAbbreviatedNumber(value));

  if (labelsAreDistinct(distinctEdges, abbreviated)) return abbreviated;

  const maxMagnitude = Math.max(0, ...distinctEdges.map(Math.abs));
  const unit = EDGE_UNITS.find(({ divisor }) => maxMagnitude >= divisor) ?? {
    divisor: 1,
    suffix: "",
  };

  for (let fractionDigits = 0; fractionDigits <= 20; fractionDigits += 1) {
    const numberFormat = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: fractionDigits,
      useGrouping: unit.divisor === 1,
    });
    const candidate = (value: number) =>
      `${numberFormat.format(value / unit.divisor)}${unit.suffix}`;
    if (labelsAreDistinct(distinctEdges, candidate)) return candidate;
  }

  // Number#toString is the exact shortest round-trippable representation, so
  // distinct finite JavaScript numbers cannot collapse here.
  return (value: number) => value.toString();
}
