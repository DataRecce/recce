"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { memo } from "react";

/**
 * Run status types
 */
export type RunStatus = "running" | "finished" | "failed" | "cancelled";

/**
 * Props for the RunStatusBadge component
 */
export interface RunStatusBadgeProps {
  /** Run status */
  status: RunStatus;
  /** Whether to show the spinner for running state */
  showSpinner?: boolean;
  /** Text size variant */
  size?: "small" | "medium";
  /** Optional CSS class */
  className?: string;
}

/**
 * Get status display properties
 */
function getStatusDisplay(status: RunStatus): { color: string; label: string } {
  switch (status) {
    case "running":
      return { color: "blue", label: "Running" };
    case "finished":
      return { color: "green", label: "Finished" };
    case "failed":
      return { color: "red", label: "Failed" };
    case "cancelled":
      return { color: "grey", label: "Cancelled" };
    default:
      return { color: "green", label: "Finished" };
  }
}

/**
 * RunStatusBadge Component
 *
 * A pure presentation component for displaying run status with color coding.
 *
 * @example Basic usage
 * ```tsx
 * import { RunStatusBadge } from '@datarecce/ui/primitives';
 *
 * function RunItem({ run }) {
 *   return (
 *     <div>
 *       <span>{run.name}</span>
 *       <RunStatusBadge status={run.status} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With spinner
 * ```tsx
 * <RunStatusBadge
 *   status="running"
 *   showSpinner
 * />
 * ```
 */
function RunStatusBadgeComponent({
  status,
  showSpinner = true,
  size = "small",
  className,
}: RunStatusBadgeProps) {
  const { color, label } = getStatusDisplay(status);
  const isRunning = status === "running";
  const fontSize = size === "small" ? "0.75rem" : "0.875rem";
  const spinnerSize = size === "small" ? 12 : 16;

  return (
    <Box
      className={className}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
      }}
    >
      {isRunning && showSpinner && (
        <CircularProgress size={spinnerSize} color="primary" />
      )}
      <Typography
        component="span"
        sx={{
          fontWeight: 500,
          fontSize,
          color: `${color}.500`,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export const RunStatusBadge = memo(RunStatusBadgeComponent);
RunStatusBadge.displayName = "RunStatusBadge";

/**
 * Format date relative to today
 */
export function formatRunDate(date: Date | null): string | null {
  if (date == null) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (today.toDateString() === date.toDateString()) {
    return "Today";
  } else if (yesterday.toDateString() === date.toDateString()) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

/**
 * Format date and time relative to today
 */
export function formatRunDateTime(date: Date | null): string | null {
  if (date == null) return null;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (today.toDateString() === date.toDateString()) {
    return `Today, ${time}`;
  } else if (yesterday.toDateString() === date.toDateString()) {
    return `Yesterday, ${time}`;
  } else {
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return `${dateStr}, ${time}`;
  }
}

/**
 * Props for RunStatusWithDate component
 */
export interface RunStatusWithDateProps {
  /** Run status */
  status: RunStatus;
  /** Run timestamp */
  runAt?: string | Date;
  /** Optional CSS class */
  className?: string;
}

/**
 * RunStatusWithDate Component
 *
 * Displays status badge with formatted date/time.
 *
 * @example
 * ```tsx
 * <RunStatusWithDate
 *   status="finished"
 *   runAt={run.run_at}
 * />
 * ```
 */
function RunStatusWithDateComponent({
  status,
  runAt,
  className,
}: RunStatusWithDateProps) {
  const dateTime = runAt
    ? formatRunDateTime(typeof runAt === "string" ? new Date(runAt) : runAt)
    : null;

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        fontSize: "0.75rem",
        color: "text.secondary",
      }}
    >
      <RunStatusBadge status={status} size="small" />
      {dateTime && (
        <>
          <Typography component="span" sx={{ fontSize: "inherit" }}>
            •
          </Typography>
          <Typography
            component="span"
            sx={{
              fontSize: "inherit",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {dateTime}
          </Typography>
        </>
      )}
    </Box>
  );
}

export const RunStatusWithDate = memo(RunStatusWithDateComponent);
RunStatusWithDate.displayName = "RunStatusWithDate";
