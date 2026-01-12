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
