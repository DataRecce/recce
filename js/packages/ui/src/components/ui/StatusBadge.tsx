"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import { memo } from "react";

/**
 * Status type for the badge
 */
export type StatusType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "running"
  | "pending"
  | "cancelled";

/**
 * Props for the StatusBadge component
 */
export interface StatusBadgeProps {
  /** Status type */
  status: StatusType;
  /** Custom label (overrides default) */
  label?: string;
  /** Show timestamp */
  timestamp?: string;
  /** Show loading spinner for running status */
  showSpinner?: boolean;
  /** Theme mode */
  theme?: "light" | "dark";
  /** Font size */
  fontSize?: string | number;
  /** Optional CSS class */
  className?: string;
}

/**
 * Get color for status type
 */
function getStatusColor(status: StatusType, isDark: boolean): string {
  const colors: Record<StatusType, string> = {
    success: isDark ? "#4ade80" : "#22c55e",
    error: isDark ? "#f87171" : "#ef4444",
    warning: isDark ? "#fbbf24" : "#f59e0b",
    info: isDark ? "#60a5fa" : "#3b82f6",
    running: isDark ? "#60a5fa" : "#3b82f6",
    pending: isDark ? "#9ca3af" : "#6b7280",
    cancelled: isDark ? "#9ca3af" : "#6b7280",
  };
  return colors[status];
}

/**
 * Get default label for status type
 */
function getDefaultLabel(status: StatusType): string {
  const labels: Record<StatusType, string> = {
    success: "Success",
    error: "Failed",
    warning: "Warning",
    info: "Info",
    running: "Running",
    pending: "Pending",
    cancelled: "Cancelled",
  };
  return labels[status];
}

/**
 * StatusBadge Component
 *
 * A pure presentation component for displaying status indicators
 * with optional timestamp and loading spinner.
 *
 * @example Basic usage
 * ```tsx
 * import { StatusBadge } from '@datarecce/ui/primitives';
 *
 * function RunStatus({ status }) {
 *   return <StatusBadge status={status} />;
 * }
 * ```
 *
 * @example With timestamp
 * ```tsx
 * <StatusBadge
 *   status="success"
 *   label="Finished"
 *   timestamp="Today, 14:30"
 * />
 * ```
 *
 * @example Running state with spinner
 * ```tsx
 * <StatusBadge
 *   status="running"
 *   showSpinner
 * />
 * ```
 */
function StatusBadgeComponent({
  status,
  label,
  timestamp,
  showSpinner = true,
  theme = "light",
  fontSize = "0.875rem",
  className,
}: StatusBadgeProps) {
  const isDark = theme === "dark";
  const statusColor = getStatusColor(status, isDark);
  const displayLabel = label ?? getDefaultLabel(status);
  const isRunning = status === "running";

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        justifyContent: "flex-start",
        fontSize,
        color: isDark ? "grey.400" : "grey.500",
        gap: "6px",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {isRunning && showSpinner && (
        <CircularProgress size={12} sx={{ color: statusColor }} />
      )}
      <Typography
        component="span"
        sx={{
          fontWeight: 500,
          color: statusColor,
          fontSize: "inherit",
        }}
      >
        {displayLabel}
      </Typography>
      {timestamp && (
        <>
          <Typography component="span" sx={{ fontSize: "inherit" }}>
            •
          </Typography>
          <Typography
            component="span"
            sx={{
              textOverflow: "ellipsis",
              overflow: "hidden",
              whiteSpace: "nowrap",
              fontSize: "inherit",
            }}
          >
            {timestamp}
          </Typography>
        </>
      )}
    </Box>
  );
}

export const StatusBadge = memo(StatusBadgeComponent);
StatusBadge.displayName = "StatusBadge";
