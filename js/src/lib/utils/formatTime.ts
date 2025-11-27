/**
 * Time formatting utilities for idle timeout display
 */

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
 */
function formatVerbose({ minutes, seconds }: TimeComponents): string {
  // Less than 1 minute - show seconds only
  if (minutes < 1) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }

  // Exact minutes (no remaining seconds)
  if (seconds === 0) {
    return `${minutes} min${minutes !== 1 ? "s" : ""}`;
  }

  // Minutes with seconds
  return `${minutes} min${minutes !== 1 ? "s" : ""} ${seconds} second${seconds !== 1 ? "s" : ""}`;
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
