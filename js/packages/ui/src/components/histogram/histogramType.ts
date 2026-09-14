const DATETIME_HISTOGRAM_TYPES = new Set([
  "DATE",
  "DATETIME",
  "TIMESTAMP",
  "YEAR",
  "DATETIME2",
  "SMALLDATETIME",
  "DATETIMEOFFSET",
  "INTERVAL",
  "TIMESTAMPTZ",
  "TIMESTAMP WITH TIME ZONE",
  "TIMESTAMP WITHOUT TIME ZONE",
  "TIMESTAMP WITH LOCAL TIME ZONE",
  "TIMESTAMP_LTZ",
  "TIMESTAMP_NTZ",
  "TIMESTAMP_TZ",
]);

const TYPE_PRECISION_PATTERN = /\s*\(\s*\d+\s*\)/;

/** Mirrors the normalized temporal classifier used by the histogram backend. */
export function isDatetimeHistogramType(columnType: string): boolean {
  const normalizedType = columnType.trim().toUpperCase().replace(/\s+/g, " ");
  const typeWithoutPrecision = normalizedType.replace(
    TYPE_PRECISION_PATTERN,
    "",
  );
  return DATETIME_HISTOGRAM_TYPES.has(typeWithoutPrecision);
}
