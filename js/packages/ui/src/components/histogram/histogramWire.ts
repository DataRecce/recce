import type { HistogramWireValue } from "../../api";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/i;
const ISO_TIME_ZONE_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;

/** Parse the FastAPI ISO wire format without depending on the browser timezone. */
export function parseHistogramTimestamp(value: HistogramWireValue): number {
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    throw new RangeError("Histogram timestamp must be finite");
  }

  const trimmedValue = value.trim();
  let normalizedValue: string;
  if (ISO_DATE_PATTERN.test(trimmedValue)) {
    normalizedValue = `${trimmedValue}T00:00:00Z`;
  } else if (ISO_DATETIME_PATTERN.test(trimmedValue)) {
    normalizedValue = ISO_TIME_ZONE_PATTERN.test(trimmedValue)
      ? trimmedValue
      : `${trimmedValue}Z`;
  } else {
    throw new RangeError(
      "Histogram timestamp must use an ISO date or datetime",
    );
  }

  const timestamp = Date.parse(normalizedValue);
  if (!Number.isFinite(timestamp)) {
    throw new RangeError(
      "Histogram timestamp is outside the supported date range",
    );
  }
  return timestamp;
}
