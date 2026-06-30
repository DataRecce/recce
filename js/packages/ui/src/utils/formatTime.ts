/**
 * @file formatTime.ts
 * @description Time formatting utilities for duration and timestamp display
 */

import { format, formatDistance, parseISO } from "date-fns";

export type TimeFormatStyle = "compact" | "verbose";

interface TimeComponents {
  hours: number;
  minutes: number;
  seconds: number;
}

/**
 * Break down seconds into hours, minutes, seconds
 */
function getTimeComponents(totalSeconds: number): TimeComponents {
  const seconds = Math.floor(totalSeconds);
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

/**
 * Format time in compact style (MM:SS or HH:MM:SS)
 * Used for countdown badges where space is limited
 */
function formatCompact({ hours, minutes, seconds }: TimeComponents): string {
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format time in verbose style (human-readable)
 * Used for messages where clarity is more important than brevity
 *
 * Examples:
 * - Less than 1 minute: "30 seconds"
 * - Exact minutes: "5 mins"
 * - Minutes with seconds: "2 mins 30 seconds"
 * - With hours: "1 hour 30 mins"
 */
function formatVerbose({ hours, minutes, seconds }: TimeComponents): string {
  const parts: string[] = [];

  // Add hours if present
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  }

  // Add minutes if present (or if hours present and minutes > 0)
  if (minutes > 0) {
    parts.push(`${minutes} min${minutes !== 1 ? "s" : ""}`);
  }

  // Add seconds only if no hours (keep message concise for long durations)
  // or if it's the only component
  if (hours === 0 && (parts.length === 0 || seconds > 0)) {
    parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
  }

  return parts.join(" ");
}

/**
 * Format seconds into human-readable time string
 *
 * @param totalSeconds - Total seconds to format
 * @param style - "compact" for MM:SS, "verbose" for human-readable
 */
export function formatDuration(
  totalSeconds: number,
  style: TimeFormatStyle = "verbose",
): string {
  const components = getTimeComponents(totalSeconds);

  if (style === "compact") {
    return formatCompact(components);
  }
  return formatVerbose(components);
}

/**
 * Format seconds-since-midnight (0–86399) as a zero-padded `HH:MM:SS` wall-clock
 * time. Distinct from {@link formatDuration}: a clock time always shows two
 * digit hours and never drops the hours component (`00:05:30`, not `5:30`), and
 * wraps at 24h. Used for `TIME`-column histogram edges, whose `epoch()` cast
 * emits seconds-since-midnight rather than Unix-epoch seconds.
 *
 * @param secondsSinceMidnight - Seconds elapsed since 00:00:00
 */
export function formatTimeOfDay(secondsSinceMidnight: number): string {
  if (!Number.isFinite(secondsSinceMidnight)) {
    return String(secondsSinceMidnight);
  }
  // Normalize into [0, 86400). Approximate-quantile sketches can emit an edge
  // slightly below the empirical min (a small negative) or at/over 24h; wrap
  // into a real clock time rather than render "-1:00:-5".
  const normalized =
    ((Math.floor(secondsSinceMidnight) % 86400) + 86400) % 86400;
  const { hours, minutes, seconds } = getTimeComponents(normalized);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Format an epoch-seconds value as a short calendar date for tooltips. Sibling
 * of {@link formatTimeOfDay}: date/timestamp/datetime histogram edges arrive as
 * Unix epoch seconds (→ calendar date), TIME edges as seconds-since-midnight
 * (→ clock time). Both edge formatters live here so the datetime-formatting
 * seam has one home.
 *
 * `includeTime` appends a UTC wall-clock time after the date so adjacent
 * histogram edges that fall on the **same calendar day** stay distinguishable
 * (otherwise an intra-day timestamp column renders the information-free tooltip
 * "Jun 5, 2026 – Jun 5, 2026"). The caller decides the precision from the
 * bin-edge span:
 *   - `false`     → date only (the default; correct for multi-day spans).
 *   - `true`      → date + `HH:mm` (minute/hour-scale spans).
 *   - `"seconds"` → date + `HH:mm:ss` (sub-minute spans, where the minute
 *     component alone would still collapse adjacent edges).
 *
 * @param sec - Unix epoch seconds.
 * @param includeTime - Append a UTC `HH:mm` (`true`) or `HH:mm:ss`
 *   (`"seconds"`) time; omit for date-only (`false`, default).
 */
export function formatEpochSeconds(
  sec: number,
  includeTime: boolean | "seconds" = false,
): string {
  const d = new Date(sec * 1000);
  if (Number.isNaN(d.getTime())) return String(sec);
  // Render in UTC: the backend's epoch() cast emits UTC-based seconds, so a
  // local-timezone render would shift day-boundary edges to the wrong calendar
  // day (e.g. UTC midnight showing as the previous day west of UTC).
  const date = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  if (!includeTime) return date;
  // Time components also read in UTC, for the same day-boundary reason as the
  // date above — a local-tz clock would disagree with the UTC calendar day.
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const time =
    includeTime === "seconds"
      ? `${hh}:${mm}:${pad(d.getUTCSeconds())}`
      : `${hh}:${mm}`;
  return `${date} ${time}`;
}

// ============================================================================
// ISO Timestamp Utilities
// ============================================================================

/**
 * Format an ISO timestamp string to a consistent date-time format.
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns Formatted string in "yyyy-MM-dd'T'HH:mm:ss" format
 *
 * @example
 * ```ts
 * formatTimestamp("2024-01-15T10:30:00Z")
 * // Returns: "2024-01-15T10:30:00"
 * ```
 */
export function formatTimestamp(timestamp: string): string {
  const date = parseISO(timestamp);
  return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

/**
 * Format an ISO timestamp as a relative time string (e.g., "2 hours ago").
 *
 * @param timestamp - ISO 8601 timestamp string
 * @returns Human-readable relative time string
 *
 * @example
 * ```ts
 * formatTimeToNow("2024-01-15T10:30:00Z")
 * // Returns: "2 hours ago" (depending on current time)
 * ```
 */
export function formatTimeToNow(timestamp: string): string {
  const date = parseISO(timestamp);
  return formatDistance(date, new Date(), {
    addSuffix: true,
  });
}
